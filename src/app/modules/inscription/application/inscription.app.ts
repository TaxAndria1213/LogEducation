import { Application, NextFunction, Request, Response as R, Router } from "express";
import bcrypt from "bcrypt";
import { Inscription, Prisma, PrismaClient, type StatutFacture } from "@prisma/client";
import express from "express";
import fs from "fs/promises";
import path from "path";
import Response from "../../../common/app/response";
import { generateRandomPassword, getAllPaginated } from "../../../common/utils/functions";
import PrismaService from "../../../service/prisma_service";
import { prisma } from "../../../service/prisma";
import {
    allocatePaiementsToFactureEcheances,
    ensureFactureEcheances,
    ensurePlanForFacture,
    syncPlanJsonFromEcheances,
    upsertPlanEcheances,
    type EcheanceInput,
} from "../../finance_shared/utils/echeance_paiement";
import { calculateRecoveryPenalty, getApprovedRecoveryPolicy } from "../../finance_shared/utils/recovery_policy";
import { assessBillingReadiness } from "../../finance_shared/utils/billing_readiness";
import { createRecurringExecutionIfNeeded } from "../../finance_shared/utils/recurring_billing";
import { assertNoAdministrativeRestriction } from "../../finance_shared/utils/recovery_restrictions";
import { extractRoleNamesFromPayload, hasSystemAdminRoleNames } from "../../../service/sessionPolicy";
import EleveModel from "../../eleve/models/eleve.model";
import EleveParentTuteurModel from "../../eleve_parent_tuteur/models/eleve_parent_tuteur.model";
import ParentTuteurModel from "../../parent_tuteur/models/parent_tuteur.model";
import ProfileModel from "../../profile/models/profile.model";
import UserModel from "../../user/models/user.model";
import InscriptionModel from "../models/inscription.model";

type AnnualPaymentPlan = {
    code: string;
    label: string;
    nombre_tranches: number;
    offsets_mois: number[];
};

type BillingInvoiceLine = {
    libelle: string;
    montant: number;
    catalogue_frais_id: string | null;
    source_key: string;
    devise?: string | null;
    nombre_tranches: number;
    installment_offsets_months?: number[] | null;
    usage_scope?: string | null;
    mode_facturation?: string | null;
    plan_code?: string | null;
    plan_label?: string | null;
};

type EnrollmentFinancePolicyMode =
    | "NONE"
    | "PERCENT"
    | "AMOUNT"
    | "INSCRIPTION_FEE"
    | "INSCRIPTION_AND_FIRST_SCOLARITE_TRANCHE";

type EnrollmentMinimumPaymentBreakdown = {
    registrationFeeAmount: number;
    firstSchoolInstallmentAmount: number;
};

class InscriptionApp {
    public app: Application;
    public router: Router;
    private inscription: InscriptionModel;
    private user: UserModel;
    private profil: ProfileModel;
    private eleve: EleveModel;
    private parentTuteur: ParentTuteurModel;
    private eleveParent: EleveParentTuteurModel;
    private abonnementTransport: PrismaService;
    private abonnementCantine: PrismaService;
    private planPaiementEleve: PrismaService;
    private facture: PrismaService;
    private factureLigne: PrismaService;
    private prisma: PrismaClient;

    constructor(app: Application) {
        this.app = app;
        this.router = Router();
        this.inscription = new InscriptionModel();
        this.user = new UserModel();
        this.profil = new ProfileModel();
        this.eleve = new EleveModel();
        this.parentTuteur = new ParentTuteurModel();
        this.eleveParent = new EleveParentTuteurModel();
        this.abonnementTransport = new PrismaService("abonnementTransport");
        this.abonnementCantine = new PrismaService("abonnementCantine");
        this.planPaiementEleve = new PrismaService("planPaiementEleve");
        this.facture = new PrismaService("facture");
        this.factureLigne = new PrismaService("factureLigne");
        this.prisma = prisma;
        this.routes();
    }

    public routes(): Router {
        this.router.post("/", this.create.bind(this));
        this.router.post("/full", this.createFull.bind(this));
        this.router.get("/document-types", this.getDocumentTypes.bind(this));
        this.router.put("/:id/full", this.updateFull.bind(this));
        this.router.post("/:id/change-class", this.changeClass.bind(this));
        this.router.get("/", this.getAll.bind(this));
        this.router.get("/:id/resume", this.getResume.bind(this));
        this.router.get("/:id/edit", this.getEditPayload.bind(this));
        this.router.post("/:id/validate", this.validateInscription.bind(this));
        this.router.post("/:id/cancel", this.cancelInscription.bind(this));
        this.router.put("/:id/medical", this.updateMedicalProfile.bind(this));
        this.router.put("/:id/school-history", this.updateSchoolHistory.bind(this));
        this.router.get("/:id/documents/:documentId/file", this.downloadDocumentFile.bind(this));
        this.router.get("/:id/files/:linkId", this.downloadLinkedFile.bind(this));
        this.router.post("/:id/documents/:documentId/upload", express.json({ limit: "15mb" }), this.uploadDocument.bind(this));
        this.router.put("/:id/documents/:documentId", this.updateDocument.bind(this));
        this.router.get("/:id", this.getOne.bind(this));
        this.router.delete("/:id", this.delete.bind(this));
        this.router.put("/:id", this.update.bind(this));

        return this.router;
    }

    private async getDocumentTypes(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const tenantId = this.resolveTenantId(req);
            const etablissementId = this.toNullableString(req.query.etablissement_id) ?? tenantId;

            if (etablissementId !== tenantId) {
                return Response.error(
                    res,
                    "Le contexte etablissement de la requete est invalide.",
                    400,
                    new Error("invalid tenant context"),
                );
            }

            const typeInscription = this.normalizeInscriptionType(req.query.type_inscription);
            const documentTypes = await this.prisma.$transaction((tx) =>
                this.resolveInscriptionDocumentTypes(tx, etablissementId, typeInscription),
            );

            Response.success(
                res,
                "Types de documents d'inscription.",
                documentTypes.map((item) => ({
                    id: item.id,
                    code: item.code,
                    nom: item.nom,
                    description: item.description,
                    obligatoire: Boolean(item.est_obligatoire_par_defaut),
                    ordre: item.ordre ?? null,
                })),
            );
        } catch (error) {
            next(error);
        }
    }

    private parseLigneTransportSettings(value: Prisma.JsonValue | null | undefined) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            return {
                zones: [] as string[],
                inscriptions_ouvertes: true,
            };
        }

        const raw = value as Record<string, unknown>;
        const zones = Array.isArray(raw.zones)
            ? raw.zones
                .map((item) => (typeof item === "string" ? item.trim() : ""))
                .filter((item): item is string => Boolean(item))
            : [];

        return {
            zones,
            inscriptions_ouvertes: raw.inscriptions_ouvertes !== false,
        };
    }

    private async create(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const data: Inscription = req.body;

            if (data.eleve_id && data.annee_scolaire_id && data.classe_id) {
                const [eleve, classe] = await Promise.all([
                    this.prisma.eleve.findUnique({
                        where: { id: data.eleve_id },
                        select: { id: true, etablissement_id: true },
                    }),
                    this.prisma.classe.findUnique({
                        where: { id: data.classe_id },
                        select: { id: true, etablissement_id: true, annee_scolaire_id: true },
                    }),
                ]);

                if (
                    eleve &&
                    classe &&
                    eleve.etablissement_id === classe.etablissement_id &&
                    classe.annee_scolaire_id === data.annee_scolaire_id
                ) {
                    await assertNoAdministrativeRestriction(this.prisma, {
                        tenantId: classe.etablissement_id,
                        eleveId: data.eleve_id,
                        anneeScolaireId: data.annee_scolaire_id,
                        type: "REINSCRIPTION",
                    });
                }
            }

            const result = await this.inscription.create(data);
            Response.success(res, "Stablisment creation success.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la creation de l'etablissement", 400, error as Error);        }
    }

    private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const result = await getAllPaginated(req.query, this.inscription);
            Response.success(res, "Stablisment list.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la recuperation des etablissements", 400, error as Error);        }
    }

    private async getResume(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const tenantId = this.resolveTenantId(req);
            const inscriptionId = req.params.id;
            const today = this.startOfDay(new Date());

            const inscription = await this.prisma.inscription.findFirst({
                where: {
                    id: inscriptionId,
                    eleve: {
                        etablissement_id: tenantId,
                    },
                },
                include: {
                    annee: true,
                    historiqueScolaire: true,
                    niveau: true,
                    classe: {
                        include: {
                            niveau: true,
                            site: true,
                        },
                    },
                    eleve: {
                        include: {
                            utilisateur: {
                                include: {
                                    profil: true,
                                },
                            },
                            liensParents: {
                                include: {
                                    parent_tuteur: {
                                        include: {
                                            utilisateur: {
                                                include: {
                                                    profil: true,
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                            identifiants: true,
                            profilMedical: true,
                        },
                    },
                    documents: {
                        include: {
                            documentType: true,
                            fichier: true,
                            verifiePar: {
                                include: {
                                    profil: true,
                                },
                            },
                        },
                    },
                },
            });

            if (!inscription) {
                return Response.error(res, "Inscription introuvable.", 404, new Error("inscription not found"));
            }

            const [classOccupancy, factures, echeances, liensFichiers, planPaiement, documentTypeCount, etablissement, recoveryPolicy] = await Promise.all([
                inscription.classe_id
                    ? this.prisma.inscription.count({
                        where: {
                            classe_id: inscription.classe_id,
                            annee_scolaire_id: inscription.annee_scolaire_id,
                            statut: {
                                not: "SORTI",
                            },
                        },
                    })
                    : Promise.resolve(0),
                this.prisma.facture.findMany({
                    where: {
                        eleve_id: inscription.eleve_id,
                        annee_scolaire_id: inscription.annee_scolaire_id,
                    },
                    include: {
                        lignes: true,
                        remise: true,
                    },
                    orderBy: [{ date_emission: "desc" }, { created_at: "desc" }],
                }),
                this.prisma.echeancePaiement.findMany({
                    where: {
                        eleve_id: inscription.eleve_id,
                        annee_scolaire_id: inscription.annee_scolaire_id,
                    },
                    include: {
                        affectations: {
                            include: {
                                paiement: {
                                    select: {
                                        paye_le: true,
                                    },
                                },
                            },
                        },
                        facture: {
                            select: {
                                id: true,
                                numero_facture: true,
                            },
                        },
                    },
                    orderBy: [{ date_echeance: "asc" }, { ordre: "asc" }],
                }),
                this.prisma.lienFichier.findMany({
                    where: {
                        OR: [
                            { id_entite: inscription.eleve_id },
                            { id_entite: inscriptionId },
                        ],
                    },
                    include: {
                        fichier: true,
                    },
                    orderBy: [{ created_at: "desc" }],
                    take: 20,
                }),
                this.prisma.planPaiementEleve.findFirst({
                    where: {
                        eleve_id: inscription.eleve_id,
                        annee_scolaire_id: inscription.annee_scolaire_id,
                    },
                    orderBy: [{ created_at: "asc" }],
                }),
                this.prisma.documentTypeInscription.count({
                    where: {
                        est_actif: true,
                        OR: [
                            { etablissement_id: tenantId },
                            { etablissement_id: null },
                        ],
                    },
                }),
                this.prisma.etablissement.findUnique({
                    where: { id: tenantId },
                    select: { parametres_json: true },
                }),
                getApprovedRecoveryPolicy(this.prisma, tenantId),
            ]);

            const profile = inscription.eleve.utilisateur?.profil ?? null;
            const medicalProfile = inscription.eleve.profilMedical ?? null;
            const schoolHistory = inscription.historiqueScolaire ?? null;
            const canViewMedical = this.canAccessMedicalData(req);
            const emergencyContact = this.extractJsonObject(profile?.contact_urgence_json);
            const classCapacityState = this.computeClasseCapacityState(inscription.classe?.capacite ?? null, classOccupancy);
            const duplicateCandidates =
                profile?.prenom && profile?.nom && profile?.date_naissance
                    ? await this.prisma.eleve.findMany({
                        where: {
                            etablissement_id: tenantId,
                            id: {
                                not: inscription.eleve_id,
                            },
                        },
                        include: {
                            utilisateur: {
                                include: {
                                    profil: true,
                                },
                            },
                        },
                    })
                    : [];
            const probableDuplicateCount = duplicateCandidates.filter((candidate) => {
                const candidateProfile = candidate.utilisateur?.profil;
                return Boolean(
                    candidateProfile &&
                    candidateProfile.prenom === profile?.prenom &&
                    candidateProfile.nom === profile?.nom &&
                    candidateProfile.date_naissance?.getTime() === profile?.date_naissance?.getTime(),
                );
            }).length;
            const parents = inscription.eleve.liensParents.map((link) => {
                const parentProfile = link.parent_tuteur.utilisateur?.profil ?? null;
                const fullName = [parentProfile?.prenom, parentProfile?.nom]
                    .filter((value) => typeof value === "string" && value.trim())
                    .join(" ")
                    .trim();

                return {
                    id: link.parent_tuteur.id,
                    nom_complet: fullName || link.parent_tuteur.nom_complet || "Responsable",
                    relation: link.relation ?? null,
                    telephone_principal:
                        link.parent_tuteur.telephone ??
                        link.parent_tuteur.utilisateur?.telephone ??
                        null,
                    telephone_secondaire: link.parent_tuteur.telephone_secondaire ?? null,
                    email: link.parent_tuteur.email ?? link.parent_tuteur.utilisateur?.email ?? null,
                    adresse: link.parent_tuteur.adresse ?? null,
                    profession: link.parent_tuteur.profession ?? null,
                    lieu_travail: (link.parent_tuteur as any).lieu_travail ?? null,
                    est_principal: Boolean(link.est_principal),
                    est_responsable_legal: Boolean(link.est_responsable_legal),
                    est_responsable_financier: Boolean(link.est_responsable_financier),
                    est_contact_urgence: Boolean(link.est_contact_urgence),
                    autorise_recuperation: Boolean(link.autorise_recuperation),
                };
            });

            const financeSnapshot = await this.computeInscriptionFinanceSnapshot(this.prisma, {
                eleveId: inscription.eleve_id,
                anneeScolaireId: inscription.annee_scolaire_id,
            });
            const totalFacture = financeSnapshot.totalFacture;
            const totalPaye = financeSnapshot.totalPaye;
            const enrollmentFinanceBreakdown = financeSnapshot.breakdown;
            const resteARegler = financeSnapshot.resteARegler;
            const latestPayment = financeSnapshot.latestPayment;
            const nextDue = echeances.find(
                (echeance) =>
                    this.toMoney(echeance.montant_restant) > 0 &&
                    !["PAYEE", "ANNULEE"].includes((echeance.statut ?? "").toUpperCase()),
            ) ?? null;
            const targetFacture =
                (nextDue?.facture?.id
                    ? factures.find((facture) => facture.id === nextDue.facture?.id) ?? null
                    : null) ??
                factures.find((facture) => (facture.statut ?? "").toUpperCase() !== "ANNULEE") ??
                null;
            const overdueCount = financeSnapshot.overdueCount;
            const financeStatus = financeSnapshot.status;
            const financePolicy = this.resolveEnrollmentFinancePolicy(etablissement?.parametres_json ?? null);
            const minimumPaymentStatus = this.computeEnrollmentMinimumPaymentStatus({
                totalFacture,
                totalPaye,
                policy: financePolicy,
                breakdown: enrollmentFinanceBreakdown,
            });
            const dueSoonPendingCount = echeances.filter((echeance) => {
                const dueDate = this.startOfDay(new Date(String(echeance.date_echeance)));
                const daysUntilDue = this.diffInDays(today, dueDate);
                return (
                    this.toMoney(echeance.montant_restant) > 0 &&
                    daysUntilDue >= 0 &&
                    daysUntilDue <= financePolicy.dueSoonDays
                );
            }).length;
            const documentsConfigured = documentTypeCount > 0;
            const documentsStructured = inscription.documents
                .slice()
                .sort((left, right) => {
                    const leftOrder = left.documentType?.ordre ?? Number.MAX_SAFE_INTEGER;
                    const rightOrder = right.documentType?.ordre ?? Number.MAX_SAFE_INTEGER;
                    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
                    return (left.documentType?.nom ?? "").localeCompare(right.documentType?.nom ?? "", "fr");
                });
            const documentStatus = documentsStructured.length > 0
                ? this.deriveInscriptionDossierStatus(documentsStructured)
                : documentsConfigured
                    ? inscription.statut_dossier
                    : "COMPLET";
            const requiredDocuments = documentsStructured.filter((item) => item.obligatoire);
            const missingDocuments = requiredDocuments.filter(
                (item) => !item.fourni || ["NON_FOURNI", "REJETE", "EXPIRE"].includes((item.statut ?? "").toUpperCase()),
            );
            const pendingVerificationDocuments = documentsStructured.filter((item) =>
                ["FOURNI", "EN_ATTENTE_VERIFICATION"].includes((item.statut ?? "").toUpperCase()),
            );
            const hasImportantMedicalSignal = Boolean(
                canViewMedical &&
                medicalProfile &&
                (
                    this.toNullableString(medicalProfile.allergies) ||
                    this.toNullableString(medicalProfile.maladies_particulieres) ||
                    this.toNullableString(medicalProfile.traitement_medical)
                ),
            );

            const identityScore = this.computeCompletionScore([
                Boolean(inscription.eleve.code_eleve),
                Boolean(profile?.prenom),
                Boolean(profile?.nom),
                Boolean(profile?.date_naissance),
                Boolean(profile?.genre),
                Boolean(profile?.adresse),
            ]);
            const contactsScore = this.computeCompletionScore([
                parents.length > 0,
                parents.some((parent) => Boolean(parent.telephone_principal)),
                Boolean(emergencyContact?.telephone ?? emergencyContact?.phone ?? null),
            ]);
            const schoolScore = this.computeCompletionScore([
                Boolean(inscription.annee?.id),
                Boolean(inscription.niveau?.id ?? inscription.classe?.niveau?.id),
                Boolean(inscription.classe?.id),
            ]);
            const financeScore = this.computeCompletionScore([
                totalFacture > 0,
                latestPayment != null || totalFacture <= 0,
                ["PAYE", "FACTURE", "EXONERE"].includes(financeStatus),
            ]);
            const documentsScore = this.computeDocumentCompletionScore(documentsStructured, documentsConfigured);
            const completionRate = inscription.completion_rate != null
                ? this.toMoney(inscription.completion_rate)
                : Math.round((identityScore + contactsScore + schoolScore + financeScore + documentsScore) / 5);
            const validationState = this.computeInscriptionValidationState({
                dossierStatus: documentStatus,
                financeStatus,
                hasClass: Boolean(inscription.classe?.id),
                hasResponsable: parents.length > 0,
                classOverCapacity: classCapacityState.isOverCapacity,
                minimumPaymentSatisfied: minimumPaymentStatus.satisfied,
                minimumPaymentMissingAmount: minimumPaymentStatus.missingAmount,
            });

            const alerts = [
                !inscription.classe?.id
                    ? {
                        id: "class-missing",
                        type: "SCOLARITE",
                        gravity: "high",
                        message: "L'eleve n'est pas encore affecte a une classe.",
                        actionLabel: "Affecter une classe",
                    }
                    : null,
                inscription.classe?.id && classCapacityState.isOverCapacity
                    ? {
                        id: "class-over-capacity",
                        type: "SCOLARITE",
                        gravity: "high",
                        message: `La classe ${inscription.classe.nom} depasse sa capacite (${classCapacityState.occupancy}/${classCapacityState.capacity}).`,
                        actionLabel: "Revoir les affectations",
                    }
                    : null,
                inscription.classe?.id && !classCapacityState.isOverCapacity && classCapacityState.isFull
                    ? {
                        id: "class-full",
                        type: "SCOLARITE",
                        gravity: "medium",
                        message: `La classe ${inscription.classe.nom} a atteint sa capacite (${classCapacityState.occupancy}/${classCapacityState.capacity}).`,
                        actionLabel: "Surveiller les places",
                    }
                    : null,
                inscription.classe?.id && classCapacityState.isNearlyFull
                    ? {
                        id: "class-nearly-full",
                        type: "SCOLARITE",
                        gravity: "medium",
                        message: `La classe ${inscription.classe.nom} est presque pleine (${classCapacityState.occupancy}/${classCapacityState.capacity}).`,
                        actionLabel: "Anticiper les prochaines affectations",
                    }
                    : null,
                parents.length === 0
                    ? {
                        id: "parent-missing",
                        type: "RESPONSABLE",
                        gravity: "high",
                        message: "Aucun responsable n'est lie a cet eleve.",
                        actionLabel: "Ajouter un responsable",
                    }
                    : null,
                parents.length > 0 && parents.every((parent) => !parent.telephone_principal)
                    ? {
                        id: "parent-phone-missing",
                        type: "RESPONSABLE",
                        gravity: "medium",
                        message: "Aucun numero de telephone n'est renseigne pour les responsables.",
                        actionLabel: "Completer les contacts",
                    }
                    : null,
                parents.length > 0 && !parents.some((parent) => parent.est_responsable_financier)
                    ? {
                        id: "finance-responsible-missing",
                        type: "RESPONSABLE",
                        gravity: "high",
                        message: "Aucun responsable financier n'est defini pour ce dossier.",
                        actionLabel: "Definir un responsable financier",
                    }
                    : null,
                probableDuplicateCount > 0
                    ? {
                        id: "possible-student-duplicate",
                        type: "DOUBLON",
                        gravity: "medium",
                        message: `${probableDuplicateCount} dossier(s) eleve(s) presentent le meme nom, prenom et la meme date de naissance dans l'etablissement.`,
                        actionLabel: "Verifier les doublons",
                    }
                    : null,
                totalFacture <= 0
                    ? {
                        id: "finance-not-initialized",
                        type: "FINANCE",
                        gravity: "medium",
                        message: "La facturation initiale n'est pas encore generee.",
                        actionLabel: "Verifier la facturation",
                    }
                    : null,
                totalFacture > 0 && totalPaye <= 0
                    ? {
                        id: "payment-missing",
                        type: "PAIEMENT",
                        gravity: "high",
                        message: "Aucun paiement n'a encore ete enregistre.",
                        actionLabel: "Enregistrer un paiement",
                    }
                    : null,
                !minimumPaymentStatus.satisfied && minimumPaymentStatus.requiredAmount > 0
                    ? {
                        id: "minimum-payment-missing",
                        type: "PAIEMENT",
                        gravity: "high",
                        message: `Le paiement minimum requis pour valider l'inscription (${this.describeEnrollmentMinimumPaymentPolicy(minimumPaymentStatus.mode)}) n'est pas atteint. Il manque ${this.roundMoney(minimumPaymentStatus.missingAmount)} MGA.`,
                        actionLabel: "Enregistrer un paiement",
                    }
                    : null,
                overdueCount > 0
                    ? {
                        id: "overdue-echelance",
                        type: "ECHEANCE",
                        gravity: "high",
                        message: `${overdueCount} echeance(s) sont deja en retard.`,
                        actionLabel: "Traiter les echeances",
                    }
                    : null,
                dueSoonPendingCount > 0
                    ? {
                        id: "due-soon-echelance",
                        type: "ECHEANCE",
                        gravity: "medium",
                        message: `${dueSoonPendingCount} echeance(s) arrivent a echeance dans les ${financePolicy.dueSoonDays} prochains jours.`,
                        actionLabel: "Planifier le prochain paiement",
                    }
                    : null,
                documentsConfigured && missingDocuments.length > 0
                    ? {
                        id: "documents-missing",
                        type: "DOCUMENT",
                        gravity: "high",
                        message: `${missingDocuments.length} document(s) obligatoire(s) manquent ou doivent etre completes.`,
                        actionLabel: "Ajouter un document",
                    }
                    : null,
                documentsConfigured && pendingVerificationDocuments.length > 0
                    ? {
                        id: "documents-pending",
                        type: "DOCUMENT",
                        gravity: "medium",
                        message: `${pendingVerificationDocuments.length} document(s) attendent encore une verification administrative.`,
                        actionLabel: "Verifier le dossier",
                    }
                    : null,
                !documentsConfigured && liensFichiers.length === 0
                    ? {
                        id: "documents-not-configured",
                        type: "DOCUMENT",
                        gravity: "low",
                        message: "Aucun type de document d'inscription n'est encore configure pour cet etablissement.",
                        actionLabel: "Configurer les documents",
                    }
                    : null,
                hasImportantMedicalSignal
                    ? {
                        id: "medical-important",
                        type: "MEDICAL",
                        gravity: "high",
                        message: "Des informations medicales importantes sont renseignees pour cet eleve. Verifiez allergies, antecedents ou traitement en cours.",
                        actionLabel: "Consulter le profil medical",
                    }
                    : null,
            ].filter(Boolean);

            const quickActions = [
                {
                    id: "return-inscriptions",
                    label: "Retour aux inscriptions",
                    path: "/scolarite/inscriptions",
                    tone: "neutral",
                },
                documentsConfigured
                    ? {
                        id: "manage-documents",
                        label: "Verifier les documents",
                        path: "/scolarite/inscriptions",
                        tone: "neutral",
                    }
                    : null,
                totalFacture > 0 && resteARegler > 0
                    ? {
                        id: "register-payment",
                        label: "Enregistrer un paiement",
                        path: "/finance/paiements",
                        tone: "primary",
                    }
                    : null,
                !inscription.classe?.id
                    ? {
                        id: "assign-class",
                        label: "Affecter a une classe",
                        path: "/scolarite/inscriptions",
                        tone: "warning",
                    }
                    : null,
                !["ANNULEE", "SORTI"].includes((inscription.statut ?? "").toUpperCase())
                    ? {
                        id: "edit-enrollment",
                        label: "Modifier l'inscription",
                        path: `/scolarite/inscriptions/${inscription.id}/edit`,
                        tone: "neutral",
                    }
                    : null,
                {
                    id: "open-student",
                    label: "Voir le dossier eleve",
                    path: `/scolarite/eleves/${inscription.eleve.id}/dossier`,
                    tone: "neutral",
                },
            ].filter(Boolean);

            Response.success(res, "Resume d'inscription charge.", {
                inscription: {
                    id: inscription.id,
                    statut: inscription.statut,
                    type_inscription: inscription.type_inscription,
                    statut_administratif: inscription.statut_administratif,
                    statut_financier: financeStatus,
                    statut_dossier: documentStatus,
                    date_inscription: inscription.date_inscription,
                    validation_date: inscription.validation_date,
                    date_sortie: inscription.date_sortie,
                    raison_sortie: inscription.raison_sortie,
                    completion_rate: completionRate,
                    can_validate: validationState.can_validate,
                    validation_blockers: validationState.reasons,
                    operational_status:
                        alerts.length > 0 ? "ACTION_REQUISE" : financeStatus === "PAYE" ? "PRET" : "EN_SUIVI",
                },
                eleve: {
                    id: inscription.eleve.id,
                    code_eleve: inscription.eleve.code_eleve,
                    statut: inscription.eleve.statut,
                    date_entree: inscription.eleve.date_entree,
                    prenom: profile?.prenom ?? null,
                    nom: profile?.nom ?? null,
                    date_naissance: profile?.date_naissance ?? null,
                    lieu_naissance: profile?.lieu_naissance ?? null,
                    nationalite: profile?.nationalite ?? null,
                    genre: profile?.genre ?? null,
                    photo_url: profile?.photo_url ?? null,
                    adresse: profile?.adresse ?? null,
                    telephone: profile?.telephone_personnel ?? inscription.eleve.utilisateur?.telephone ?? null,
                    email: profile?.email_personnel ?? inscription.eleve.utilisateur?.email ?? null,
                    contact_urgence: emergencyContact,
                    identifiants: inscription.eleve.identifiants.map((item) => ({
                        id: item.id,
                        type: item.type,
                        valeur: item.valeur,
                    })),
                },
                scolarite: {
                    annee: inscription.annee
                        ? {
                            id: inscription.annee.id,
                            nom: inscription.annee.nom,
                            date_debut: inscription.annee.date_debut,
                            date_fin: inscription.annee.date_fin,
                            est_active: inscription.annee.est_active,
                        }
                        : null,
                    niveau: inscription.niveau || inscription.classe?.niveau
                        ? {
                            id: inscription.niveau?.id ?? inscription.classe?.niveau?.id ?? null,
                            nom: inscription.niveau?.nom ?? inscription.classe?.niveau?.nom ?? null,
                        }
                        : null,
                    classe: inscription.classe
                        ? {
                            id: inscription.classe.id,
                            nom: inscription.classe.nom,
                            site: inscription.classe.site?.nom ?? null,
                            niveau: inscription.classe.niveau?.nom ?? null,
                            occupancy: classOccupancy,
                            capacity: classCapacityState.capacity,
                            remaining: classCapacityState.placesRemaining,
                            occupancy_rate: classCapacityState.occupancyRate,
                            is_full: classCapacityState.isFull,
                            is_nearly_full: classCapacityState.isNearlyFull,
                        }
                        : null,
                },
                responsables: parents,
                finance: {
                    target_facture_id: targetFacture?.id ?? null,
                    plan_paiement_id: planPaiement?.id ?? null,
                    total_facture: totalFacture,
                    total_paye: totalPaye,
                    reste_a_payer: resteARegler,
                    statut: financeStatus,
                    minimum_payment_rule: {
                        mode: minimumPaymentStatus.mode,
                        value: minimumPaymentStatus.value,
                        required_amount: minimumPaymentStatus.requiredAmount,
                        missing_amount: minimumPaymentStatus.missingAmount,
                        satisfied: minimumPaymentStatus.satisfied,
                        registration_fee_amount: enrollmentFinanceBreakdown.registrationFeeAmount,
                        first_school_installment_amount: enrollmentFinanceBreakdown.firstSchoolInstallmentAmount,
                    },
                    due_soon_threshold_days: financePolicy.dueSoonDays,
                    estimated_overdue_penalty_total: this.roundMoney(
                        echeances.reduce((sum, item) => {
                            const dueDate = this.startOfDay(new Date(String(item.date_echeance)));
                            const penalty = calculateRecoveryPenalty({
                                policy: recoveryPolicy,
                                overdueAmount: this.toMoney(item.montant_restant),
                                dueDate,
                                paymentDate: today,
                            });
                            return sum + penalty;
                        }, 0),
                    ),
                    nombre_factures: factures.filter((facture) => (facture.statut ?? "").toUpperCase() !== "ANNULEE").length,
                    dernier_paiement: latestPayment
                        ? {
                            id: latestPayment.id,
                            montant: this.toMoney(latestPayment.montant),
                            date: latestPayment.paye_le,
                            methode: latestPayment.methode,
                            numero_recu: latestPayment.numero_recu,
                        }
                        : null,
                    prochaine_echeance: nextDue
                        ? {
                            id: nextDue.id,
                            libelle: nextDue.libelle,
                            date_echeance: nextDue.date_echeance,
                            montant_prevu: this.toMoney(nextDue.montant_prevu),
                            montant_restant: this.toMoney(nextDue.montant_restant),
                            statut: nextDue.statut,
                            jours_avant_echeance: this.diffInDays(today, this.startOfDay(new Date(String(nextDue.date_echeance)))),
                            facture_numero: nextDue.facture?.numero_facture ?? null,
                        }
                        : null,
                    echeances: echeances.map((item) => {
                        const dueDate = this.startOfDay(new Date(String(item.date_echeance)));
                        const latestAllocationPayment = item.affectations
                            .map((affectation) => affectation.paiement?.paye_le ?? null)
                            .filter((value): value is Date => value instanceof Date)
                            .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
                        const paymentReferenceDate = latestAllocationPayment
                            ? this.startOfDay(new Date(latestAllocationPayment))
                            : today;
                        const daysLate =
                            paymentReferenceDate.getTime() > dueDate.getTime()
                                ? this.diffInDays(dueDate, paymentReferenceDate)
                                : 0;
                        const estimatedPenalty = calculateRecoveryPenalty({
                            policy: recoveryPolicy,
                            overdueAmount: this.toMoney(item.montant_restant),
                            dueDate,
                            paymentDate: today,
                        });
                        return {
                            id: item.id,
                            ordre: item.ordre,
                            libelle: item.libelle,
                            date_echeance: item.date_echeance,
                            montant_prevu: this.toMoney(item.montant_prevu),
                            montant_regle: this.toMoney(item.montant_regle),
                            montant_restant: this.toMoney(item.montant_restant),
                            statut: item.statut,
                            date_paiement: latestAllocationPayment,
                            retard_jours: daysLate,
                            penalite_estimee: estimatedPenalty,
                            facture_numero: item.facture?.numero_facture ?? null,
                        };
                    }),
                },
                documents: {
                    supported: documentsConfigured,
                    status: documentsConfigured ? documentStatus : "NON_CONFIGURE",
                    note: documentsConfigured
                        ? missingDocuments.length > 0
                            ? "Certains documents obligatoires restent a fournir ou a corriger."
                            : pendingVerificationDocuments.length > 0
                                ? "Le dossier documentaire est complet, mais attend encore une verification."
                                : "Le dossier documentaire est initialise et suit le workflow d'inscription."
                        : "Aucun type de document d'inscription n'est configure pour cet etablissement.",
                    items: documentsStructured.map((item) => ({
                        id: item.id,
                        code: item.documentType.code,
                        nom: item.documentType.nom,
                        description: item.documentType.description,
                        obligatoire: item.obligatoire,
                        fourni: item.fourni,
                        statut: item.statut,
                        date_depot: item.date_depot,
                        date_verification: item.date_verification,
                        commentaire_admin: item.commentaire_admin,
                        fichier: item.fichier
                            ? {
                                id: item.fichier.id,
                                chemin: item.fichier.chemin,
                                nom_fichier: this.getStoredFileName(item.fichier.chemin),
                                type_mime: item.fichier.type_mime,
                                televerse_le: item.fichier.televerse_le,
                            }
                            : null,
                    })),
                    linked_files: liensFichiers.map((item) => ({
                        id: item.id,
                        type_entite: item.type_entite,
                        tag: item.tag,
                        fichier_id: item.fichier_id,
                        chemin: item.fichier?.chemin ?? null,
                        nom_fichier: this.getStoredFileName(item.fichier?.chemin ?? null),
                        type_mime: item.fichier?.type_mime ?? null,
                        televerse_le: item.fichier?.televerse_le ?? null,
                    })),
                },
                medical: {
                    supported: true,
                    authorized: canViewMedical,
                    editable: canViewMedical,
                    note: canViewMedical
                        ? hasImportantMedicalSignal
                            ? "Des informations medicales sensibles sont renseignees pour cet eleve."
                            : "Aucun signal medical critique n'a ete releve dans ce dossier."
                        : "Les informations medicales sont masquees pour ce profil.",
                    data: canViewMedical
                        ? {
                            groupe_sanguin: medicalProfile?.groupe_sanguin ?? null,
                            allergies: medicalProfile?.allergies ?? null,
                            maladies_particulieres: medicalProfile?.maladies_particulieres ?? null,
                            traitement_medical: medicalProfile?.traitement_medical ?? null,
                            medecin_traitant: medicalProfile?.medecin_traitant ?? null,
                            telephone_medecin: medicalProfile?.telephone_medecin ?? null,
                            autorisation_prise_en_charge_medicale:
                                medicalProfile?.autorisation_prise_en_charge_medicale ?? false,
                            personne_a_contacter_urgence: medicalProfile?.personne_a_contacter_urgence ?? null,
                            telephone_urgence: medicalProfile?.telephone_urgence ?? null,
                        }
                        : null,
                },
                school_history: {
                    supported: true,
                    editable: true,
                    note: schoolHistory
                        ? "L'historique scolaire precedent est renseigne sur cette inscription."
                        : "Aucun historique scolaire precedent n'a encore ete saisi.",
                    data: schoolHistory
                        ? {
                            ancien_etablissement: schoolHistory.ancien_etablissement,
                            ancienne_classe: schoolHistory.ancienne_classe,
                            annee_precedente: schoolHistory.annee_precedente,
                            derniere_moyenne: schoolHistory.derniere_moyenne != null
                                ? this.toMoney(schoolHistory.derniere_moyenne)
                                : null,
                            decision_precedente: schoolHistory.decision_precedente,
                            mention_precedente: schoolHistory.mention_precedente,
                            motif_transfert: schoolHistory.motif_transfert,
                            observations: schoolHistory.observations,
                            reprise_auto: schoolHistory.reprise_auto,
                        }
                        : null,
                },
                alerts,
                quick_actions: quickActions,
            });
        } catch (error) {
            next(error);
        }
    }

    private async updateMedicalProfile(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            if (!this.canAccessMedicalData(req)) {
                return Response.error(
                    res,
                    "Vous n'etes pas autorise a consulter ou modifier les informations medicales.",
                    403,
                    new Error("medical access denied"),
                );
            }

            const tenantId = this.resolveTenantId(req);
            const inscriptionId = req.params.id;
            const payload = this.normalizeMedicalProfilePayload(req.body);

            const result = await this.prisma.$transaction(async (tx) => {
                const inscription = await tx.inscription.findFirst({
                    where: {
                        id: inscriptionId,
                        eleve: {
                            etablissement_id: tenantId,
                        },
                    },
                    select: {
                        id: true,
                        eleve_id: true,
                    },
                });

                if (!inscription) {
                    throw new Error("Inscription introuvable.");
                }

                const medicalProfile = await tx.eleveMedicalProfile.upsert({
                    where: {
                        eleve_id: inscription.eleve_id,
                    },
                    create: {
                        eleve_id: inscription.eleve_id,
                        ...payload,
                    },
                    update: payload,
                });

                await tx.journalAudit.create({
                    data: {
                        etablissement_id: tenantId,
                        acteur_utilisateur_id: this.getRequestUserId(req),
                        action: "INSCRIPTION_MEDICAL_PROFILE_UPSERT",
                        type_entite: "ELEVE_MEDICAL_PROFILE",
                        id_entite: medicalProfile.id,
                        apres_json: {
                            inscription_id: inscription.id,
                            eleve_id: inscription.eleve_id,
                            ...payload,
                        } as Prisma.InputJsonValue,
                    },
                });

                return medicalProfile;
            });

            Response.success(res, "Profil medical mis a jour.", result);
        } catch (error) {
            next(error);
        }
    }

    private async updateSchoolHistory(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const tenantId = this.resolveTenantId(req);
            const inscriptionId = req.params.id;
            const payload = this.normalizeSchoolHistoryPayload(req.body);

            const result = await this.prisma.$transaction(async (tx) => {
                const inscription = await tx.inscription.findFirst({
                    where: {
                        id: inscriptionId,
                        eleve: {
                            etablissement_id: tenantId,
                        },
                    },
                    select: {
                        id: true,
                        eleve_id: true,
                    },
                });

                if (!inscription) {
                    throw new Error("Inscription introuvable.");
                }

                const schoolHistory = await tx.inscriptionSchoolHistory.upsert({
                    where: {
                        inscription_id: inscription.id,
                    },
                    create: {
                        inscription_id: inscription.id,
                        ...payload,
                    },
                    update: payload,
                });

                await tx.journalAudit.create({
                    data: {
                        etablissement_id: tenantId,
                        acteur_utilisateur_id: this.getRequestUserId(req),
                        action: "INSCRIPTION_SCHOOL_HISTORY_UPSERT",
                        type_entite: "INSCRIPTION_SCHOOL_HISTORY",
                        id_entite: schoolHistory.id,
                        apres_json: {
                            inscription_id: inscription.id,
                            eleve_id: inscription.eleve_id,
                            ...payload,
                        } as Prisma.InputJsonValue,
                    },
                });

                return schoolHistory;
            });

            Response.success(res, "Historique scolaire mis a jour.", result);
        } catch (error) {
            next(error);
        }
    }

    private async getEditPayload(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const tenantId = this.resolveTenantId(req);
            const inscriptionId = req.params.id;

            const inscription = await this.prisma.inscription.findFirst({
                where: {
                    id: inscriptionId,
                    eleve: {
                        etablissement_id: tenantId,
                    },
                },
                include: {
                    annee: true,
                    historiqueScolaire: true,
                    niveau: true,
                    classe: {
                        include: {
                            niveau: true,
                            site: true,
                        },
                    },
                    eleve: {
                        include: {
                            utilisateur: {
                                include: {
                                    profil: true,
                                },
                            },
                            liensParents: {
                                include: {
                                    parent_tuteur: {
                                        include: {
                                            utilisateur: {
                                                include: {
                                                    profil: true,
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                            profilMedical: true,
                        },
                    },
                },
            });

            if (!inscription) {
                return Response.error(res, "Inscription introuvable.", 404, new Error("inscription not found"));
            }

            const profil = inscription.eleve.utilisateur?.profil ?? null;
            const emergencyContact = this.extractJsonObject(profil?.contact_urgence_json);
            const sortedTutors = [...(inscription.eleve.liensParents ?? [])].sort((left, right) => {
                const leftScore =
                    (left.est_principal ? 4 : 0) +
                    (left.est_responsable_legal ? 2 : 0) +
                    (left.est_responsable_financier ? 1 : 0);
                const rightScore =
                    (right.est_principal ? 4 : 0) +
                    (right.est_responsable_legal ? 2 : 0) +
                    (right.est_responsable_financier ? 1 : 0);
                return rightScore - leftScore;
            });

            const mapTutorToForm = (link?: (typeof sortedTutors)[number] | null) => {
                if (!link) {
                    return {
                        parent_tuteur_id: "",
                        nom: "",
                        prenom: "",
                        telephone: "",
                        telephone_secondaire: "",
                        email: "",
                        adresse: "",
                        profession: "",
                        lieu_travail: "",
                        relation: "",
                        est_principal: false,
                        est_responsable_legal: false,
                        est_responsable_financier: false,
                        est_contact_urgence: false,
                        autorise_recuperation: true,
                    };
                }

                const parentProfile = link.parent_tuteur.utilisateur?.profil ?? null;
                return {
                    parent_tuteur_id: link.parent_tuteur.id,
                    nom: parentProfile?.nom ?? "",
                    prenom: parentProfile?.prenom ?? "",
                    telephone:
                        link.parent_tuteur.telephone ??
                        link.parent_tuteur.utilisateur?.telephone ??
                        "",
                    telephone_secondaire: link.parent_tuteur.telephone_secondaire ?? "",
                    email:
                        link.parent_tuteur.email ??
                        link.parent_tuteur.utilisateur?.email ??
                        "",
                    adresse: link.parent_tuteur.adresse ?? "",
                    profession: link.parent_tuteur.profession ?? "",
                    lieu_travail: (link.parent_tuteur as any).lieu_travail ?? "",
                    relation: link.relation ?? "",
                    est_principal: Boolean(link.est_principal),
                    est_responsable_legal: Boolean(link.est_responsable_legal),
                    est_responsable_financier: Boolean(link.est_responsable_financier),
                    est_contact_urgence: Boolean(link.est_contact_urgence),
                    autorise_recuperation: Boolean(link.autorise_recuperation),
                };
            };

            Response.success(res, "Donnees d'edition de l'inscription chargees.", {
                eleve: {
                    prenom: profil?.prenom ?? "",
                    nom: profil?.nom ?? "",
                    date_naissance: profil?.date_naissance ?? null,
                    lieu_naissance: profil?.lieu_naissance ?? "",
                    nationalite: profil?.nationalite ?? "",
                    genre: profil?.genre ?? "",
                    photo_url: profil?.photo_url ?? "",
                    adresse: profil?.adresse ?? "",
                    telephone_eleve: profil?.telephone_personnel ?? inscription.eleve.utilisateur?.telephone ?? "",
                    email_eleve: profil?.email_personnel ?? inscription.eleve.utilisateur?.email ?? "",
                    contact_urgence_nom:
                        this.toNullableString(emergencyContact?.nom) ??
                        this.toNullableString(emergencyContact?.name) ??
                        "",
                    contact_urgence_telephone:
                        this.toNullableString(emergencyContact?.telephone) ??
                        this.toNullableString(emergencyContact?.phone) ??
                        "",
                    contact_urgence_relation:
                        this.toNullableString(emergencyContact?.relation) ??
                        "",
                },
                scolarite: {
                    code_eleve: inscription.eleve.code_eleve ?? "",
                    niveau_scolaire_id: inscription.niveau_scolaire_id ?? inscription.classe?.niveau_scolaire_id ?? "",
                    date_entree: inscription.eleve.date_entree ?? null,
                    date_inscription: inscription.date_inscription,
                    statut_inscription: inscription.statut,
                    type_inscription: inscription.type_inscription ?? "NOUVELLE_INSCRIPTION",
                },
                current_classe: inscription.classe
                    ? {
                        id: inscription.classe.id,
                        nom: inscription.classe.nom,
                        niveau: inscription.classe.niveau?.nom ?? inscription.niveau?.nom ?? null,
                        site: inscription.classe.site?.nom ?? null,
                    }
                    : null,
                tuteur1: mapTutorToForm(sortedTutors[0] ?? null),
                tuteur2: mapTutorToForm(sortedTutors[1] ?? null),
                medical: {
                    groupe_sanguin: inscription.eleve.profilMedical?.groupe_sanguin ?? "",
                    allergies: inscription.eleve.profilMedical?.allergies ?? "",
                    maladies_particulieres: inscription.eleve.profilMedical?.maladies_particulieres ?? "",
                    traitement_medical: inscription.eleve.profilMedical?.traitement_medical ?? "",
                    medecin_traitant: inscription.eleve.profilMedical?.medecin_traitant ?? "",
                    telephone_medecin: inscription.eleve.profilMedical?.telephone_medecin ?? "",
                    autorisation_prise_en_charge_medicale: Boolean(
                        inscription.eleve.profilMedical?.autorisation_prise_en_charge_medicale,
                    ),
                    personne_a_contacter_urgence:
                        inscription.eleve.profilMedical?.personne_a_contacter_urgence ?? "",
                    telephone_urgence: inscription.eleve.profilMedical?.telephone_urgence ?? "",
                },
                historique_scolaire: {
                    ancien_etablissement: inscription.historiqueScolaire?.ancien_etablissement ?? "",
                    ancienne_classe: inscription.historiqueScolaire?.ancienne_classe ?? "",
                    annee_precedente: inscription.historiqueScolaire?.annee_precedente ?? "",
                    derniere_moyenne: inscription.historiqueScolaire?.derniere_moyenne ?? null,
                    decision_precedente: inscription.historiqueScolaire?.decision_precedente ?? "",
                    mention_precedente: inscription.historiqueScolaire?.mention_precedente ?? "",
                    motif_transfert: inscription.historiqueScolaire?.motif_transfert ?? "",
                    observations: inscription.historiqueScolaire?.observations ?? "",
                    reprise_auto: Boolean(inscription.historiqueScolaire?.reprise_auto),
                },
                acces_systeme: this.extractJsonObject(inscription.acces_systeme_json) ?? {},
                consentements: this.extractJsonObject(inscription.consentements_json) ?? {},
                observations: this.extractJsonObject(inscription.observations_json) ?? {},
            });
        } catch (error) {
            next(error);
        }
    }

    private async updateFull(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const tenantId = this.resolveTenantId(req);
            const inscriptionId = req.params.id;
            const {
                eleve,
                scolarite,
                tuteurs = [],
                medical,
                historique_scolaire,
                acces_systeme,
                consentements,
                observations,
            } = req.body as any;

            const result = await this.prisma.$transaction(async (tx) => {
                const inscription = await tx.inscription.findFirst({
                    where: {
                        id: inscriptionId,
                        eleve: {
                            etablissement_id: tenantId,
                        },
                    },
                    include: {
                        eleve: {
                            include: {
                                utilisateur: {
                                    include: {
                                        profil: true,
                                    },
                                },
                                liensParents: {
                                    include: {
                                        parent_tuteur: {
                                            include: {
                                                utilisateur: {
                                                    include: {
                                                        profil: true,
                                                    },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        historiqueScolaire: true,
                    },
                });

                if (!inscription) {
                    throw new Error("Inscription introuvable.");
                }

                const requestedClasseId = this.toNullableString(scolarite?.classe_id);
                if (requestedClasseId && requestedClasseId !== inscription.classe_id) {
                    throw new Error("Pour modifier la classe, utilisez l'action dediee de changement de classe depuis le resume.");
                }

                const normalizedRequestedStatus = this.normalizeInscriptionStatus(scolarite?.statut_inscription);
                if (["ANNULEE", "SORTI"].includes(normalizedRequestedStatus)) {
                    throw new Error("Utilisez l'action dediee pour annuler ou cloturer une inscription.");
                }

                const normalizedCodeEleve = this.toNullableString(scolarite?.code_eleve);
                if (normalizedCodeEleve && normalizedCodeEleve !== inscription.eleve.code_eleve) {
                    const duplicateCode = await tx.eleve.findFirst({
                        where: {
                            etablissement_id: tenantId,
                            code_eleve: normalizedCodeEleve,
                            id: {
                                not: inscription.eleve_id,
                            },
                        },
                        select: { id: true },
                    });

                    if (duplicateCode) {
                        throw new Error("Le matricule existe deja.");
                    }
                }

                if (inscription.eleve.utilisateur_id) {
                    await tx.profil.upsert({
                        where: {
                            utilisateur_id: inscription.eleve.utilisateur_id,
                        },
                        create: {
                            utilisateur_id: inscription.eleve.utilisateur_id,
                            prenom: this.toNullableString(eleve?.prenom) ?? "",
                            nom: this.toNullableString(eleve?.nom) ?? "",
                            date_naissance: this.parseOptionalDate(eleve?.date_naissance),
                            lieu_naissance: this.toNullableString(eleve?.lieu_naissance),
                            nationalite: this.toNullableString(eleve?.nationalite),
                            genre: this.toNullableString(eleve?.genre),
                            photo_url:
                                this.toNullableString(eleve?.photo_url) ??
                                inscription.eleve.utilisateur?.profil?.photo_url ??
                                null,
                            adresse: this.toNullableString(eleve?.adresse),
                            telephone_personnel:
                                this.toNullableString(eleve?.telephone_eleve) ??
                                inscription.eleve.utilisateur?.profil?.telephone_personnel ??
                                null,
                            email_personnel:
                                this.toNullableString(eleve?.email_eleve) ??
                                inscription.eleve.utilisateur?.profil?.email_personnel ??
                                null,
                            contact_urgence_json:
                                eleve?.contact_urgence_json != null
                                    ? (eleve.contact_urgence_json as Prisma.InputJsonValue)
                                    : Prisma.JsonNull,
                        },
                        update: {
                            prenom:
                                this.toNullableString(eleve?.prenom) ??
                                inscription.eleve.utilisateur?.profil?.prenom ??
                                "",
                            nom:
                                this.toNullableString(eleve?.nom) ??
                                inscription.eleve.utilisateur?.profil?.nom ??
                                "",
                            date_naissance: this.parseOptionalDate(eleve?.date_naissance),
                            lieu_naissance: this.toNullableString(eleve?.lieu_naissance),
                            nationalite: this.toNullableString(eleve?.nationalite),
                            genre: this.toNullableString(eleve?.genre),
                            photo_url:
                                this.toNullableString(eleve?.photo_url) ??
                                inscription.eleve.utilisateur?.profil?.photo_url ??
                                null,
                            adresse: this.toNullableString(eleve?.adresse),
                            telephone_personnel: this.toNullableString(eleve?.telephone_eleve),
                            email_personnel: this.toNullableString(eleve?.email_eleve),
                            contact_urgence_json:
                                eleve?.contact_urgence_json != null
                                    ? (eleve.contact_urgence_json as Prisma.InputJsonValue)
                                    : Prisma.JsonNull,
                        },
                    });

                    await tx.utilisateur.update({
                        where: { id: inscription.eleve.utilisateur_id },
                        data: {
                            telephone:
                                this.toNullableString(eleve?.telephone_eleve) ??
                                inscription.eleve.utilisateur?.telephone ??
                                null,
                            email:
                                this.toNullableString(eleve?.email_eleve) ??
                                inscription.eleve.utilisateur?.email ??
                                null,
                        },
                    });
                }

                await tx.eleve.update({
                    where: { id: inscription.eleve_id },
                    data: {
                        code_eleve: normalizedCodeEleve,
                        date_entree: this.parseOptionalDate(scolarite?.date_entree),
                    },
                });

                await tx.inscription.update({
                    where: { id: inscription.id },
                    data: {
                        acces_systeme_json:
                            acces_systeme !== undefined
                                ? ((this.normalizeInscriptionAccessPayload(acces_systeme) as Prisma.InputJsonValue) ?? Prisma.JsonNull)
                                : undefined,
                        consentements_json:
                            consentements !== undefined
                                ? ((this.normalizeInscriptionConsentsPayload(consentements) as Prisma.InputJsonValue) ?? Prisma.JsonNull)
                                : undefined,
                        date_inscription: this.parseOptionalDate(scolarite?.date_inscription) ?? inscription.date_inscription,
                        observations_json:
                            observations !== undefined
                                ? ((this.normalizeInscriptionObservationsPayload(observations, inscription.observations_json) as Prisma.InputJsonValue) ?? Prisma.JsonNull)
                                : undefined,
                        type_inscription: this.normalizeInscriptionType(scolarite?.type_inscription),
                        statut: normalizedRequestedStatus,
                    },
                });

                if (acces_systeme !== undefined && inscription.eleve.utilisateur_id) {
                    const normalizedAccessPayload = this.normalizeInscriptionAccessPayload(acces_systeme);
                    const currentUser = await tx.utilisateur.findUnique({
                        where: { id: inscription.eleve.utilisateur_id },
                        select: {
                            email: true,
                            scope_json: true,
                        },
                    });
                    const currentScopeRoot = this.extractJsonObject(currentUser?.scope_json);
                    const currentAccount = this.getNestedJsonObject(currentScopeRoot, "account");
                    const loginIdentifier =
                        this.toNullableString(normalizedAccessPayload.identifiant_connexion_eleve) ??
                        currentUser?.email ??
                        inscription.eleve.code_eleve ??
                        null;

                    await tx.utilisateur.update({
                        where: { id: inscription.eleve.utilisateur_id },
                        data: {
                            email: loginIdentifier,
                            scope_json: {
                                ...(currentScopeRoot ?? {}),
                                account: {
                                    ...(currentAccount ?? {}),
                                    delivery_method:
                                        this.toNullableString(normalizedAccessPayload.methode_envoi_identifiants) ??
                                        this.toNullableString(currentAccount?.delivery_method),
                                    email: loginIdentifier,
                                    enabled: this.toBool(normalizedAccessPayload.creer_compte_eleve, false),
                                    send_after_validation: this.toBool(
                                        normalizedAccessPayload.envoyer_identifiants_apres_validation,
                                        true,
                                    ),
                                },
                                type: "eleve",
                            } as Prisma.InputJsonValue,
                            statut: this.toBool(normalizedAccessPayload.creer_compte_eleve, false)
                                ? "ACTIF"
                                : "INACTIF",
                        },
                    });
                }

                if (medical !== undefined) {
                    const normalizedMedicalPayload = this.normalizeMedicalProfilePayload(medical);
                    const hasMedicalPayload = Object.values(normalizedMedicalPayload).some((value) => {
                        if (typeof value === "boolean") return value;
                        return value !== null && value !== undefined && value !== "";
                    });

                    if (hasMedicalPayload) {
                        await tx.eleveMedicalProfile.upsert({
                            where: {
                                eleve_id: inscription.eleve_id,
                            },
                            create: {
                                eleve_id: inscription.eleve_id,
                                ...normalizedMedicalPayload,
                            },
                            update: normalizedMedicalPayload,
                        });
                    }
                }

                if (historique_scolaire !== undefined) {
                    const normalizedSchoolHistoryPayload = this.normalizeSchoolHistoryPayload(historique_scolaire);
                    const hasSchoolHistoryPayload = Object.values(normalizedSchoolHistoryPayload).some((value) => {
                        if (typeof value === "boolean") return value;
                        return value !== null && value !== undefined && value !== "";
                    });

                    if (hasSchoolHistoryPayload) {
                        await tx.inscriptionSchoolHistory.upsert({
                            where: {
                                inscription_id: inscription.id,
                            },
                            create: {
                                inscription_id: inscription.id,
                                ...normalizedSchoolHistoryPayload,
                            },
                            update: normalizedSchoolHistoryPayload,
                        });
                    }
                }

                const existingTutorLinks = [...(inscription.eleve.liensParents ?? [])].sort((left, right) => {
                    const leftScore =
                        (left.est_principal ? 4 : 0) +
                        (left.est_responsable_legal ? 2 : 0) +
                        (left.est_responsable_financier ? 1 : 0);
                    const rightScore =
                        (right.est_principal ? 4 : 0) +
                        (right.est_responsable_legal ? 2 : 0) +
                        (right.est_responsable_financier ? 1 : 0);
                    return rightScore - leftScore;
                });
                const editableTutorSlots = existingTutorLinks.slice(0, 2);
                const submittedTutors = Array.isArray(tuteurs)
                    ? tuteurs
                        .filter(
                            (item) =>
                                item &&
                                (
                                    this.toNullableString(item.parent_tuteur_id) ||
                                    this.toNullableString(item.nom) ||
                                    this.toNullableString(item.prenom) ||
                                    this.toNullableString(item.telephone) ||
                                    this.toNullableString(item.email)
                                ),
                        )
                        .slice(0, 2)
                    : [];

                for (let index = 0; index < submittedTutors.length; index += 1) {
                    const rawTutor = submittedTutors[index];
                    const existingSlot = editableTutorSlots[index] ?? null;
                    const parent = await this.findOrCreateParentTuteur(tx, {
                        etablissement_id: tenantId,
                        raw: rawTutor,
                        generatedPassword: generateRandomPassword(9),
                    });

                    if (existingSlot && existingSlot.parent_tuteur_id !== parent.id) {
                        await tx.eleveParentTuteur.deleteMany({
                            where: {
                                eleve_id: inscription.eleve_id,
                                parent_tuteur_id: existingSlot.parent_tuteur_id,
                            },
                        });
                    }

                    const existingLinkForParent = await tx.eleveParentTuteur.findFirst({
                        where: {
                            eleve_id: inscription.eleve_id,
                            parent_tuteur_id: parent.id,
                        },
                    });

                    const baseLinkData = {
                        relation: this.toNullableString(rawTutor?.relation),
                        est_principal: this.toBool(rawTutor?.est_principal, index === 0),
                        est_responsable_legal: this.toBool(rawTutor?.est_responsable_legal, index === 0),
                        est_responsable_financier: this.toBool(rawTutor?.est_responsable_financier, index === 0),
                        est_contact_urgence: this.toBool(rawTutor?.est_contact_urgence, index === 0),
                        autorise_recuperation: this.toBool(rawTutor?.autorise_recuperation, true),
                    };

                    if (existingLinkForParent) {
                        await tx.eleveParentTuteur.update({
                            where: {
                                eleve_id_parent_tuteur_id: {
                                    eleve_id: inscription.eleve_id,
                                    parent_tuteur_id: parent.id,
                                },
                            },
                            data: baseLinkData,
                        });
                    } else {
                        await tx.eleveParentTuteur.create({
                            data: {
                                eleve_id: inscription.eleve_id,
                                parent_tuteur_id: parent.id,
                                ...baseLinkData,
                            },
                        });
                    }
                }

                for (let index = submittedTutors.length; index < editableTutorSlots.length; index += 1) {
                    const slot = editableTutorSlots[index];
                    await tx.eleveParentTuteur.deleteMany({
                        where: {
                            eleve_id: inscription.eleve_id,
                            parent_tuteur_id: slot.parent_tuteur_id,
                        },
                    });
                }

                const refreshedInscription = await this.refreshInscriptionDerivedState(tx, inscription.id);

                await tx.journalAudit.create({
                    data: {
                        etablissement_id: tenantId,
                        acteur_utilisateur_id: this.getRequestUserId(req),
                        action: "INSCRIPTION_UPDATE_FULL",
                        type_entite: "INSCRIPTION",
                        id_entite: refreshedInscription.id,
                        apres_json: {
                            inscription_id: refreshedInscription.id,
                            eleve_id: inscription.eleve_id,
                            statut: refreshedInscription.statut,
                            statut_administratif: refreshedInscription.statut_administratif,
                            statut_financier: refreshedInscription.statut_financier,
                            statut_dossier: refreshedInscription.statut_dossier,
                            completion_rate: this.toMoney(refreshedInscription.completion_rate),
                        } as Prisma.InputJsonValue,
                    },
                });

                return refreshedInscription;
            });

            Response.success(res, "Inscription mise a jour avec succes.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la mise a jour complete de l'inscription", 400, error as Error);
        }
    }

    private async validateInscription(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const tenantId = this.resolveTenantId(req);
            const inscriptionId = req.params.id;

            const result = await this.prisma.$transaction(async (tx) => {
                const inscription = await tx.inscription.findFirst({
                    where: {
                        id: inscriptionId,
                        eleve: {
                            etablissement_id: tenantId,
                        },
                    },
                    include: {
                        eleve: {
                            include: {
                                liensParents: true,
                            },
                        },
                        documents: true,
                    },
                });

                if (!inscription) {
                    throw new Error("Inscription introuvable.");
                }

                const refreshedInscription = await this.refreshInscriptionDerivedState(tx, inscription.id);
                const financeSnapshot = await this.computeInscriptionFinanceSnapshot(tx, {
                    eleveId: inscription.eleve_id,
                    anneeScolaireId: inscription.annee_scolaire_id,
                });
                const etablissement = await tx.etablissement.findUnique({
                    where: { id: tenantId },
                    select: { parametres_json: true },
                });
                const financePolicy = this.resolveEnrollmentFinancePolicy(etablissement?.parametres_json ?? null);
                const minimumPaymentStatus = this.computeEnrollmentMinimumPaymentStatus({
                    totalFacture: financeSnapshot.totalFacture,
                    totalPaye: financeSnapshot.totalPaye,
                    policy: financePolicy,
                    breakdown: financeSnapshot.breakdown,
                });
                const classOccupancy = refreshedInscription.classe_id
                    ? await this.countClasseOccupancy(tx, {
                        classeId: refreshedInscription.classe_id,
                        anneeScolaireId: refreshedInscription.annee_scolaire_id,
                    })
                    : 0;
                const classeRecord = refreshedInscription.classe_id
                    ? await tx.classe.findUnique({
                        where: { id: refreshedInscription.classe_id },
                        select: { capacite: true },
                    })
                    : null;
                const classCapacityState = this.computeClasseCapacityState(classeRecord?.capacite ?? null, classOccupancy);
                const validationState = this.computeInscriptionValidationState({
                    dossierStatus: refreshedInscription.statut_dossier,
                    financeStatus: refreshedInscription.statut_financier,
                    hasClass: Boolean(refreshedInscription.classe_id),
                    hasResponsable: inscription.eleve.liensParents.length > 0,
                    classOverCapacity: classCapacityState.isOverCapacity,
                    minimumPaymentSatisfied: minimumPaymentStatus.satisfied,
                    minimumPaymentMissingAmount: minimumPaymentStatus.missingAmount,
                });

                if (!validationState.can_validate) {
                    throw new Error(
                        validationState.reasons.length > 0
                            ? `Impossible de valider l'inscription : ${validationState.reasons.join(" ")}`
                            : "Impossible de valider l'inscription.",
                    );
                }

                const validatedInscription = await tx.inscription.update({
                    where: { id: inscription.id },
                    data: {
                        statut: "VALIDEE",
                        statut_administratif: "VALIDE",
                        validation_date: new Date(),
                    },
                });

                await tx.journalAudit.create({
                    data: {
                        etablissement_id: tenantId,
                        acteur_utilisateur_id: this.getRequestUserId(req),
                        action: "INSCRIPTION_VALIDATE",
                        type_entite: "INSCRIPTION",
                        id_entite: validatedInscription.id,
                        apres_json: {
                            inscription_id: validatedInscription.id,
                            statut: validatedInscription.statut,
                            statut_administratif: validatedInscription.statut_administratif,
                            validation_date: validatedInscription.validation_date,
                        } as Prisma.InputJsonValue,
                    },
                });

                return validatedInscription;
            });

            Response.success(res, "Inscription validee avec succes.", result);
        } catch (error) {
            next(error);
        }
    }

    private async cancelInscription(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const tenantId = this.resolveTenantId(req);
            const inscriptionId = req.params.id;
            const reason =
                typeof req.body?.reason === "string" && req.body.reason.trim()
                    ? req.body.reason.trim()
                    : "Annulation effectuee depuis le resume d'inscription.";
            const cancellationDate = this.parseOptionalDate(req.body?.date_sortie) ?? new Date();

            const result = await this.prisma.$transaction(async (tx) => {
                const inscription = await tx.inscription.findFirst({
                    where: {
                        id: inscriptionId,
                        eleve: {
                            etablissement_id: tenantId,
                        },
                    },
                    select: {
                        id: true,
                        statut: true,
                        statut_administratif: true,
                        date_sortie: true,
                        raison_sortie: true,
                    },
                });

                if (!inscription) {
                    throw new Error("Inscription introuvable.");
                }

                const alreadyCancelled = this.normalizeInscriptionStatus(inscription.statut) === "ANNULEE";
                const updatedInscription = alreadyCancelled
                    ? inscription
                    : await tx.inscription.update({
                        where: { id: inscription.id },
                        data: {
                            statut: "ANNULEE",
                            statut_administratif: "ANNULE",
                            validation_date: null,
                            date_sortie: cancellationDate,
                            raison_sortie: reason,
                        },
                    });

                await tx.journalAudit.create({
                    data: {
                        etablissement_id: tenantId,
                        acteur_utilisateur_id: this.getRequestUserId(req),
                        action: alreadyCancelled ? "INSCRIPTION_CANCEL_SKIPPED" : "INSCRIPTION_CANCEL",
                        type_entite: "INSCRIPTION",
                        id_entite: inscription.id,
                        apres_json: {
                            inscription_id: inscription.id,
                            statut: updatedInscription.statut,
                            statut_administratif: updatedInscription.statut_administratif,
                            date_sortie: updatedInscription.date_sortie,
                            raison_sortie: updatedInscription.raison_sortie,
                        } as Prisma.InputJsonValue,
                    },
                });

                return updatedInscription;
            });

            Response.success(
                res,
                this.normalizeInscriptionStatus(result.statut) === "ANNULEE"
                    ? "Inscription annulee avec succes."
                    : "Inscription deja annulee.",
                result,
            );
        } catch (error) {
            next(error);
        }
    }

    private async downloadDocumentFile(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const tenantId = this.resolveTenantId(req);
            const inscriptionId = req.params.id;
            const documentId = req.params.documentId;

            const document = await this.prisma.inscriptionDocument.findFirst({
                where: {
                    id: documentId,
                    inscription_id: inscriptionId,
                    inscription: {
                        eleve: {
                            etablissement_id: tenantId,
                        },
                    },
                },
                include: {
                    fichier: true,
                },
            });

            if (!document?.fichier) {
                return Response.error(res, "Aucun fichier n'est lie a ce document.", 404, new Error("document file not found"));
            }

            await this.sendStoredFile(res, document.fichier.chemin, document.fichier.type_mime, req.query.download);
        } catch (error) {
            next(error);
        }
    }

    private async downloadLinkedFile(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const tenantId = this.resolveTenantId(req);
            const inscriptionId = req.params.id;
            const linkId = req.params.linkId;

            const inscription = await this.prisma.inscription.findFirst({
                where: {
                    id: inscriptionId,
                    eleve: {
                        etablissement_id: tenantId,
                    },
                },
                select: {
                    id: true,
                    eleve_id: true,
                },
            });

            if (!inscription) {
                return Response.error(res, "Inscription introuvable.", 404, new Error("inscription not found"));
            }

            const linkedFile = await this.prisma.lienFichier.findFirst({
                where: {
                    id: linkId,
                    OR: [
                        { id_entite: inscription.id },
                        { id_entite: inscription.eleve_id },
                    ],
                },
                include: {
                    fichier: true,
                },
            });

            if (!linkedFile?.fichier) {
                return Response.error(res, "Piece jointe introuvable.", 404, new Error("linked file not found"));
            }

            await this.sendStoredFile(res, linkedFile.fichier.chemin, linkedFile.fichier.type_mime, req.query.download);
        } catch (error) {
            next(error);
        }
    }

    private async uploadDocument(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const tenantId = this.resolveTenantId(req);
            const inscriptionId = req.params.id;
            const documentId = req.params.documentId;

            const existingDocument = await this.prisma.inscriptionDocument.findFirst({
                where: {
                    id: documentId,
                    inscription_id: inscriptionId,
                    inscription: {
                        eleve: {
                            etablissement_id: tenantId,
                        },
                    },
                },
                include: {
                    inscription: true,
                    documentType: true,
                    fichier: true,
                },
            });

            if (!existingDocument) {
                return Response.error(res, "Document d'inscription introuvable.", 404, new Error("document not found"));
            }

            const fileName = this.toNullableString(req.body?.file_name);
            const mimeType = this.toNullableString(req.body?.mime_type);
            const contentBase64 = this.toNullableString(req.body?.content_base64);
            const commentaireAdmin = this.toNullableString(req.body?.commentaire_admin);

            if (!fileName || !contentBase64) {
                return Response.error(res, "file_name et content_base64 sont obligatoires.", 400, new Error());
            }

            const fileBuffer = this.decodeBase64File(contentBase64);
            if (fileBuffer.length === 0) {
                return Response.error(res, "Le fichier transmis est vide.", 400, new Error());
            }
            if (fileBuffer.length > 10 * 1024 * 1024) {
                return Response.error(res, "Le fichier depasse la limite de 10 Mo.", 400, new Error());
            }

            const storageDirectory = path.resolve(
                process.cwd(),
                "storage",
                "inscriptions",
                tenantId,
                inscriptionId,
            );
            await fs.mkdir(storageDirectory, { recursive: true });

            const storedFileName = this.buildStoredFileName(existingDocument.documentType.code, fileName);
            const absoluteFilePath = path.join(storageDirectory, storedFileName);
            await fs.writeFile(absoluteFilePath, fileBuffer);

            const relativeFilePath = path.relative(process.cwd(), absoluteFilePath).replace(/\\/g, "/");

            const result = await this.prisma.$transaction(async (tx) => {
                let fichierId = existingDocument.fichier_id ?? null;

                if (fichierId) {
                    await tx.fichier.update({
                        where: { id: fichierId },
                        data: {
                            etablissement_id: tenantId,
                            proprietaire_utilisateur_id: this.getRequestUserId(req),
                            fournisseur_stockage: "STOCKAGE_LOCAL",
                            chemin: relativeFilePath,
                            type_mime: mimeType,
                            taille: fileBuffer.length,
                        },
                    });
                } else {
                    const createdFile = await tx.fichier.create({
                        data: {
                            etablissement_id: tenantId,
                            proprietaire_utilisateur_id: this.getRequestUserId(req),
                            fournisseur_stockage: "STOCKAGE_LOCAL",
                            chemin: relativeFilePath,
                            type_mime: mimeType,
                            taille: fileBuffer.length,
                        },
                    });
                    fichierId = createdFile.id;
                }

                const updatedDocument = await tx.inscriptionDocument.update({
                    where: { id: existingDocument.id },
                    data: {
                        fichier: fichierId ? { connect: { id: fichierId } } : undefined,
                        fourni: true,
                        statut: ["VALIDE", "REJETE"].includes(existingDocument.statut)
                            ? existingDocument.statut
                            : "FOURNI",
                        date_depot: existingDocument.date_depot ?? new Date(),
                        commentaire_admin: commentaireAdmin ?? existingDocument.commentaire_admin,
                    },
                    include: {
                        documentType: true,
                        fichier: true,
                    },
                });

                const existingLink = await tx.lienFichier.findFirst({
                    where: {
                        type_entite: "inscriptions_documents",
                        id_entite: existingDocument.id,
                        tag: existingDocument.documentType.code,
                    },
                });

                if (existingLink) {
                    await tx.lienFichier.update({
                        where: { id: existingLink.id },
                        data: {
                            fichier_id: fichierId!,
                        },
                    });
                } else if (fichierId) {
                    await tx.lienFichier.create({
                        data: {
                            fichier_id: fichierId,
                            type_entite: "inscriptions_documents",
                            id_entite: existingDocument.id,
                            tag: existingDocument.documentType.code,
                        },
                    });
                }

                const updatedInscription = await this.refreshInscriptionDerivedState(tx, inscriptionId);

                return {
                    document: updatedDocument,
                    inscription: updatedInscription,
                };
            });

            Response.success(res, "Fichier lie au document d'inscription avec succes.", result);
        } catch (error) {
            next(error);
        }
    }

    private async updateDocument(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const tenantId = this.resolveTenantId(req);
            const inscriptionId = req.params.id;
            const documentId = req.params.documentId;

            const existingDocument = await this.prisma.inscriptionDocument.findFirst({
                where: {
                    id: documentId,
                    inscription_id: inscriptionId,
                    inscription: {
                        eleve: {
                            etablissement_id: tenantId,
                        },
                    },
                },
                include: {
                    inscription: true,
                },
            });

            if (!existingDocument) {
                return Response.error(res, "Document d'inscription introuvable.", 404, new Error("document not found"));
            }

            const requestedStatus = this.normalizeInscriptionDocumentStatus(req.body?.statut, existingDocument.statut);
            const fourni = requestedStatus === "NON_FOURNI"
                ? false
                : this.toBool(req.body?.fourni, true);
            const commentaireAdmin = this.toNullableString(req.body?.commentaire_admin);
            const fichierId = this.toNullableString(req.body?.fichier_id);
            const dateDepot = fourni
                ? this.parseOptionalDate(req.body?.date_depot) ?? existingDocument.date_depot ?? new Date()
                : null;
            const isVerifiedStatus = ["VALIDE", "REJETE"].includes(requestedStatus);
            const dateVerification = isVerifiedStatus
                ? this.parseOptionalDate(req.body?.date_verification) ?? existingDocument.date_verification ?? new Date()
                : null;
            const verifierUserId = this.getRequestUserId(req) ?? existingDocument.verifie_par_utilisateur_id ?? null;

            const payload: Prisma.InscriptionDocumentUpdateInput = {
                fourni,
                statut: requestedStatus,
                commentaire_admin: commentaireAdmin,
                date_depot: dateDepot,
                date_verification: dateVerification,
                verifiePar: isVerifiedStatus && verifierUserId
                    ? { connect: { id: verifierUserId } }
                    : existingDocument.verifie_par_utilisateur_id
                        ? { disconnect: true }
                        : undefined,
            };

            if (fichierId !== null) {
                payload.fichier = fichierId
                    ? { connect: { id: fichierId } }
                    : { disconnect: true };
            }

            const result = await this.prisma.$transaction(async (tx) => {
                const updatedDocument = await tx.inscriptionDocument.update({
                    where: { id: existingDocument.id },
                    data: payload,
                    include: {
                        documentType: true,
                        fichier: true,
                    },
                });

                const updatedInscription = await this.refreshInscriptionDerivedState(tx, inscriptionId);

                return {
                    document: updatedDocument,
                    inscription: updatedInscription,
                };
            });

            Response.success(res, "Document d'inscription mis a jour avec succes.", result);
        } catch (error) {
            next(error);
        }
    }

    private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.inscription.findUnique(id);
            Response.success(res, "Stablisment result.", result);
        } catch (error) {
            next(error);
        }
    }

    private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.inscription.delete(id);
            Response.success(res, "Stablisment deleted.", result);
        } catch (error) {
            next(error);
        }
    }

    private async update(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const data: Inscription = req.body;
            const result = await this.inscription.update(id, data);
            Response.success(res, "Stablisment updated.", result);
        } catch (error) {
            next(error);
        }
    }

    private getRequestUserId(req: Request) {
        return (req as Request & { user?: { sub?: string } }).user?.sub ?? null;
    }

    private getRequestRoleNames(req: Request) {
        return extractRoleNamesFromPayload((req as Request & { user?: { role?: unknown } }).user?.role);
    }

    private canAccessMedicalData(req: Request) {
        const roleNames = this.getRequestRoleNames(req);
        if (hasSystemAdminRoleNames(roleNames)) {
            return true;
        }

        const allowedRoleNames = new Set([
            "ADMIN",
            "ADMINISTRATEUR",
            "ADMINISTRATION",
            "DIRECTEUR",
            "DIRECTION",
            "SCOLARITE",
            "SECRETAIRE",
            "SECRETAIRE SCOLARITE",
            "INFIRMIER",
            "INFIRMERIE",
            "MEDECIN",
            "SANTE",
        ]);

        return roleNames.some((roleName) => allowedRoleNames.has(roleName));
    }

    private resolveTenantId(req: Request) {
        const tenantId = (req as Request & { tenantId?: string }).tenantId?.trim();
        if (!tenantId) {
            throw new Error("Aucun etablissement actif n'a ete fourni.");
        }
        return tenantId;
    }

    private extractJsonObject(value: Prisma.JsonValue | null | undefined) {
        return value && typeof value === "object" && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : null;
    }

    private getNestedJsonObject(parent: Record<string, unknown> | null, key: string) {
        const value = parent?.[key];
        return value && typeof value === "object" && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : null;
    }

    private resolveEnrollmentFinancePolicy(parametres: Prisma.JsonValue | null | undefined) {
        const root = this.extractJsonObject(parametres);
        const financeSettings = this.getNestedJsonObject(root, "finance");
        const enrollmentSettings =
            this.getNestedJsonObject(financeSettings, "inscription") ??
            this.getNestedJsonObject(financeSettings, "enrollment") ??
            this.getNestedJsonObject(root, "inscription") ??
            this.getNestedJsonObject(root, "enrollment");
        const validationSettings =
            this.getNestedJsonObject(enrollmentSettings, "validation") ??
            this.getNestedJsonObject(enrollmentSettings, "validation_financiere") ??
            enrollmentSettings;

        const minimumMode = this.toNullableString(
            validationSettings?.minimum_payment_mode ??
            validationSettings?.mode_paiement_minimum ??
            validationSettings?.minimum_required_payment_mode,
        )?.toUpperCase();
        const minimumPercent = Number(
            validationSettings?.minimum_payment_percent ??
            validationSettings?.pourcentage_paiement_minimum ??
            validationSettings?.minimum_required_payment_percent ??
            0,
        );
        const minimumAmount = this.toMoney(
            validationSettings?.minimum_payment_amount ??
            validationSettings?.montant_paiement_minimum ??
            validationSettings?.minimum_required_payment_amount ??
            0,
        );
        const dueSoonDaysCandidate = Number(
            validationSettings?.echeance_proche_jours ??
            validationSettings?.due_soon_days ??
            financeSettings?.echeance_proche_jours ??
            7,
        );

        const normalizedMode =
            minimumMode === "INSCRIPTION_AND_FIRST_SCOLARITE_TRANCHE" ||
            minimumMode === "REGISTRATION_AND_FIRST_TUITION_INSTALLMENT" ||
            minimumMode === "DROIT_INSCRIPTION_ET_PREMIERE_TRANCHE_SCOLARITE"
                ? "INSCRIPTION_AND_FIRST_SCOLARITE_TRANCHE"
                : minimumMode === "INSCRIPTION_FEE" ||
                    minimumMode === "REGISTRATION_FEE" ||
                    minimumMode === "DROIT_INSCRIPTION"
                    ? "INSCRIPTION_FEE"
                    : minimumMode === "AMOUNT" || minimumAmount > 0
                        ? "AMOUNT"
                        : minimumMode === "PERCENT" || minimumPercent > 0
                            ? "PERCENT"
                            : "NONE";

        return {
            mode: normalizedMode as EnrollmentFinancePolicyMode,
            value:
                normalizedMode === "AMOUNT"
                    ? Math.max(0, minimumAmount)
                    : normalizedMode === "PERCENT"
                        ? Math.max(0, Math.min(100, minimumPercent))
                        : 0,
            dueSoonDays: Number.isFinite(dueSoonDaysCandidate)
                ? Math.max(1, Math.trunc(dueSoonDaysCandidate))
                : 7,
        };
    }

    private computeEnrollmentMinimumPaymentStatus(args: {
        totalFacture: number;
        totalPaye: number;
        policy: ReturnType<InscriptionApp["resolveEnrollmentFinancePolicy"]>;
        breakdown?: EnrollmentMinimumPaymentBreakdown;
    }) {
        const totalFacture = this.roundMoney(Math.max(0, args.totalFacture));
        const totalPaye = this.roundMoney(Math.max(0, args.totalPaye));

        let requiredAmount = 0;
        if (args.policy.mode === "AMOUNT") {
            requiredAmount = this.roundMoney(Math.min(totalFacture, args.policy.value));
        } else if (args.policy.mode === "PERCENT") {
            requiredAmount = this.roundMoney(totalFacture * (args.policy.value / 100));
        } else if (args.policy.mode === "INSCRIPTION_FEE") {
            requiredAmount = this.roundMoney(
                Math.min(totalFacture, Math.max(0, args.breakdown?.registrationFeeAmount ?? 0)),
            );
        } else if (args.policy.mode === "INSCRIPTION_AND_FIRST_SCOLARITE_TRANCHE") {
            requiredAmount = this.roundMoney(
                Math.min(
                    totalFacture,
                    Math.max(0, args.breakdown?.registrationFeeAmount ?? 0) +
                    Math.max(0, args.breakdown?.firstSchoolInstallmentAmount ?? 0),
                ),
            );
        }

        const missingAmount = this.roundMoney(Math.max(0, requiredAmount - totalPaye));

        return {
            requiredAmount,
            missingAmount,
            satisfied: missingAmount <= 0,
            mode: args.policy.mode,
            value: args.policy.value,
        };
    }

    private describeEnrollmentMinimumPaymentPolicy(mode: EnrollmentFinancePolicyMode) {
        switch (mode) {
            case "PERCENT":
                return "pourcentage minimum";
            case "AMOUNT":
                return "montant minimum";
            case "INSCRIPTION_FEE":
                return "droit d'inscription paye";
            case "INSCRIPTION_AND_FIRST_SCOLARITE_TRANCHE":
                return "droit d'inscription et premiere tranche de scolarite";
            case "NONE":
            default:
                return "aucun minimum";
        }
    }

    private computeCompletionScore(checks: boolean[]) {
        if (checks.length === 0) return 0;
        const passed = checks.filter(Boolean).length;
        return Math.round((passed / checks.length) * 100);
    }

    private normalizeInscriptionType(value: unknown) {
        const normalized = this.toNullableString(value)?.toUpperCase();
        switch (normalized) {
            case "REINSCRIPTION":
                return "REINSCRIPTION" as const;
            case "TRANSFERT":
            case "TRANSFERT_ENTRANT":
                return "TRANSFERT_ENTRANT" as const;
            case "REDOUBLEMENT":
                return "REDOUBLEMENT" as const;
            case "PASSAGE":
            case "PASSAGE_CLASSE_SUPERIEURE":
                return "PASSAGE_CLASSE_SUPERIEURE" as const;
            case "NOUVELLE":
            case "NOUVELLE_INSCRIPTION":
            default:
                return "NOUVELLE_INSCRIPTION" as const;
        }
    }

    private normalizeInscriptionStatus(value: unknown) {
        const normalized = this.toNullableString(value)?.toUpperCase();
        switch (normalized) {
            case "PREINSCRIT":
                return "PREINSCRIT" as const;
            case "EN_ATTENTE_PAIEMENT":
                return "EN_ATTENTE_PAIEMENT" as const;
            case "VALIDEE":
                return "VALIDEE" as const;
            case "DOSSIER_INCOMPLET":
                return "DOSSIER_INCOMPLET" as const;
            case "ANNULEE":
                return "ANNULEE" as const;
            case "TRANSFERE":
            case "TRANSFEREE":
                return "TRANSFERE" as const;
            case "SUSPENDUE":
                return "SUSPENDUE" as const;
            case "SORTI":
                return "SORTI" as const;
            case "INSCRIT":
            default:
                return "INSCRIT" as const;
        }
    }

    private normalizeInscriptionDocumentStatus(value: unknown, fallback: string = "NON_FOURNI") {
        const normalized = this.toNullableString(value)?.toUpperCase();
        switch (normalized) {
            case "FOURNI":
                return "FOURNI" as const;
            case "EN_ATTENTE_VERIFICATION":
                return "EN_ATTENTE_VERIFICATION" as const;
            case "VALIDE":
                return "VALIDE" as const;
            case "REJETE":
                return "REJETE" as const;
            case "EXPIRE":
                return "EXPIRE" as const;
            case "NON_FOURNI":
                return "NON_FOURNI" as const;
            default:
                return this.toNullableString(fallback)?.toUpperCase() === "VALIDE"
                    ? "VALIDE"
                    : this.toNullableString(fallback)?.toUpperCase() === "REJETE"
                        ? "REJETE"
                        : this.toNullableString(fallback)?.toUpperCase() === "EN_ATTENTE_VERIFICATION"
                            ? "EN_ATTENTE_VERIFICATION"
                            : this.toNullableString(fallback)?.toUpperCase() === "FOURNI"
                                ? "FOURNI"
                                : this.toNullableString(fallback)?.toUpperCase() === "EXPIRE"
                                    ? "EXPIRE"
                                    : "NON_FOURNI";
        }
    }

    private parseOptionalDate(value: unknown) {
        if (value === undefined || value === null || value === "") {
            return null;
        }

        const parsed = value instanceof Date ? value : new Date(String(value));
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    private decodeBase64File(content: string) {
        const normalized = content.includes(",") ? content.split(",").pop() ?? "" : content;
        return Buffer.from(normalized, "base64");
    }

    private sanitizeFileName(fileName: string) {
        const normalized = fileName
            .normalize("NFKD")
            .replace(/[^\w.\-]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");

        return normalized || "document";
    }

    private buildStoredFileName(documentCode: string, originalFileName: string) {
        const cleanedFileName = this.sanitizeFileName(originalFileName);
        const extension = path.extname(cleanedFileName);
        const baseName = extension ? cleanedFileName.slice(0, -extension.length) : cleanedFileName;
        const safeDocumentCode = this.sanitizeFileName(documentCode || "document");
        return `${safeDocumentCode}-${Date.now()}-${baseName}${extension}`;
    }

    private getStoredFileName(filePath: string | null | undefined) {
        if (!filePath) {
            return null;
        }

        const normalizedPath = filePath.replace(/\\/g, "/").trim();
        if (!normalizedPath) {
            return null;
        }

        return path.basename(normalizedPath);
    }

    private async sendStoredFile(
        res: R,
        storedPath: string,
        mimeType: string | null | undefined,
        downloadQueryValue: unknown,
    ) {
        const absolutePath = this.resolveStoredFilePath(storedPath);
        try {
            await fs.access(absolutePath);
        } catch (error) {
            const notFoundError = new Error("Le fichier demande est introuvable sur le stockage.");
            (notFoundError as Error & { statusCode?: number; cause?: unknown }).statusCode = 404;
            (notFoundError as Error & { statusCode?: number; cause?: unknown }).cause = error;
            throw notFoundError;
        }

        const fileName = path.basename(absolutePath);
        const dispositionMode = this.isTruthyQueryParam(downloadQueryValue) ? "attachment" : "inline";

        if (mimeType) {
            res.type(mimeType);
        }

        const encodedFileName = encodeURIComponent(fileName);
        res.setHeader("Content-Disposition", `${dispositionMode}; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`);
        res.sendFile(absolutePath);
    }

    private resolveStoredFilePath(storedPath: string) {
        const normalizedStoredPath = storedPath.replace(/\\/g, path.sep);
        const absolutePath = path.isAbsolute(normalizedStoredPath)
            ? path.resolve(normalizedStoredPath)
            : path.resolve(process.cwd(), normalizedStoredPath);
        const workspaceRoot = path.resolve(process.cwd());

        if (!absolutePath.startsWith(workspaceRoot)) {
            throw new Error("Le chemin du fichier est invalide.");
        }

        return absolutePath;
    }

    private isTruthyQueryParam(value: unknown): boolean {
        if (Array.isArray(value)) {
            return value.some((item) => this.isTruthyQueryParam(item));
        }

        if (typeof value === "boolean") {
            return value;
        }

        if (typeof value !== "string") {
            return false;
        }

        return ["1", "true", "yes", "download"].includes(value.trim().toLowerCase());
    }

    private async resolveInscriptionDocumentTypes(
        tx: Prisma.TransactionClient,
        etablissementId: string,
        typeInscription: ReturnType<InscriptionApp["normalizeInscriptionType"]>,
    ) {
        const documentTypes = await tx.documentTypeInscription.findMany({
            where: {
                est_actif: true,
                OR: [
                    { etablissement_id: etablissementId },
                    { etablissement_id: null },
                ],
            },
            orderBy: [
                { ordre: "asc" },
                { nom: "asc" },
            ],
        });

        return documentTypes.filter((item) => this.matchesInscriptionDocumentType(item.type_inscriptions_json, typeInscription));
    }

    private matchesInscriptionDocumentType(
        rawTypeFilter: Prisma.JsonValue | null | undefined,
        typeInscription: ReturnType<InscriptionApp["normalizeInscriptionType"]>,
    ) {
        const filters = this.extractJsonStringList(rawTypeFilter)
            .map((item) => this.normalizeInscriptionType(item))
            .filter(Boolean);

        return filters.length === 0 || filters.includes(typeInscription);
    }

    private extractJsonStringList(value: Prisma.JsonValue | null | undefined): string[] {
        if (Array.isArray(value)) {
            return value
                .map((item) => (typeof item === "string" ? item.trim() : ""))
                .filter((item): item is string => Boolean(item));
        }

        if (typeof value === "string") {
            const normalized = value.trim();
            if (!normalized) {
                return [];
            }

            try {
                const parsed = JSON.parse(normalized) as Prisma.JsonValue;
                return this.extractJsonStringList(parsed);
            } catch (_error) {
                return [normalized];
            }
        }

        return [];
    }

    private deriveInscriptionFinanceStatus(args: {
        totalFacture: number;
        totalPaye: number;
        resteARegler: number;
        overdueCount?: number;
    }) {
        if (args.totalFacture <= 0) {
            return "NON_FACTURE" as const;
        }
        if (args.resteARegler <= 0) {
            return "PAYE" as const;
        }
        if ((args.overdueCount ?? 0) > 0) {
            return "EN_RETARD" as const;
        }
        if (args.totalPaye <= 0) {
            return "NON_PAYE" as const;
        }
        return "PARTIELLEMENT_PAYE" as const;
    }

    private async countClasseOccupancy(
        tx: PrismaClient | Prisma.TransactionClient,
        args: {
            classeId: string;
            anneeScolaireId: string;
            excludeInscriptionId?: string | null;
        },
    ) {
        return tx.inscription.count({
            where: {
                classe_id: args.classeId,
                annee_scolaire_id: args.anneeScolaireId,
                ...(args.excludeInscriptionId
                    ? {
                        id: {
                            not: args.excludeInscriptionId,
                        },
                    }
                    : {}),
                statut: {
                    not: "SORTI",
                },
            },
        });
    }

    private computeClasseCapacityState(capacity: number | null | undefined, occupancy: number) {
        const normalizedCapacity = typeof capacity === "number" && Number.isFinite(capacity) && capacity >= 0
            ? capacity
            : null;
        const normalizedOccupancy = Number.isFinite(occupancy) ? Math.max(0, Math.trunc(occupancy)) : 0;
        const placesRemaining =
            normalizedCapacity == null
                ? null
                : Math.max(normalizedCapacity - normalizedOccupancy, 0);
        const occupancyRate =
            normalizedCapacity && normalizedCapacity > 0
                ? Math.round((normalizedOccupancy / normalizedCapacity) * 100)
                : null;

        return {
            capacity: normalizedCapacity,
            occupancy: normalizedOccupancy,
            placesRemaining,
            occupancyRate,
            isFull: normalizedCapacity != null && normalizedOccupancy >= normalizedCapacity,
            isNearlyFull:
                normalizedCapacity != null &&
                normalizedOccupancy < normalizedCapacity &&
                occupancyRate != null &&
                occupancyRate >= 80,
            isOverCapacity: normalizedCapacity != null && normalizedOccupancy > normalizedCapacity,
        };
    }

    private computeInscriptionValidationState(args: {
        dossierStatus: string;
        financeStatus: string;
        hasClass: boolean;
        hasResponsable: boolean;
        classOverCapacity?: boolean;
        minimumPaymentSatisfied?: boolean;
        minimumPaymentMissingAmount?: number;
    }) {
        const reasons: string[] = [];

        if (!args.hasResponsable) {
            reasons.push("Aucun responsable n'est lie a l'inscription.");
        }
        if (!args.hasClass) {
            reasons.push("L'eleve n'est pas encore affecte a une classe.");
        }
        if (!["VALIDE", "COMPLET"].includes((args.dossierStatus ?? "").toUpperCase())) {
            reasons.push("Le dossier administratif n'est pas encore valide.");
        }
        if (
            !["PAYE", "EXONERE", "NON_FACTURE"].includes((args.financeStatus ?? "").toUpperCase()) &&
            !args.minimumPaymentSatisfied
        ) {
            reasons.push("La situation financiere n'est pas encore conforme.");
        }
        if (args.minimumPaymentSatisfied === false && (args.minimumPaymentMissingAmount ?? 0) > 0) {
            reasons.push(`Le paiement minimum requis n'est pas atteint (${this.roundMoney(args.minimumPaymentMissingAmount ?? 0)} MGA restants).`);
        }
        if (args.classOverCapacity) {
            reasons.push("La classe affectee depasse sa capacite.");
        }

        return {
            can_validate: reasons.length === 0,
            reasons,
        };
    }

    private deriveInscriptionDossierStatus(
        documents: Array<{ obligatoire?: boolean | null; fourni?: boolean | null; statut?: string | null }>,
    ) {
        if (documents.length === 0) {
            return "COMPLET" as const;
        }

        const requiredDocuments = documents.filter((item) => Boolean(item.obligatoire));
        const requiredPool = requiredDocuments.length > 0 ? requiredDocuments : documents;

        if (requiredPool.some((item) => (item.statut ?? "").toUpperCase() === "REJETE")) {
            return "REJETE" as const;
        }

        if (
            requiredPool.some((item) =>
                !item.fourni || ["NON_FOURNI", "EXPIRE"].includes((item.statut ?? "").toUpperCase()),
            )
        ) {
            return "INCOMPLET" as const;
        }

        if (requiredPool.every((item) => (item.statut ?? "").toUpperCase() === "VALIDE")) {
            return "VALIDE" as const;
        }

        if (
            requiredPool.some((item) =>
                ["FOURNI", "EN_ATTENTE_VERIFICATION"].includes((item.statut ?? "").toUpperCase()),
            )
        ) {
            return "EN_ATTENTE_VERIFICATION" as const;
        }

        return "COMPLET" as const;
    }

    private deriveInscriptionAdministrativeStatus(args: {
        requestedStatus: ReturnType<InscriptionApp["normalizeInscriptionStatus"]>;
        dossierStatus: ReturnType<InscriptionApp["deriveInscriptionDossierStatus"]>;
        financeStatus: string;
        financeValidationSatisfied?: boolean;
    }) {
        if (args.requestedStatus === "ANNULEE" || args.requestedStatus === "SORTI") {
            return "ANNULE" as const;
        }
        if (args.dossierStatus === "REJETE") {
            return "REJETE" as const;
        }
        if (args.dossierStatus === "INCOMPLET") {
            return "DOSSIER_INCOMPLET" as const;
        }
        if (args.dossierStatus === "EN_ATTENTE_VERIFICATION") {
            return "EN_ATTENTE_VERIFICATION" as const;
        }
        if (args.requestedStatus === "VALIDEE" && args.financeValidationSatisfied !== false) {
            return "VALIDE" as const;
        }
        if (["NON_PAYE", "PARTIELLEMENT_PAYE", "EN_RETARD"].includes(args.financeStatus)) {
            return "EN_ATTENTE" as const;
        }
        if (args.requestedStatus === "VALIDEE") {
            return "VALIDE" as const;
        }
        return "EN_ATTENTE" as const;
    }

    private deriveInscriptionGlobalStatus(args: {
        requestedStatus: ReturnType<InscriptionApp["normalizeInscriptionStatus"]>;
        administrativeStatus: ReturnType<InscriptionApp["deriveInscriptionAdministrativeStatus"]>;
        financeStatus: string;
        dossierStatus: ReturnType<InscriptionApp["deriveInscriptionDossierStatus"]>;
    }) {
        if (["ANNULEE", "TRANSFERE", "SUSPENDUE", "SORTI", "PREINSCRIT"].includes(args.requestedStatus)) {
            return args.requestedStatus;
        }
        if (args.dossierStatus === "INCOMPLET" || args.administrativeStatus === "DOSSIER_INCOMPLET") {
            return "DOSSIER_INCOMPLET" as const;
        }
        if (args.administrativeStatus === "VALIDE" || args.requestedStatus === "VALIDEE") {
            return "VALIDEE" as const;
        }
        if (["NON_PAYE", "EN_RETARD"].includes(args.financeStatus)) {
            return "EN_ATTENTE_PAIEMENT" as const;
        }
        return "INSCRIT" as const;
    }

    private computeDocumentCompletionScore(
        documents: Array<{ obligatoire?: boolean | null; fourni?: boolean | null; statut?: string | null }>,
        documentsConfigured: boolean,
    ) {
        if (!documentsConfigured || documents.length === 0) {
            return 100;
        }

        const requiredDocuments = documents.filter((item) => Boolean(item.obligatoire));
        const pool = requiredDocuments.length > 0 ? requiredDocuments : documents;
        const completed = pool.filter((item) =>
            Boolean(item.fourni) && !["NON_FOURNI", "REJETE", "EXPIRE"].includes((item.statut ?? "").toUpperCase()),
        ).length;

        return Math.round((completed / pool.length) * 100);
    }

    private computeInscriptionCompletionRate(args: {
        codeEleve: string | null;
        eleve: any;
        tuteurs: any[];
        emergencyContact: Record<string, unknown> | null;
        hasSchoolYear: boolean;
        hasClass: boolean;
        hasLevel: boolean;
        financeStatus: string;
        documents: Array<{ obligatoire?: boolean | null; fourni?: boolean | null; statut?: string | null }>;
        documentsConfigured: boolean;
    }) {
        const identityScore = this.computeCompletionScore([
            Boolean(args.codeEleve),
            Boolean(this.toNullableString(args.eleve?.prenom)),
            Boolean(this.toNullableString(args.eleve?.nom)),
            Boolean(args.eleve?.date_naissance),
            Boolean(this.toNullableString(args.eleve?.genre)),
            Boolean(this.toNullableString(args.eleve?.adresse)),
        ]);
        const contactsScore = this.computeCompletionScore([
            args.tuteurs.length > 0,
            args.tuteurs.some((item) => Boolean(this.toNullableString(item?.telephone))),
            Boolean(args.emergencyContact?.telephone ?? args.emergencyContact?.phone ?? null),
        ]);
        const schoolScore = this.computeCompletionScore([
            args.hasSchoolYear,
            args.hasLevel,
            args.hasClass,
        ]);
        const financeScore = this.computeCompletionScore([
            args.financeStatus !== "NON_FACTURE",
            args.financeStatus !== "NON_PAYE",
            args.financeStatus !== "EN_RETARD",
        ]);
        const documentsScore = this.computeDocumentCompletionScore(args.documents, args.documentsConfigured);

        return Math.round((identityScore + contactsScore + schoolScore + financeScore + documentsScore) / 5);
    }

    private async computeRegisteredFacturePayments(
        tx: PrismaClient | Prisma.TransactionClient,
        factureIds: string[],
    ) {
        if (factureIds.length === 0) {
            return [];
        }

        return tx.paiement.findMany({
            where: {
                facture_id: {
                    in: factureIds,
                },
                statut: {
                    notIn: ["ANNULE", "ANNULEE"],
                },
            },
            orderBy: [{ paye_le: "desc" }, { created_at: "desc" }],
        });
    }

    private async computeInscriptionFinanceSnapshot(
        tx: PrismaClient | Prisma.TransactionClient,
        args: {
            eleveId: string;
            anneeScolaireId: string;
        },
    ) {
        const today = this.startOfDay(new Date());
        const [factures, echeances, planPaiement] = await Promise.all([
            tx.facture.findMany({
                where: {
                    eleve_id: args.eleveId,
                    annee_scolaire_id: args.anneeScolaireId,
                },
                include: {
                    lignes: true,
                },
            }),
            tx.echeancePaiement.findMany({
                where: {
                    eleve_id: args.eleveId,
                    annee_scolaire_id: args.anneeScolaireId,
                },
            }),
            tx.planPaiementEleve.findFirst({
                where: {
                    eleve_id: args.eleveId,
                    annee_scolaire_id: args.anneeScolaireId,
                },
                orderBy: [{ created_at: "asc" }],
            }),
        ]);
        const activeFactureIds = factures
            .filter((facture) => (facture.statut ?? "").toUpperCase() !== "ANNULEE")
            .map((facture) => facture.id);
        const paiements = await this.computeRegisteredFacturePayments(tx, activeFactureIds);

        const totalFacture = this.roundMoney(
            factures
                .filter((facture) => facture.statut !== "ANNULEE")
                .reduce((sum, facture) => sum + this.toMoney(facture.total_montant), 0),
        );
        const totalPaye = this.roundMoney(
            paiements.reduce((sum, paiement) => sum + this.toMoney(paiement.montant), 0),
        );
        const resteARegler = this.roundMoney(
            echeances.length > 0
                ? echeances.reduce((sum, echeance) => sum + this.toMoney(echeance.montant_restant), 0)
                : Math.max(0, totalFacture - totalPaye),
        );
        const overdueCount = echeances.filter((echeance) => {
            const dueDate = this.startOfDay(new Date(String(echeance.date_echeance)));
            return this.toMoney(echeance.montant_restant) > 0 && dueDate.getTime() < today.getTime();
        }).length;
        const breakdown = this.computeEnrollmentFinanceBreakdownFromPlan(
            planPaiement?.plan_json,
            factures,
        );

        return {
            totalFacture,
            totalPaye,
            resteARegler,
            overdueCount,
            breakdown,
            latestPayment: paiements[0] ?? null,
            status: this.deriveInscriptionFinanceStatus({
                totalFacture,
                totalPaye,
                resteARegler,
                overdueCount,
            }),
        };
    }

    private async refreshInscriptionDerivedState(tx: Prisma.TransactionClient, inscriptionId: string) {
        const inscription = await tx.inscription.findUnique({
            where: { id: inscriptionId },
            include: {
                niveau: true,
                classe: {
                    include: {
                        niveau: true,
                    },
                },
                eleve: {
                    include: {
                        utilisateur: {
                            include: {
                                profil: true,
                            },
                        },
                        liensParents: {
                            include: {
                                parent_tuteur: true,
                            },
                        },
                    },
                },
                documents: true,
            },
        });

        if (!inscription) {
            throw new Error("Inscription introuvable pour recalcul.");
        }

        const profile = inscription.eleve.utilisateur?.profil ?? null;
        const financeSnapshot = await this.computeInscriptionFinanceSnapshot(tx, {
            eleveId: inscription.eleve_id,
            anneeScolaireId: inscription.annee_scolaire_id,
        });
        const etablissement = await tx.etablissement.findUnique({
            where: { id: inscription.eleve.etablissement_id },
            select: { parametres_json: true },
        });
        const financePolicy = this.resolveEnrollmentFinancePolicy(etablissement?.parametres_json ?? null);
        const minimumPaymentStatus = this.computeEnrollmentMinimumPaymentStatus({
            totalFacture: financeSnapshot.totalFacture,
            totalPaye: financeSnapshot.totalPaye,
            policy: financePolicy,
            breakdown: financeSnapshot.breakdown,
        });
        const finalDossierStatus = this.deriveInscriptionDossierStatus(inscription.documents);
        const finalAdministrativeStatus = this.deriveInscriptionAdministrativeStatus({
            requestedStatus: this.normalizeInscriptionStatus(inscription.statut),
            dossierStatus: finalDossierStatus,
            financeStatus: financeSnapshot.status,
            financeValidationSatisfied: minimumPaymentStatus.satisfied,
        });
        const finalInscriptionStatus = this.deriveInscriptionGlobalStatus({
            requestedStatus: this.normalizeInscriptionStatus(inscription.statut),
            administrativeStatus: finalAdministrativeStatus,
            financeStatus: financeSnapshot.status,
            dossierStatus: finalDossierStatus,
        });
        const finalCompletionRate = this.computeInscriptionCompletionRate({
            codeEleve: inscription.eleve.code_eleve,
            eleve: {
                prenom: profile?.prenom,
                nom: profile?.nom,
                date_naissance: profile?.date_naissance,
                genre: profile?.genre,
                adresse: profile?.adresse,
            },
            tuteurs: inscription.eleve.liensParents.map((item) => ({
                telephone: item.parent_tuteur?.telephone ?? null,
            })),
            emergencyContact: this.extractJsonObject(profile?.contact_urgence_json),
            hasSchoolYear: Boolean(inscription.annee_scolaire_id),
            hasClass: Boolean(inscription.classe_id),
            hasLevel: Boolean(inscription.niveau_scolaire_id ?? inscription.classe?.niveau_scolaire_id),
            financeStatus: financeSnapshot.status,
            documents: inscription.documents,
            documentsConfigured: inscription.documents.length > 0,
        });

        return tx.inscription.update({
            where: { id: inscription.id },
            data: {
                statut: finalInscriptionStatus,
                statut_administratif: finalAdministrativeStatus,
                statut_financier: financeSnapshot.status,
                statut_dossier: finalDossierStatus,
                completion_rate: finalCompletionRate,
                validation_date: finalAdministrativeStatus === "VALIDE" ? inscription.validation_date ?? new Date() : null,
            },
        });
    }

    private extractPlanJsonObject(value: Prisma.JsonValue | null | undefined) {
        return value && typeof value === "object" && !Array.isArray(value)
            ? (value as Record<string, any>)
            : {};
    }

    private extractPlanFinanceConfig(value: Prisma.JsonValue | null | undefined) {
        const planJson = this.extractPlanJsonObject(value);
        return planJson.finance && typeof planJson.finance === "object" && !Array.isArray(planJson.finance)
            ? (planJson.finance as Record<string, unknown>)
            : {};
    }

    private computeEnrollmentFinanceBreakdownFromPlan(
        planJson: Prisma.JsonValue | null | undefined,
        factures: Array<{
            statut?: string | null;
            lignes: Array<{
                catalogue_frais_id: string | null;
                montant: Prisma.Decimal | number;
            }>;
        }>,
    ): EnrollmentMinimumPaymentBreakdown {
        const financeConfig = this.extractPlanFinanceConfig(planJson);
        const registrationFeeId = this.toNullableString(financeConfig.catalogue_frais_inscription_id);
        const schoolFeeId = this.toNullableString(financeConfig.catalogue_frais_scolarite_id);
        const schoolTrancheCount = this.resolveFinanceLineTrancheCount(
            financeConfig.catalogue_frais_scolarite_nombre_tranches,
        );

        const activeFactureLines = factures
            .filter((facture) => (facture.statut ?? "").toUpperCase() !== "ANNULEE")
            .flatMap((facture) => facture.lignes);

        const registrationFeeAmountFromFacture = activeFactureLines
            .filter((line) => registrationFeeId && line.catalogue_frais_id === registrationFeeId)
            .reduce((sum, line) => sum + this.toMoney(line.montant), 0);
        const schoolFeeAmountFromFacture = activeFactureLines
            .filter((line) => schoolFeeId && line.catalogue_frais_id === schoolFeeId)
            .reduce((sum, line) => sum + this.toMoney(line.montant), 0);

        const registrationFeeAmount = this.roundMoney(
            registrationFeeAmountFromFacture > 0
                ? registrationFeeAmountFromFacture
                : this.toMoney(financeConfig.frais_inscription),
        );
        const schoolFeeAmount = this.roundMoney(
            schoolFeeAmountFromFacture > 0
                ? schoolFeeAmountFromFacture
                : this.toMoney(financeConfig.frais_scolarite),
        );

        return {
            registrationFeeAmount,
            firstSchoolInstallmentAmount:
                schoolFeeAmount > 0
                    ? this.roundMoney(schoolFeeAmount / Math.max(1, schoolTrancheCount))
                    : 0,
        };
    }

    private computeEnrollmentFinanceBreakdownFromInvoiceLines(
        lines: BillingInvoiceLine[],
        discountAmount: number,
        applyOnSourceKeys?: string[] | null,
    ): EnrollmentMinimumPaymentBreakdown {
        const linesWithNetAmount = this.distributeDiscountAcrossCatalogueLines(lines, discountAmount, applyOnSourceKeys);
        const registrationFeeAmount = this.roundMoney(
            linesWithNetAmount
                .filter((line) => line.source_key === "catalogue_frais_inscription_id")
                .reduce((sum, line) => sum + this.toMoney(line.montant_net), 0),
        );
        const firstSchoolInstallmentAmount = this.roundMoney(
            linesWithNetAmount
                .filter((line) => line.source_key === "catalogue_frais_scolarite_id")
                .reduce(
                    (sum, line) =>
                        sum + this.toMoney(line.montant_net) / Math.max(1, this.resolveFinanceLineTrancheCount(line.nombre_tranches)),
                    0,
                ),
        );

        return {
            registrationFeeAmount,
            firstSchoolInstallmentAmount,
        };
    }

    private resolveClassChangeProratedAmount(
        amount: number,
        fee: { est_recurrent?: boolean | null; periodicite?: string | null; prorata_eligible?: boolean | null },
        effectDate: Date,
        schoolYearStartDate: Date,
    ) {
        return this.applyProrataIfNeeded(
            amount,
            {
                est_recurrent: Boolean(fee.est_recurrent),
                periodicite: fee.periodicite ?? null,
                prorata_eligible: Boolean(fee.prorata_eligible),
            },
            effectDate,
            schoolYearStartDate,
        );
    }

    private async buildCreditNumber(tx: Prisma.TransactionClient, etablissementId: string): Promise<string> {
        const year = new Date().getFullYear();
        const count = await tx.facture.count({
            where: {
                etablissement_id: etablissementId,
                numero_facture: {
                    startsWith: `AV-${year}-`,
                },
            },
        });

        return `AV-${year}-${String(count + 1).padStart(4, "0")}`;
    }

    private async changeClass(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const inscriptionId = req.params.id;
            const targetClasseId =
                typeof req.body?.classe_id === "string" && req.body.classe_id.trim()
                    ? req.body.classe_id.trim()
                    : null;

            if (!targetClasseId) {
                return Response.error(res, "classe_id est obligatoire", 400, new Error());
            }

            const effectDate = req.body?.date_effet ? new Date(req.body.date_effet) : new Date();
            if (Number.isNaN(effectDate.getTime())) {
                return Response.error(res, "date_effet est invalide", 400, new Error());
            }

            const requestedFeeId =
                typeof req.body?.catalogue_frais_scolarite_id === "string" && req.body.catalogue_frais_scolarite_id.trim()
                    ? req.body.catalogue_frais_scolarite_id.trim()
                    : null;
            const generateAdjustment = this.toBool(req.body?.generer_regularisation_financiere, true);
            const motif =
                typeof req.body?.motif === "string" && req.body.motif.trim()
                    ? req.body.motif.trim()
                    : "Regularisation automatique apres changement de classe";

            const existing = await this.prisma.inscription.findUnique({
                where: { id: inscriptionId },
                include: {
                    classe: true,
                    annee: true,
                    eleve: true,
                },
            });

            if (!existing) {
                throw new Error("Inscription introuvable.");
            }

            const existingClasseName = existing.classe?.nom ?? "Sans classe";
            const existingTenantId = existing.classe?.etablissement_id ?? existing.eleve.etablissement_id;

            const targetClasse = await this.prisma.classe.findFirst({
                where: {
                    id: targetClasseId,
                    annee_scolaire_id: existing.annee_scolaire_id,
                    etablissement_id: existingTenantId,
                },
                select: {
                    id: true,
                    nom: true,
                    niveau_scolaire_id: true,
                    capacite: true,
                    etablissement_id: true,
                },
            });

            if (!targetClasse) {
                throw new Error("La nouvelle classe n'appartient pas a la meme annee scolaire ou au meme etablissement.");
            }

            if (targetClasse.id === existing.classe_id) {
                const result = await this.inscription.update(inscriptionId, { classe_id: targetClasse.id } as Inscription);
                Response.success(res, "Classe inchangee.", result);
                return;
            }

            const targetOccupancy = await this.countClasseOccupancy(this.prisma, {
                classeId: targetClasse.id,
                anneeScolaireId: existing.annee_scolaire_id,
                excludeInscriptionId: inscriptionId,
            });
            const targetCapacityState = this.computeClasseCapacityState(targetClasse.capacite ?? null, targetOccupancy);
            if (targetCapacityState.isFull) {
                return Response.error(
                    res,
                    `La classe selectionnee est pleine (${targetCapacityState.occupancy}/${targetCapacityState.capacity}).`,
                    400,
                    new Error(),
                );
            }

            const result = await this.prisma.$transaction(async (tx) => {
                const updated = await tx.inscription.update({
                    where: { id: inscriptionId },
                    data: {
                        classe_id: targetClasse.id,
                        niveau_scolaire_id: targetClasse.niveau_scolaire_id,
                    },
                });

                if (!generateAdjustment) {
                    return { inscription: updated, regularisation: null };
                }

                const plan = await tx.planPaiementEleve.findFirst({
                    where: {
                        eleve_id: existing.eleve_id,
                        annee_scolaire_id: existing.annee_scolaire_id,
                    },
                    orderBy: [{ created_at: "asc" }],
                });

                const planJson = this.extractPlanJsonObject(plan?.plan_json);
                const financeConfig =
                    planJson.finance && typeof planJson.finance === "object" && !Array.isArray(planJson.finance)
                        ? (planJson.finance as Record<string, any>)
                        : {};
                const oldFeeId =
                    typeof financeConfig.catalogue_frais_scolarite_id === "string" && financeConfig.catalogue_frais_scolarite_id.trim()
                        ? financeConfig.catalogue_frais_scolarite_id.trim()
                        : null;
                const oldPlanCode =
                    typeof financeConfig.catalogue_frais_scolarite_plan_code === "string" && financeConfig.catalogue_frais_scolarite_plan_code.trim()
                        ? financeConfig.catalogue_frais_scolarite_plan_code.trim().toUpperCase()
                        : null;

                const approvedFees = await tx.catalogueFrais.findMany({
                    where: {
                        etablissement_id: targetClasse.etablissement_id,
                        statut_validation: "APPROUVEE",
                        usage_scope: { in: ["GENERAL", "SCOLARITE"] },
                        OR: [
                            { niveau_scolaire_id: targetClasse.niveau_scolaire_id },
                            { niveau_scolaire_id: null },
                        ],
                    } as never,
                    orderBy: [
                        { niveau_scolaire_id: "desc" },
                        { mode_facturation: "desc" },
                        { montant: "desc" },
                    ],
                });

                const newFee = requestedFeeId
                    ? approvedFees.find((item) => item.id === requestedFeeId) ?? null
                    : approvedFees[0] ?? null;

                const oldFee = oldFeeId
                    ? await tx.catalogueFrais.findFirst({
                        where: {
                            id: oldFeeId,
                            etablissement_id: targetClasse.etablissement_id,
                        },
                    })
                    : null;

                const newFeePlan =
                    newFee && (newFee.mode_facturation ?? "").toUpperCase() === "ANNUEL"
                        ? this.resolvePaymentPlanForFee(
                            {
                                nombre_tranches: this.resolveFinanceLineTrancheCount(newFee.nombre_tranches),
                                plans_paiement_autorises_json: newFee.plans_paiement_autorises_json ?? null,
                                plan_paiement_defaut_code: newFee.plan_paiement_defaut_code ?? null,
                            },
                            oldPlanCode,
                            "le nouveau frais de scolarite",
                        )
                        : null;
                const oldFeePlan =
                    oldFee && (oldFee.mode_facturation ?? "").toUpperCase() === "ANNUEL"
                        ? this.resolvePaymentPlanForFee(
                            {
                                nombre_tranches: this.resolveFinanceLineTrancheCount(oldFee.nombre_tranches),
                                plans_paiement_autorises_json: oldFee.plans_paiement_autorises_json ?? null,
                                plan_paiement_defaut_code: oldFee.plan_paiement_defaut_code ?? null,
                            },
                            oldPlanCode,
                            "l'ancien frais de scolarite",
                        )
                        : null;

                if (!newFee || !oldFee) {
                    if (plan) {
                        await tx.planPaiementEleve.update({
                            where: { id: plan.id },
                            data: {
                                plan_json: {
                                    ...planJson,
                                    finance: {
                                        ...financeConfig,
                                        catalogue_frais_scolarite_id: newFee?.id ?? oldFee?.id ?? null,
                                        catalogue_frais_scolarite_plan_code: newFeePlan?.code ?? oldFeePlan?.code ?? oldPlanCode,
                                        catalogue_frais_scolarite_plan_label: newFeePlan?.label ?? oldFeePlan?.label ?? null,
                                        catalogue_frais_scolarite_nombre_tranches:
                                            newFeePlan?.nombre_tranches ??
                                            oldFeePlan?.nombre_tranches ??
                                            financeConfig.catalogue_frais_scolarite_nombre_tranches ??
                                            null,
                                    },
                                } as Prisma.InputJsonValue,
                            },
                        });
                    }
                    return { inscription: updated, regularisation: null };
                }

                const readiness = await assessBillingReadiness(tx, {
                    tenantId: targetClasse.etablissement_id,
                    anneeScolaireId: existing.annee_scolaire_id,
                    referenceDate: effectDate,
                    catalogueFraisIds: [newFee.id],
                });
                const blockingIssues = readiness.issues.filter((item) => item.severity === "error");
                if (blockingIssues.length > 0) {
                    throw new Error(
                        `Les parametres de facturation ne sont pas prets pour cette regularisation: ${blockingIssues
                            .map((item) => item.message)
                            .join(" ")}`,
                    );
                }

                const oldAmount = this.resolveClassChangeProratedAmount(
                    this.toMoney(oldFee.montant),
                    oldFee,
                    effectDate,
                    existing.annee.date_debut,
                );
                const newAmount = this.resolveClassChangeProratedAmount(
                    this.toMoney(newFee.montant),
                    newFee,
                    effectDate,
                    existing.annee.date_debut,
                );
                const diff = this.roundMoney(newAmount - oldAmount);

                let regularisation: { type: "COMPLEMENTAIRE" | "AVOIR"; facture_id: string; montant: number } | null = null;

                if (diff > 0) {
                    const numeroFacture = await this.buildInvoiceNumber(tx, targetClasse.etablissement_id);
                    const facture = await tx.facture.create({
                        data: {
                            etablissement_id: targetClasse.etablissement_id,
                            eleve_id: existing.eleve_id,
                            annee_scolaire_id: existing.annee_scolaire_id,
                            remise_id: null,
                            nature: "COMPLEMENTAIRE",
                            numero_facture: numeroFacture,
                            date_emission: effectDate,
                            date_echeance: effectDate,
                            statut: "EMISE",
                            total_montant: diff,
                            devise: newFee.devise ?? "MGA",
                        } as never,
                    });

                    await tx.factureLigne.create({
                        data: {
                            facture_id: facture.id,
                            catalogue_frais_id: newFee.id,
                            libelle: `Regularisation changement de classe: ${existingClasseName} -> ${targetClasse.nom}`,
                            quantite: 1,
                            prix_unitaire: diff,
                            montant: diff,
                        },
                    });

                    await ensureFactureEcheances(tx, {
                        factureId: facture.id,
                        lines: [
                            {
                                ordre: 1,
                                libelle: "Regularisation changement de classe",
                                date: effectDate,
                                montant: diff,
                                devise: newFee.devise ?? "MGA",
                                note: motif,
                            },
                        ],
                    });
                    await ensurePlanForFacture(tx, {
                        factureId: facture.id,
                        preferredModePaiement: String(planJson.mode_paiement ?? "COMPTANT"),
                        preferredPaymentDay: financeConfig.jour_paiement_mensuel ?? null,
                        notes: motif,
                    });

                    await this.notifyFamilyForGeneratedInvoice(tx, {
                        tenantId: targetClasse.etablissement_id,
                        factureId: facture.id,
                        eleveId: existing.eleve_id,
                        numeroFacture: facture.numero_facture,
                        totalMontant: diff,
                        devise: newFee.devise ?? "MGA",
                        dueDate: effectDate,
                    });

                    regularisation = { type: "COMPLEMENTAIRE", facture_id: facture.id, montant: diff };
                } else if (diff < 0) {
                    const latestSourceInvoice = await tx.facture.findFirst({
                        where: {
                            eleve_id: existing.eleve_id,
                            annee_scolaire_id: existing.annee_scolaire_id,
                            statut: { not: "ANNULEE" },
                            lignes: {
                                some: {
                                    catalogue_frais_id: oldFee.id,
                                },
                            },
                        },
                        orderBy: [{ date_emission: "desc" }, { created_at: "desc" }],
                    });

                    const creditNumber = await this.buildCreditNumber(tx, targetClasse.etablissement_id);
                    const amount = Math.abs(diff);
                    const avoir = await tx.facture.create({
                        data: {
                            etablissement_id: targetClasse.etablissement_id,
                            eleve_id: existing.eleve_id,
                            annee_scolaire_id: existing.annee_scolaire_id,
                            remise_id: null,
                            facture_origine_id: latestSourceInvoice?.id ?? null,
                            nature: "AVOIR",
                            numero_facture: creditNumber,
                            date_emission: effectDate,
                            date_echeance: effectDate,
                            statut: "PAYEE",
                            total_montant: -amount,
                            devise: oldFee.devise ?? "MGA",
                        } as never,
                    });

                    await tx.factureLigne.create({
                        data: {
                            facture_id: avoir.id,
                            catalogue_frais_id: null,
                            libelle: `Avoir changement de classe: ${existingClasseName} -> ${targetClasse.nom}`,
                            quantite: 1,
                            prix_unitaire: -amount,
                            montant: -amount,
                        },
                    });

                    await this.notifyFamilyForGeneratedInvoice(tx, {
                        tenantId: targetClasse.etablissement_id,
                        factureId: avoir.id,
                        eleveId: existing.eleve_id,
                        numeroFacture: avoir.numero_facture,
                        totalMontant: -amount,
                        devise: oldFee.devise ?? "MGA",
                        dueDate: effectDate,
                    });

                    regularisation = { type: "AVOIR", facture_id: avoir.id, montant: amount };
                }

                if (plan) {
                    await tx.planPaiementEleve.update({
                        where: { id: plan.id },
                        data: {
                            plan_json: {
                                ...planJson,
                                finance: {
                                    ...financeConfig,
                                    catalogue_frais_scolarite_id: newFee.id,
                                    catalogue_frais_scolarite_plan_code: newFeePlan?.code ?? oldPlanCode,
                                    catalogue_frais_scolarite_plan_label: newFeePlan?.label ?? null,
                                    catalogue_frais_scolarite_nombre_tranches:
                                        newFeePlan?.nombre_tranches ??
                                        financeConfig.catalogue_frais_scolarite_nombre_tranches ??
                                        null,
                                },
                                metadata: {
                                    ...(planJson.metadata && typeof planJson.metadata === "object" && !Array.isArray(planJson.metadata)
                                        ? planJson.metadata
                                        : {}),
                                    derniere_regularisation_classe: {
                                        ancienne_classe_id: existing.classe_id,
                                        nouvelle_classe_id: targetClasse.id,
                                        date_effet: effectDate.toISOString(),
                                        regularisation: regularisation,
                                    },
                                },
                            } as Prisma.InputJsonValue,
                        },
                    });
                }

                return { inscription: updated, regularisation };
            });

            Response.success(res, "Classe mise a jour avec regularisation.", result);
        } catch (error) {
            Response.error(res, "Erreur lors du changement de classe", 400, error as Error);        }
    }

    /**
     * Cree une inscription complete (eleve + utilisateurs + tuteurs + services + facture d'ouverture)
     */
    private async createFull(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const {
                etablissement_id,
                annee_scolaire_id,
                eleve,
                scolarite,
                tuteurs = [],
                documents = [],
                medical = {},
                historique_scolaire = {},
                acces_systeme = {},
                consentements = {},
                observations = {},
                services = {},
                finance = {},
                echeancier = {},
            } = req.body as any;

            if (!etablissement_id) {
                return Response.error(res, "etablissement_id est obligatoire", 400, new Error());
            }
            const requestedAnneeScolaireId = this.toNullableString(annee_scolaire_id);
            const requestedClasseId = this.toNullableString(scolarite?.classe_id);
            const requestedNiveauScolaireId = this.toNullableString(scolarite?.niveau_scolaire_id);
            if (!requestedClasseId && !requestedNiveauScolaireId) {
                return Response.error(res, "Le niveau selectionne est invalide.", 400, new Error());
            }

            const passEleve = generateRandomPassword(9);
            const passTuteur = generateRandomPassword(9);
            const requestedInscriptionType = this.normalizeInscriptionType(scolarite?.type_inscription);
            const requestedInscriptionStatus = this.normalizeInscriptionStatus(scolarite?.statut_inscription);
            const normalizedAccessPayload = this.normalizeInscriptionAccessPayload(acces_systeme);
            const normalizedConsentsPayload = this.normalizeInscriptionConsentsPayload(consentements);
            const normalizedObservationsPayload = this.normalizeInscriptionObservationsPayload(observations, null);
            const normalizedTutors = Array.isArray(tuteurs)
                ? tuteurs.filter(
                    (item) =>
                        item &&
                        (
                            this.toNullableString(item?.parent_tuteur_id) ||
                            this.toNullableString(item?.nom) ||
                            this.toNullableString(item?.prenom) ||
                            this.toNullableString(item?.telephone) ||
                            this.toNullableString(item?.email)
                        ),
                )
                : [];
            if (normalizedTutors.length === 0) {
                return Response.error(res, "Aucun responsable n'a ete renseigne.", 400, new Error());
            }
            const tutorValidationContext = await this.resolveTutorValidationContext(
                this.prisma,
                etablissement_id,
                normalizedTutors,
            );
            if (!tutorValidationContext[0]?.telephone_principal) {
                return Response.error(res, "Le telephone du responsable est obligatoire.", 400, new Error());
            }
            const financeRequested = Boolean(
                this.toNullableString(finance?.catalogue_frais_inscription_id) ||
                this.toNullableString(finance?.catalogue_frais_scolarite_id),
            );
            if (
                financeRequested &&
                !normalizedTutors.some((item) => this.toBool(item?.est_responsable_financier, false))
            ) {
                return Response.error(res, "Aucun responsable financier n'a ete defini.", 400, new Error());
            }
            if (
                financeRequested &&
                !this.toBool(normalizedConsentsPayload?.acceptation_conditions_financieres, false)
            ) {
                return Response.error(
                    res,
                    "Les conditions financieres doivent etre acceptees avant de finaliser cette inscription.",
                    400,
                    new Error(),
                );
            }
            if (
                this.toBool(normalizedAccessPayload?.creer_compte_parent, false) &&
                !this.toNullableString(normalizedAccessPayload?.email_connexion_parent) &&
                !tutorValidationContext[0]?.email
            ) {
                return Response.error(
                    res,
                    "Un email du responsable est obligatoire pour creer un compte parent.",
                    400,
                    new Error(),
                );
            }
            const hasExplicitPrimaryTutor = Array.isArray(tuteurs) && tuteurs.some((item) =>
                this.toBool(item?.est_principal, false) ||
                this.toBool(item?.est_responsable_legal, false) ||
                this.toBool(item?.est_responsable_financier, false) ||
                this.toBool(item?.est_contact_urgence, false),
            );
            const transportActive = this.toBool(services?.transport_active, false);
            const cantineActive = this.toBool(services?.cantine_active, false);
            const transportLineId = this.toNullableString(services?.ligne_transport_id);
            const transportStopId = this.toNullableString(services?.arret_transport_id);
            const transportZone = this.toNullableString(services?.zone_transport);
            const transportStartDate = this.toNullableString(services?.date_debut_service);
            const transportEndDate = this.toNullableString(services?.date_fin_service);
            const cantineFormulaId = this.toNullableString(services?.formule_cantine_id);
            const factureDateEmission = scolarite?.date_inscription
                ? new Date(scolarite.date_inscription)
                : new Date();
            const anneeScolaire = await this.prisma.anneeScolaire.findFirst({
                where: {
                    etablissement_id,
                    ...(requestedAnneeScolaireId ? { id: requestedAnneeScolaireId } : { est_active: true }),
                },
                select: {
                    id: true,
                    nom: true,
                    date_debut: true,
                    date_fin: true,
                },
            });
            if (!anneeScolaire) {
                return Response.error(
                    res,
                    requestedAnneeScolaireId
                        ? "L'annee scolaire selectionnee n'appartient pas a cet etablissement."
                        : "Aucune année scolaire courante n’est définie.",
                    400,
                    new Error(),
                );
            }
            const effectiveAnneeScolaireId = anneeScolaire.id;
            const etablissementRecord = await this.prisma.etablissement.findUnique({
                where: { id: etablissement_id },
                select: {
                    id: true,
                    parametres_json: true,
                },
            });
            if (!etablissementRecord) {
                return Response.error(res, "L'etablissement selectionne est introuvable.", 400, new Error());
            }
            const niveauRecord = requestedNiveauScolaireId
                ? await this.prisma.niveauScolaire.findFirst({
                    where: {
                        id: requestedNiveauScolaireId,
                        etablissement_id,
                    },
                    select: {
                        id: true,
                        nom: true,
                    },
                })
                : null;
            if (requestedNiveauScolaireId && !niveauRecord) {
                return Response.error(res, "Le niveau selectionne est invalide.", 400, new Error());
            }
            const classe = requestedClasseId
                ? await this.prisma.classe.findFirst({
                    where: {
                        id: requestedClasseId,
                        etablissement_id,
                        annee_scolaire_id: effectiveAnneeScolaireId,
                    },
                    select: {
                        id: true,
                        niveau_scolaire_id: true,
                        nom: true,
                        capacite: true,
                    },
                })
                : null;
            if (requestedClasseId && !classe) {
                return Response.error(res, "La classe selectionnee n'appartient pas a cet etablissement ou a cette annee scolaire.", 400, new Error());
            }
            if (classe && requestedNiveauScolaireId && classe.niveau_scolaire_id !== requestedNiveauScolaireId) {
                return Response.error(res, "La classe selectionnee n'appartient pas au niveau choisi.", 400, new Error());
            }
            const effectiveNiveauScolaireId = classe?.niveau_scolaire_id ?? niveauRecord?.id ?? null;
            if (!effectiveNiveauScolaireId) {
                return Response.error(res, "Le niveau selectionne est invalide.", 400, new Error());
            }
            if (classe) {
                const currentClassOccupancy = await this.countClasseOccupancy(this.prisma, {
                    classeId: classe.id,
                    anneeScolaireId: effectiveAnneeScolaireId,
                });
                const classCapacityState = this.computeClasseCapacityState(classe.capacite ?? null, currentClassOccupancy);
                if (classCapacityState.isFull) {
                    return Response.error(
                        res,
                        `La classe selectionnee est pleine (${classCapacityState.occupancy}/${classCapacityState.capacity}).`,
                        400,
                        new Error(),
                    );
                }
            }
            const duplicateNom = this.toNullableString(eleve?.nom);
            const duplicatePrenom = this.toNullableString(eleve?.prenom);
            const probableDuplicateCount =
                duplicateNom &&
                duplicatePrenom &&
                eleve?.date_naissance
                    ? await this.prisma.eleve.count({
                        where: {
                            etablissement_id,
                            utilisateur: {
                                is: {
                                    profil: {
                                        is: {
                                            nom: duplicateNom,
                                            prenom: duplicatePrenom,
                                            date_naissance: new Date(eleve.date_naissance),
                                        },
                                    },
                                },
                            },
                        },
                    })
                    : 0;
            if (probableDuplicateCount > 0) {
                return Response.error(res, "Un eleve similaire existe deja dans le systeme.", 400, new Error());
            }
            if (transportActive && !transportLineId) {
                return Response.error(res, "Activez une ligne de transport pour ouvrir le service transport.", 400, new Error());
            }
            if (cantineActive && !cantineFormulaId) {
                return Response.error(res, "Activez une formule de cantine pour ouvrir le service cantine.", 400, new Error());
            }
            let transportLineRecord: {
                id: string;
                catalogue_frais_id: string | null;
                infos_vehicule_json: Prisma.JsonValue | null;
            } | null = null;
            if (transportLineId) {
                transportLineRecord = await this.prisma.ligneTransport.findFirst({
                    where: {
                        id: transportLineId,
                        etablissement_id,
                    },
                    select: { id: true, catalogue_frais_id: true, infos_vehicule_json: true },
                });
                if (!transportLineRecord) {
                    return Response.error(res, "La ligne de transport selectionnee n'appartient pas a cet etablissement.", 400, new Error());
                }
                const lineSettings = this.parseLigneTransportSettings(transportLineRecord.infos_vehicule_json);
                if (transportActive && !lineSettings.inscriptions_ouvertes) {
                    return Response.error(res, "La ligne de transport selectionnee n'est pas ouverte aux nouvelles demandes.", 400, new Error());
                }
                if (transportActive && !transportZone) {
                    return Response.error(res, "Selectionnez une zone de transport.", 400, new Error());
                }
                if (transportActive && transportZone && !lineSettings.zones.includes(transportZone)) {
                    return Response.error(res, "La zone de transport selectionnee n'est pas parametree sur cette ligne.", 400, new Error());
                }
            }
            if (transportStopId) {
                if (!transportLineId) {
                    return Response.error(res, "Selectionnez d'abord une ligne de transport avant l'arret.", 400, new Error());
                }
                const transportStop = await this.prisma.arretTransport.findFirst({
                    where: {
                        id: transportStopId,
                        ligne_transport_id: transportLineId,
                    },
                    select: { id: true },
                });
                if (!transportStop) {
                    return Response.error(res, "L'arret de transport selectionne n'appartient pas a la ligne choisie.", 400, new Error());
                }
            }
            const transportDateDebut = transportStartDate ? new Date(transportStartDate) : null;
            const transportDateFin = transportEndDate ? new Date(transportEndDate) : null;
            if (transportDateDebut && Number.isNaN(transportDateDebut.getTime())) {
                return Response.error(res, "La date de debut du transport est invalide.", 400, new Error());
            }
            if (transportDateFin && Number.isNaN(transportDateFin.getTime())) {
                return Response.error(res, "La date de fin du transport est invalide.", 400, new Error());
            }
            if (transportDateDebut && transportDateFin && transportDateFin < transportDateDebut) {
                return Response.error(res, "La date de fin du transport doit etre posterieure a la date de debut.", 400, new Error());
            }
            if (transportDateDebut && (transportDateDebut < anneeScolaire.date_debut || transportDateDebut > anneeScolaire.date_fin)) {
                return Response.error(res, "La date de debut du transport doit etre incluse dans l'annee scolaire.", 400, new Error());
            }
            if (transportDateFin && (transportDateFin < anneeScolaire.date_debut || transportDateFin > anneeScolaire.date_fin)) {
                return Response.error(res, "La date de fin du transport doit etre incluse dans l'annee scolaire.", 400, new Error());
            }
            let cantineFormulaRecord: { id: string; catalogue_frais_id: string | null } | null = null;
            if (cantineFormulaId) {
                cantineFormulaRecord = await this.prisma.formuleCantine.findFirst({
                    where: {
                        id: cantineFormulaId,
                        etablissement_id,
                    },
                    select: { id: true, catalogue_frais_id: true },
                });
                if (!cantineFormulaRecord) {
                    return Response.error(res, "La formule de cantine selectionnee n'appartient pas a cet etablissement.", 400, new Error());
                }
                if (cantineActive && !cantineFormulaRecord.catalogue_frais_id) {
                    return Response.error(res, "La formule de cantine selectionnee n'est reliee a aucun frais catalogue.", 400, new Error());
                }
            }
            const resolvedFinance = {
                ...(finance ?? {}),
                catalogue_frais_transport_id:
                    null,
                catalogue_frais_cantine_id:
                    null,
            };
            const invoiceLines = await this.buildInvoiceLines(
                this.prisma,
                etablissement_id,
                effectiveNiveauScolaireId,
                resolvedFinance,
                {
                    transportActive,
                    cantineActive,
                },
                {
                    classeId: classe?.id ?? null,
                    invoiceDate: factureDateEmission,
                    schoolYearStartDate: anneeScolaire.date_debut,
                },
            );
            const billingReadiness = await assessBillingReadiness(this.prisma, {
                tenantId: etablissement_id,
                anneeScolaireId: effectiveAnneeScolaireId,
                referenceDate: factureDateEmission,
                catalogueFraisIds: invoiceLines.map((line) => line.catalogue_frais_id ?? null),
            });
            const blockingBillingIssues = billingReadiness.issues.filter((item) => item.severity === "error");
            if (blockingBillingIssues.length > 0) {
                return Response.error(
                    res,
                    `Les parametres de facturation ne sont pas prets: ${blockingBillingIssues
                        .map((item) => item.message)
                        .join(" ")}`,
                    400,
                    new Error(),
                );
            }
            const totalBrut = invoiceLines.reduce((sum, line) => sum + line.montant, 0);
            const schoolYearStartDate = this.getSchoolYearScheduleStartDate(anneeScolaire.date_debut);
            const schoolYearEndDate = this.getSchoolYearScheduleEndDate(anneeScolaire.date_fin);
            const invoiceDevise =
                invoiceLines.find((line) => line.devise)?.devise ??
                "MGA";
            const normalizedModePaiement = this.deriveScheduleMode(invoiceLines);
            const jourPaiementMensuel =
                normalizedModePaiement === "ECHELONNE"
                    ? this.resolvePaymentDayOfMonth(
                        echeancier?.jour_paiement_mensuel,
                        null,
                    )
                    : null;
            if (normalizedModePaiement === "ECHELONNE" && !jourPaiementMensuel) {
                return Response.error(res, "Le jour du mois de paiement est obligatoire pour un echeancier en plusieurs tranches.", 400, new Error());
            }

            const result = await this.prisma.$transaction(async (tx) => {
                const studentLoginIdentifier =
                    this.toNullableString(normalizedAccessPayload?.identifiant_connexion_eleve) ??
                    this.toNullableString(scolarite?.code_eleve);
                const studentAccountEnabled = this.toBool(
                    normalizedAccessPayload?.creer_compte_eleve,
                    false,
                );
                const userEleve = await tx.utilisateur.create({
                    data: {
                        etablissement_id,
                        email: this.toNullableString(eleve?.email_eleve) ?? studentLoginIdentifier,
                        telephone: this.toNullableString(eleve?.telephone_eleve),
                        mot_de_passe_hash: await bcrypt.hash(passEleve, 10),
                        scope_json: {
                            account: {
                                delivery_method:
                                    this.toNullableString(normalizedAccessPayload?.methode_envoi_identifiants) ??
                                    null,
                                email: studentLoginIdentifier,
                                enabled: studentAccountEnabled,
                                password: passEleve,
                                send_after_validation: this.toBool(
                                    normalizedAccessPayload?.envoyer_identifiants_apres_validation,
                                    true,
                                ),
                            },
                            type: "eleve",
                        } as Prisma.InputJsonValue,
                        statut: studentAccountEnabled ? "ACTIF" : "INACTIF",
                    },
                });

                await tx.profil.create({
                    data: {
                        utilisateur_id: userEleve.id,
                        prenom: eleve?.prenom ?? "",
                        nom: eleve?.nom ?? "",
                        date_naissance: eleve?.date_naissance ? new Date(eleve.date_naissance) : null,
                        lieu_naissance: this.toNullableString(eleve?.lieu_naissance),
                        nationalite: this.toNullableString(eleve?.nationalite),
                        genre: this.toNullableString(eleve?.genre),
                        photo_url: this.toNullableString(eleve?.photo_url),
                        adresse: this.toNullableString(eleve?.adresse),
                        telephone_personnel: this.toNullableString(eleve?.telephone_eleve),
                        email_personnel: this.toNullableString(eleve?.email_eleve),
                        contact_urgence_json:
                            eleve?.contact_urgence_json != null
                                ? (eleve.contact_urgence_json as Prisma.InputJsonValue)
                                : Prisma.JsonNull,
                    },
                });

                const eleveCreated = await tx.eleve.create({
                    data: {
                        etablissement_id,
                        utilisateur_id: userEleve.id,
                        code_eleve: this.toNullableString(scolarite?.code_eleve),
                        date_entree: scolarite?.date_entree ? new Date(scolarite.date_entree) : null,
                        statut: "ACTIF",
                    },
                });

                const normalizedMedicalPayload = this.normalizeMedicalProfilePayload(medical);
                const hasMedicalPayload = Object.values(normalizedMedicalPayload).some((value) => {
                    if (typeof value === "boolean") return value;
                    return value !== null && value !== undefined && value !== "";
                });
                if (hasMedicalPayload) {
                    await tx.eleveMedicalProfile.create({
                        data: {
                            eleve_id: eleveCreated.id,
                            ...normalizedMedicalPayload,
                        },
                    });
                }

                const linkedParents: Array<{
                    id: string;
                    utilisateur_id: string | null;
                    reused: boolean;
                    nom_complet: string;
                }> = [];

                for (const [index, t] of (tuteurs as any[]).entries()) {
                    if (
                        !t ||
                        !(
                            this.toNullableString(t.parent_tuteur_id) ||
                            t.nom ||
                            t.prenom ||
                            t.telephone ||
                            t.email
                        )
                    ) continue;

                    const parent = await this.findOrCreateParentTuteur(tx, {
                        allowUserAccount: this.toBool(normalizedAccessPayload?.creer_compte_parent, false) && (index === 0 || this.toBool(t?.est_principal, false)),
                        etablissement_id,
                        loginEmail:
                            index === 0
                                ? this.toNullableString(normalizedAccessPayload?.email_connexion_parent)
                                : null,
                        raw: t,
                        deliveryMethod: this.toNullableString(normalizedAccessPayload?.methode_envoi_identifiants),
                        generatedPassword: passTuteur,
                    });
                    const fallbackPrimary = !hasExplicitPrimaryTutor && index === 0;
                    const estPrincipal = this.toBool(t.est_principal, fallbackPrimary);
                    const estResponsableLegal = this.toBool(t.est_responsable_legal, estPrincipal);
                    const estResponsableFinancier = this.toBool(t.est_responsable_financier, estPrincipal);
                    const estContactUrgence = this.toBool(t.est_contact_urgence, estPrincipal);

                    await tx.eleveParentTuteur.upsert({
                        where: {
                            eleve_id_parent_tuteur_id: {
                                eleve_id: eleveCreated.id,
                                parent_tuteur_id: parent.id,
                            },
                        },
                        create: {
                            eleve_id: eleveCreated.id,
                            parent_tuteur_id: parent.id,
                            relation: this.toNullableString(t.relation),
                            est_principal: estPrincipal,
                            est_responsable_legal: estResponsableLegal,
                            est_responsable_financier: estResponsableFinancier,
                            est_contact_urgence: estContactUrgence,
                            autorise_recuperation: this.toBool(t.autorise_recuperation, true),
                        },
                        update: {
                            relation: this.toNullableString(t.relation),
                            est_principal: estPrincipal,
                            est_responsable_legal: estResponsableLegal,
                            est_responsable_financier: estResponsableFinancier,
                            est_contact_urgence: estContactUrgence,
                            autorise_recuperation: this.toBool(t.autorise_recuperation, true),
                        },
                    });

                    if (!linkedParents.some((item) => item.id === parent.id)) {
                        linkedParents.push(parent);
                    }
                }

                const fratrie = await this.computeSiblingContext(
                    tx,
                    linkedParents.map((item) => item.id),
                    eleveCreated.id,
                    effectiveAnneeScolaireId,
                );
                const appliedRemise = await this.resolveApplicableFinanceRemise(
                    tx,
                    etablissement_id,
                    finance,
                    fratrie.sibling_rank,
                );
                const remiseSourceKeys = appliedRemise?.apply_on_source_keys ?? null;
                const remiseBase = this.computeDiscountBase(invoiceLines, remiseSourceKeys);
                const remiseMontant = this.computeDiscount(
                    remiseBase,
                    appliedRemise?.type ?? finance?.remise_type ?? "AUCUNE",
                    appliedRemise?.valeur ?? this.toMoney(finance?.remise_valeur),
                );
                const finalInvoiceLines = this.applyDiscountToInvoiceLines(
                    invoiceLines,
                    remiseMontant,
                    appliedRemise?.nom ?? null,
                    remiseSourceKeys,
                );
            const totalNet = this.roundMoney(
                finalInvoiceLines.reduce((sum, line) => sum + line.montant, 0),
            );
            const requestedInitialPaymentAmount = this.roundMoney(
                Math.max(0, this.toMoney(finance?.montant_paye_initial)),
            );
            const requestedInitialPaymentMethod = this.normalizeInitialPaymentMethod(
                finance?.mode_paiement_initial,
            );
            const requestedInitialPaymentReference = this.toNullableString(
                finance?.reference_paiement_initial,
            );
            const requestedInitialPaymentDate = this.parseOptionalDate(
                finance?.date_paiement_initial,
            );
            if (
                finance?.date_paiement_initial !== undefined &&
                finance?.date_paiement_initial !== null &&
                finance?.date_paiement_initial !== "" &&
                !requestedInitialPaymentDate
            ) {
                return Response.error(res, "La date du paiement initial est invalide.", 400, new Error());
            }
            if (requestedInitialPaymentAmount > totalNet) {
                return Response.error(
                    res,
                    "Le montant paye ne peut pas depasser le montant total facture.",
                    400,
                    new Error(),
                );
            }
            if (requestedInitialPaymentAmount > 0 && !requestedInitialPaymentMethod) {
                return Response.error(
                    res,
                    "Le mode de paiement initial est obligatoire lorsqu'un versement est enregistre.",
                    400,
                    new Error(),
                );
            }
            const effectiveInitialPaymentAmount =
                totalNet > 0 ? Math.min(totalNet, requestedInitialPaymentAmount) : 0;
            const hasFinancialFlow = finalInvoiceLines.length > 0;
            const paymentSchedule = this.buildPaymentSchedule(
                invoiceLines,
                remiseMontant,
                normalizedModePaiement,
                    schoolYearStartDate,
                    schoolYearEndDate,
                    factureDateEmission,
                    jourPaiementMensuel,
                    remiseSourceKeys,
                );
                const factureDateEcheance = paymentSchedule.length > 0
                    ? new Date(paymentSchedule[0].date)
                    : (normalizedModePaiement === "COMPTANT" ? factureDateEmission : schoolYearStartDate);

                const inscription = await tx.inscription.create({
                    data: {
                        eleve_id: eleveCreated.id,
                        niveau_scolaire_id: effectiveNiveauScolaireId,
                        classe_id: classe?.id ?? null,
                        annee_scolaire_id: effectiveAnneeScolaireId,
                        date_inscription: factureDateEmission,
                        type_inscription: requestedInscriptionType,
                        statut: requestedInscriptionStatus,
                        statut_administratif: "EN_ATTENTE",
                        statut_financier: hasFinancialFlow ? "FACTURE" : "NON_FACTURE",
                        statut_dossier: "INCOMPLET",
                        completion_rate: 0,
                        acces_systeme_json: normalizedAccessPayload as Prisma.InputJsonValue,
                        consentements_json: normalizedConsentsPayload as Prisma.InputJsonValue,
                        observations_json: normalizedObservationsPayload as Prisma.InputJsonValue,
                    },
                });
                const normalizedSchoolHistoryPayload = this.normalizeSchoolHistoryPayload(historique_scolaire);
                const hasSchoolHistoryPayload = Object.values(normalizedSchoolHistoryPayload).some((value) => {
                    if (typeof value === "boolean") return value;
                    return value !== null && value !== undefined && value !== "";
                });
                if (hasSchoolHistoryPayload) {
                    await tx.inscriptionSchoolHistory.create({
                        data: {
                            inscription_id: inscription.id,
                            ...normalizedSchoolHistoryPayload,
                        },
                    });
                }
                const documentTemplates = await this.resolveInscriptionDocumentTypes(
                    tx,
                    etablissement_id,
                    requestedInscriptionType,
                );
                const requestedDocuments = Array.isArray(documents)
                    ? documents
                        .map((item) => ({
                            content_base64: this.toNullableString(item?.content_base64),
                            file_name: this.toNullableString(item?.file_name),
                            document_type_id: this.toNullableString(item?.document_type_id),
                            fourni: this.toBool(item?.fourni, false),
                            mime_type: this.toNullableString(item?.mime_type),
                            statut: this.normalizeInscriptionDocumentStatus(
                                item?.statut,
                                this.toBool(item?.fourni, false) || this.toNullableString(item?.content_base64)
                                    ? "FOURNI"
                                    : "NON_FOURNI",
                            ),
                            date_depot: this.parseOptionalDate(item?.date_depot),
                            commentaire_admin: this.toNullableString(item?.commentaire_admin),
                        }))
                        .filter((item) => item.document_type_id)
                    : [];
                const requestedDocumentsByTypeId = new Map(
                    requestedDocuments.map((item) => [item.document_type_id as string, item]),
                );
                const initialInscriptionDocuments = documentTemplates.map((documentType) => ({
                    ...(requestedDocumentsByTypeId.get(documentType.id)?.fourni
                        ? {
                            date_depot:
                                requestedDocumentsByTypeId.get(documentType.id)?.date_depot ??
                                factureDateEmission,
                            commentaire_admin:
                                requestedDocumentsByTypeId.get(documentType.id)?.commentaire_admin ??
                                null,
                        }
                        : {}),
                    inscription_id: inscription.id,
                    document_type_id: documentType.id,
                    obligatoire: Boolean(documentType.est_obligatoire_par_defaut),
                    fourni:
                        Boolean(requestedDocumentsByTypeId.get(documentType.id)?.fourni) ||
                        Boolean(requestedDocumentsByTypeId.get(documentType.id)?.content_base64),
                    statut:
                        Boolean(requestedDocumentsByTypeId.get(documentType.id)?.fourni) ||
                        Boolean(requestedDocumentsByTypeId.get(documentType.id)?.content_base64)
                        ? requestedDocumentsByTypeId.get(documentType.id)?.statut ?? ("FOURNI" as const)
                        : ("NON_FOURNI" as const),
                }));
                if (initialInscriptionDocuments.length > 0) {
                    await tx.inscriptionDocument.createMany({
                        data: initialInscriptionDocuments,
                    });
                }

                const pendingUploadedDocuments = requestedDocuments.filter(
                    (item) => item.document_type_id && item.file_name && item.content_base64,
                );
                if (pendingUploadedDocuments.length > 0) {
                    const createdDocuments = await tx.inscriptionDocument.findMany({
                        where: {
                            inscription_id: inscription.id,
                            document_type_id: {
                                in: pendingUploadedDocuments
                                    .map((item) => item.document_type_id)
                                    .filter((value): value is string => Boolean(value)),
                            },
                        },
                        include: {
                            documentType: true,
                        },
                    });

                    const documentsByTypeId = new Map(
                        createdDocuments.map((item) => [item.document_type_id, item]),
                    );

                    for (const pendingDocument of pendingUploadedDocuments) {
                        const createdDocument = documentsByTypeId.get(
                            pendingDocument.document_type_id as string,
                        );
                        if (!createdDocument || !pendingDocument.file_name || !pendingDocument.content_base64) {
                            continue;
                        }

                        const fileBuffer = this.decodeBase64File(pendingDocument.content_base64);
                        if (fileBuffer.length === 0) {
                            throw new Error(
                                `Le fichier transmis pour ${createdDocument.documentType.nom} est vide.`,
                            );
                        }
                        if (fileBuffer.length > 10 * 1024 * 1024) {
                            throw new Error(
                                `Le fichier transmis pour ${createdDocument.documentType.nom} depasse la limite de 10 Mo.`,
                            );
                        }

                        const storageDirectory = path.resolve(
                            process.cwd(),
                            "storage",
                            "inscriptions",
                            etablissement_id,
                            inscription.id,
                        );
                        await fs.mkdir(storageDirectory, { recursive: true });

                        const storedFileName = this.buildStoredFileName(
                            createdDocument.documentType.code,
                            pendingDocument.file_name,
                        );
                        const absoluteFilePath = path.join(storageDirectory, storedFileName);
                        await fs.writeFile(absoluteFilePath, fileBuffer);

                        const relativeFilePath = path
                            .relative(process.cwd(), absoluteFilePath)
                            .replace(/\\/g, "/");

                        const createdFile = await tx.fichier.create({
                            data: {
                                etablissement_id,
                                proprietaire_utilisateur_id: this.getRequestUserId(req),
                                fournisseur_stockage: "STOCKAGE_LOCAL",
                                chemin: relativeFilePath,
                                type_mime: pendingDocument.mime_type,
                                taille: fileBuffer.length,
                            },
                        });

                        await tx.inscriptionDocument.update({
                            where: { id: createdDocument.id },
                            data: {
                                fichier_id: createdFile.id,
                                fourni: true,
                                statut: ["VALIDE", "REJETE"].includes(createdDocument.statut)
                                    ? createdDocument.statut
                                    : "FOURNI",
                                date_depot:
                                    pendingDocument.date_depot ??
                                    createdDocument.date_depot ??
                                    factureDateEmission,
                                commentaire_admin:
                                    pendingDocument.commentaire_admin ?? createdDocument.commentaire_admin,
                            },
                        });

                        await tx.lienFichier.create({
                            data: {
                                fichier_id: createdFile.id,
                                type_entite: "inscriptions_documents",
                                id_entite: createdDocument.id,
                                tag: createdDocument.documentType.code,
                            },
                        });
                    }
                }

                let abonnementTransport = null;
                if (transportActive && transportLineId) {
                    abonnementTransport = await tx.abonnementTransport.create({
                        data: {
                            eleve_id: eleveCreated.id,
                            annee_scolaire_id: effectiveAnneeScolaireId,
                            ligne_transport_id: transportLineId,
                            arret_transport_id: transportStopId,
                            statut: "EN_ATTENTE_VALIDATION_INTERNE",
                        },
                    });
                    await tx.$executeRaw(
                        Prisma.sql`UPDATE abonnements_transport
                          SET zone_transport = ${transportZone},
                              date_debut_service = ${transportDateDebut},
                              date_fin_service = ${transportDateFin}
                          WHERE id = ${abonnementTransport.id}`,
                    );
                }

                let abonnementCantine = null;
                if (cantineActive && cantineFormulaId) {
                    abonnementCantine = await tx.abonnementCantine.create({
                        data: {
                            eleve_id: eleveCreated.id,
                            annee_scolaire_id: effectiveAnneeScolaireId,
                            formule_cantine_id: cantineFormulaId,
                            statut: "EN_ATTENTE_VALIDATION_FINANCIERE",
                        },
                    });
                    await tx.$executeRaw(
                        Prisma.sql`UPDATE abonnements_cantine
                          SET date_effet = ${factureDateEmission}
                          WHERE id = ${abonnementCantine.id}`,
                    );
                }

                let facture = null;
                let paiementInitial = null;
                if (hasFinancialFlow) {
                    const numeroFacture = await this.buildInvoiceNumber(tx, etablissement_id);
                    const statutFacture = this.deriveFactureStatus(
                        "EMISE",
                        totalNet,
                        effectiveInitialPaymentAmount,
                        factureDateEcheance,
                    );

                    facture = await tx.facture.create({
                        data: {
                            etablissement_id,
                            eleve_id: eleveCreated.id,
                            annee_scolaire_id: effectiveAnneeScolaireId,
                            remise_id: appliedRemise?.id ?? null,
                            numero_facture: numeroFacture,
                            date_emission: factureDateEmission,
                            date_echeance: factureDateEcheance,
                            statut: statutFacture,
                            total_montant: totalNet,
                            devise: invoiceDevise,
                        },
                    });

                    await tx.operationFinanciere.create({
                        data: {
                            etablissement_id,
                            facture_id: facture.id,
                            cree_par_utilisateur_id: (req as Request & { user?: { sub?: string } }).user?.sub ?? null,
                            type: "CREATION_FACTURE",
                            montant: totalNet,
                            motif: "Facture creee depuis l'inscription.",
                            details_json: {
                                source: "INSCRIPTION",
                                numero_facture: numeroFacture,
                                inscription_id: inscription.id,
                            },
                        },
                    });

                    await tx.factureLigne.createMany({
                        data: finalInvoiceLines.map((line) => ({
                            facture_id: facture!.id,
                            catalogue_frais_id: line.catalogue_frais_id ?? null,
                            libelle: line.libelle,
                            quantite: 1,
                            prix_unitaire: line.montant,
                            montant: line.montant,
                        })),
                    });

                    for (const line of finalInvoiceLines) {
                        if (
                            (line.usage_scope ?? "").toUpperCase() === "SCOLARITE" ||
                            (line.mode_facturation ?? "").toUpperCase() === "ANNUEL"
                        ) {
                            continue;
                        }
                        await createRecurringExecutionIfNeeded(tx, {
                            tenantId: etablissement_id,
                            eleveId: eleveCreated.id,
                            anneeScolaireId: effectiveAnneeScolaireId,
                            factureId: facture.id,
                            catalogueFraisId: line.catalogue_frais_id ?? null,
                            createdByUtilisateurId: (req as Request & { user?: { sub?: string } }).user?.sub ?? null,
                            referenceDate: factureDateEmission,
                            runId: `INSCRIPTION-${inscription.id}`,
                        });
                    }

                    if (effectiveInitialPaymentAmount > 0) {
                        const paymentDate = requestedInitialPaymentDate ?? factureDateEmission;
                        const storedPaymentMethod = this.mapInitialPaymentMethodToStoredValue(
                            requestedInitialPaymentMethod,
                        );
                        const paymentReference =
                            requestedInitialPaymentReference ??
                            await this.buildEnrollmentPaymentReference(
                                tx,
                                etablissement_id,
                                paymentDate,
                                storedPaymentMethod,
                            );
                        const receiptNumber = await this.buildEnrollmentReceiptNumber(
                            tx,
                            etablissement_id,
                            paymentDate,
                        );
                        paiementInitial = await tx.paiement.create({
                            data: {
                                facture_id: facture.id,
                                paye_le: paymentDate,
                                montant: effectiveInitialPaymentAmount,
                                methode: storedPaymentMethod,
                                reference: paymentReference,
                                numero_recu: receiptNumber,
                                recu_par: null,
                            },
                        });
                    }

                    await this.notifyFamilyForGeneratedInvoice(tx, {
                        tenantId: etablissement_id,
                        factureId: facture.id,
                        eleveId: eleveCreated.id,
                        numeroFacture: numeroFacture,
                        totalMontant: totalNet,
                        devise: invoiceDevise,
                        dueDate: factureDateEcheance,
                    });
                }

                let planPaiement = null;
                if (hasFinancialFlow) {
                    const planJson = {
                        mode_paiement: normalizedModePaiement,
                        jour_paiement_mensuel: jourPaiementMensuel,
                        nombre_tranches: paymentSchedule.length,
                        devise: invoiceDevise,
                        notes: this.toNullableString(echeancier?.notes),
                        echeances: paymentSchedule,
                        services: {
                            transport_active: transportActive,
                            transport_mode_facturation: transportActive ? "SERVICE_ONLY" : null,
                            ligne_transport_id: transportActive ? transportLineId : null,
                            arret_transport_id: transportActive ? transportStopId : null,
                            zone_transport: transportActive ? transportZone : null,
                            date_debut_service: transportActive ? transportDateDebut?.toISOString() ?? null : null,
                            date_fin_service: transportActive ? transportDateFin?.toISOString() ?? null : null,
                            cantine_active: cantineActive,
                            cantine_mode_facturation: cantineActive ? "SERVICE_ONLY" : null,
                            formule_cantine_id: cantineActive ? cantineFormulaId : null,
                        },
                        finance: {
                            catalogue_frais_inscription_id: this.toNullableString(finance?.catalogue_frais_inscription_id),
                            catalogue_frais_inscription_plan_code: this.toNullableString(finance?.catalogue_frais_inscription_plan_code),
                            catalogue_frais_inscription_plan_label:
                                invoiceLines.find((line) => line.source_key === "catalogue_frais_inscription_id")?.plan_label ?? null,
                            catalogue_frais_inscription_nombre_tranches:
                                invoiceLines.find((line) => line.source_key === "catalogue_frais_inscription_id")?.nombre_tranches ??
                                this.resolveFinanceLineTrancheCount(finance?.catalogue_frais_inscription_nombre_tranches),
                            catalogue_frais_scolarite_id: this.toNullableString(finance?.catalogue_frais_scolarite_id),
                            catalogue_frais_scolarite_plan_code: this.toNullableString(finance?.catalogue_frais_scolarite_plan_code),
                            catalogue_frais_scolarite_plan_label:
                                invoiceLines.find((line) => line.source_key === "catalogue_frais_scolarite_id")?.plan_label ?? null,
                            catalogue_frais_scolarite_nombre_tranches:
                                invoiceLines.find((line) => line.source_key === "catalogue_frais_scolarite_id")?.nombre_tranches ??
                                this.resolveFinanceLineTrancheCount(finance?.catalogue_frais_scolarite_nombre_tranches),
                            catalogue_frais_transport_id: null,
                            catalogue_frais_cantine_id: null,
                            remise_id: appliedRemise?.id ?? this.toNullableString(finance?.remise_id),
                            remise_nom: appliedRemise?.nom ?? null,
                            frais_inscription: this.extractFinanceLineAmount(invoiceLines, "catalogue_frais_inscription_id", finance),
                            frais_scolarite: this.extractFinanceLineAmount(invoiceLines, "catalogue_frais_scolarite_id", finance),
                            frais_transport: 0,
                            frais_cantine: null,
                            remise_type: appliedRemise?.type ?? finance?.remise_type ?? "AUCUNE",
                            remise_valeur: appliedRemise?.valeur ?? this.toMoney(finance?.remise_valeur),
                            remise_montant: remiseMontant,
                            montant_paye_initial: effectiveInitialPaymentAmount,
                            mode_paiement_initial: requestedInitialPaymentMethod,
                            reference_paiement_initial:
                                requestedInitialPaymentReference ??
                                paiementInitial?.reference ??
                                null,
                            date_paiement_initial:
                                effectiveInitialPaymentAmount > 0
                                    ? (requestedInitialPaymentDate ?? factureDateEmission).toISOString().slice(0, 10)
                                    : null,
                            remise_automatique_fratrie: appliedRemise?.automatique_fratrie ?? false,
                            remise_source_fratrie: appliedRemise?.source_fratrie ?? false,
                            fratrie_detectee: fratrie.detected,
                            fratrie_rang: fratrie.sibling_rank,
                            fratrie_nombre_autres_enfants: fratrie.sibling_count,
                            total_brut: totalBrut,
                            total_net: totalNet,
                            devise: invoiceDevise,
                            annee_scolaire_debut: schoolYearStartDate.toISOString().slice(0, 10),
                            jour_paiement_mensuel: jourPaiementMensuel,
                        },
                        metadata: {
                            cree_depuis_inscription: true,
                            inscription_id: inscription.id,
                            facture_id: facture?.id ?? null,
                            paiement_initial_id: paiementInitial?.id ?? null,
                            linked_parent_ids: linkedParents.map((item) => item.id),
                            linked_parent_reused_ids: linkedParents.filter((item) => item.reused).map((item) => item.id),
                        },
                    };

                    planPaiement = await tx.planPaiementEleve.create({
                        data: {
                            eleve_id: eleveCreated.id,
                            annee_scolaire_id: effectiveAnneeScolaireId,
                            remise_id: appliedRemise?.id ?? null,
                            plan_json: planJson as Prisma.InputJsonValue,
                        },
                    });

                    await upsertPlanEcheances(tx, {
                        planId: planPaiement.id,
                        factureId: facture?.id ?? null,
                        eleveId: eleveCreated.id,
                        anneeScolaireId: effectiveAnneeScolaireId,
                        devise: invoiceDevise,
                        lines: paymentSchedule as EcheanceInput[],
                    });

                    if (facture?.id) {
                        await allocatePaiementsToFactureEcheances(tx, facture.id);
                    } else {
                        await syncPlanJsonFromEcheances(tx, planPaiement.id);
                    }
                }
                const totalPayeInitial = paiementInitial ? this.toMoney(paiementInitial.montant) : 0;
                const remainingInitialBalance = hasFinancialFlow
                    ? Math.max(0, paymentSchedule.reduce((sum, item) => sum + this.toMoney(item.montant), 0) - totalPayeInitial)
                    : 0;
                const today = this.startOfDay(new Date());
                const overdueCount = paymentSchedule.filter((item) => {
                    const dueDate = this.startOfDay(new Date(item.date));
                    return this.toMoney(item.montant) > 0 && dueDate.getTime() < today.getTime();
                }).length;
                const finalFinanceStatus = this.deriveInscriptionFinanceStatus({
                    totalFacture: totalNet,
                    totalPaye: totalPayeInitial,
                    resteARegler: remainingInitialBalance,
                    overdueCount,
                });
                const financePolicy = this.resolveEnrollmentFinancePolicy(etablissementRecord.parametres_json ?? null);
                const enrollmentFinanceBreakdown = this.computeEnrollmentFinanceBreakdownFromInvoiceLines(
                    invoiceLines,
                    remiseMontant,
                    remiseSourceKeys,
                );
                const minimumPaymentStatus = this.computeEnrollmentMinimumPaymentStatus({
                    totalFacture: totalNet,
                    totalPaye: totalPayeInitial,
                    policy: financePolicy,
                    breakdown: enrollmentFinanceBreakdown,
                });
                const finalDossierStatus = this.deriveInscriptionDossierStatus(initialInscriptionDocuments);
                const finalAdministrativeStatus = this.deriveInscriptionAdministrativeStatus({
                    requestedStatus: requestedInscriptionStatus,
                    dossierStatus: finalDossierStatus,
                    financeStatus: finalFinanceStatus,
                    financeValidationSatisfied: minimumPaymentStatus.satisfied,
                });
                const finalCompletionRate = this.computeInscriptionCompletionRate({
                    codeEleve: this.toNullableString(scolarite?.code_eleve),
                    eleve,
                    tuteurs,
                    emergencyContact: this.extractJsonObject(
                        eleve?.contact_urgence_json != null
                            ? (eleve.contact_urgence_json as Prisma.JsonValue)
                            : null,
                    ),
                    hasSchoolYear: Boolean(effectiveAnneeScolaireId),
                    hasClass: Boolean(classe?.id),
                    hasLevel: Boolean(effectiveNiveauScolaireId),
                    financeStatus: finalFinanceStatus,
                    documents: initialInscriptionDocuments,
                    documentsConfigured: documentTemplates.length > 0,
                });
                const finalInscriptionStatus = this.deriveInscriptionGlobalStatus({
                    requestedStatus: requestedInscriptionStatus,
                    administrativeStatus: finalAdministrativeStatus,
                    financeStatus: finalFinanceStatus,
                    dossierStatus: finalDossierStatus,
                });

                const updatedInscription = await tx.inscription.update({
                    where: { id: inscription.id },
                    data: {
                        statut: finalInscriptionStatus,
                        statut_administratif: finalAdministrativeStatus,
                        statut_financier: finalFinanceStatus,
                        statut_dossier: finalDossierStatus,
                        completion_rate: finalCompletionRate,
                        validation_date: finalAdministrativeStatus === "VALIDE" ? factureDateEmission : null,
                    },
                });

                await tx.journalAudit.create({
                    data: {
                        etablissement_id,
                        acteur_utilisateur_id: this.getRequestUserId(req),
                        action: "INSCRIPTION_CREATE_FULL",
                        type_entite: "INSCRIPTION",
                        id_entite: updatedInscription.id,
                        apres_json: {
                            inscription_id: updatedInscription.id,
                            eleve_id: eleveCreated.id,
                            classe_id: updatedInscription.classe_id,
                            niveau_scolaire_id: updatedInscription.niveau_scolaire_id,
                            type_inscription: updatedInscription.type_inscription,
                            statut: updatedInscription.statut,
                            statut_administratif: updatedInscription.statut_administratif,
                            statut_financier: updatedInscription.statut_financier,
                            statut_dossier: updatedInscription.statut_dossier,
                            completion_rate: this.toMoney(updatedInscription.completion_rate),
                        } as Prisma.InputJsonValue,
                    },
                });

                return {
                    eleve: eleveCreated,
                    inscription: updatedInscription,
                    abonnementTransport,
                    abonnementCantine,
                    planPaiement,
                    facture,
                    paiementInitial,
                    finance: hasFinancialFlow
                        ? {
                            total_brut: totalBrut,
                            total_net: totalNet,
                            remise_montant: remiseMontant,
                            devise: invoiceDevise,
                            remise: appliedRemise,
                            fratrie,
                            linked_parents: linkedParents,
                        }
                        : null,
                    fratrie,
                    linked_parents: linkedParents,
                };
            });

            Response.success(res, "Inscription complete creee.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de l'inscription complete", 400, error as Error);        }
    }

    private toBool(value: any, fallback = false): boolean {
        if (value === undefined || value === null) return fallback;
        if (typeof value === "boolean") return value;
        if (typeof value === "string") return value === "true" || value === "1";
        if (typeof value === "number") return value !== 0;
        return fallback;
    }

    private toNullableString(value: any): string | null {
        if (value === undefined || value === null) return null;
        const normalized = String(value).trim();
        return normalized.length > 0 ? normalized : null;
    }

    private toMoney(value: any): number {
        const parsed = Number(value ?? 0);
        if (!Number.isFinite(parsed)) return 0;
        return this.roundMoney(parsed);
    }

    private toNullableDecimal(value: unknown) {
        if (value === undefined || value === null || value === "") return null;
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
            throw new Error("La valeur numerique fournie est invalide.");
        }
        return this.roundMoney(parsed);
    }

    private roundMoney(value: number): number {
        return Math.round(value * 100) / 100;
    }

    private normalizeMedicalProfilePayload(raw: any) {
        return {
            groupe_sanguin: this.toNullableString(raw?.groupe_sanguin),
            allergies: this.toNullableString(raw?.allergies),
            maladies_particulieres: this.toNullableString(raw?.maladies_particulieres),
            traitement_medical: this.toNullableString(raw?.traitement_medical),
            medecin_traitant: this.toNullableString(raw?.medecin_traitant),
            telephone_medecin: this.toNullableString(raw?.telephone_medecin),
            autorisation_prise_en_charge_medicale: this.toBool(raw?.autorisation_prise_en_charge_medicale, false),
            personne_a_contacter_urgence: this.toNullableString(raw?.personne_a_contacter_urgence),
            telephone_urgence: this.toNullableString(raw?.telephone_urgence),
        };
    }

    private normalizeSchoolHistoryPayload(raw: any) {
        return {
            ancien_etablissement: this.toNullableString(raw?.ancien_etablissement),
            ancienne_classe: this.toNullableString(raw?.ancienne_classe),
            annee_precedente: this.toNullableString(raw?.annee_precedente),
            derniere_moyenne: this.toNullableDecimal(raw?.derniere_moyenne),
            decision_precedente: this.toNullableString(raw?.decision_precedente),
            mention_precedente: this.toNullableString(raw?.mention_precedente),
            motif_transfert: this.toNullableString(raw?.motif_transfert),
            observations: this.toNullableString(raw?.observations),
            reprise_auto: this.toBool(raw?.reprise_auto, false),
        };
    }

    private normalizeInscriptionAccessPayload(raw: any) {
        return {
            creer_compte_parent: this.toBool(raw?.creer_compte_parent, false),
            creer_compte_eleve: this.toBool(raw?.creer_compte_eleve, false),
            email_connexion_parent: this.toNullableString(raw?.email_connexion_parent),
            identifiant_connexion_eleve: this.toNullableString(raw?.identifiant_connexion_eleve),
            methode_envoi_identifiants: this.toNullableString(raw?.methode_envoi_identifiants),
            envoyer_identifiants_apres_validation: this.toBool(raw?.envoyer_identifiants_apres_validation, true),
        };
    }

    private normalizeInscriptionConsentsPayload(raw: any) {
        return {
            autorisation_sortie: this.toBool(raw?.autorisation_sortie, false),
            autorisation_photo_video: this.toBool(raw?.autorisation_photo_video, false),
            autorisation_activite_scolaire: this.toBool(raw?.autorisation_activite_scolaire, false),
            autorisation_prise_en_charge_medicale: this.toBool(raw?.autorisation_prise_en_charge_medicale, false),
            acceptation_reglement_interieur: this.toBool(raw?.acceptation_reglement_interieur, false),
            acceptation_conditions_financieres: this.toBool(raw?.acceptation_conditions_financieres, false),
            date_acceptation: this.parseOptionalDate(raw?.date_acceptation)?.toISOString() ?? null,
            signataire_nom: this.toNullableString(raw?.signataire_nom),
            commentaire: this.toNullableString(raw?.commentaire),
        };
    }

    private normalizeInscriptionObservationsPayload(raw: any, previousValue: Prisma.JsonValue | null | undefined) {
        const previous = this.extractJsonObject(previousValue);
        const now = new Date().toISOString();
        return {
            observation_administrative: this.toNullableString(raw?.observation_administrative),
            observation_pedagogique: this.toNullableString(raw?.observation_pedagogique),
            observation_financiere: this.toNullableString(raw?.observation_financiere),
            note_interne: this.toNullableString(raw?.note_interne),
            updated_at: now,
            created_at:
                this.toNullableString(previous?.created_at) ??
                now,
        };
    }

    private extractFinanceLineAmount(
        lines: Array<{ source_key: string; montant: number }>,
        sourceKey: string,
        _finance: any,
    ): number {
        const found = lines.find((line) => line.source_key === sourceKey);
        return found ? found.montant : 0;
    }

    private normalizeAnnualPaymentPlans(raw: Prisma.JsonValue | null | undefined, fallbackTranches: number): AnnualPaymentPlan[] {
        if (Array.isArray(raw)) {
            const normalized = raw.flatMap((entry) => {
                if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
                const plan = entry as Record<string, unknown>;
                const code = typeof plan.code === "string" ? plan.code.trim().toUpperCase() : "";
                const label = typeof plan.label === "string" ? plan.label.trim() : "";
                const nombreTranches = this.resolveFinanceLineTrancheCount(plan.nombre_tranches);
                const offsets = Array.isArray(plan.offsets_mois)
                    ? plan.offsets_mois
                        .map((value) => Number.parseInt(String(value), 10))
                        .filter((value) => Number.isFinite(value) && value >= 0 && value <= 11)
                    : [];
                if (!code || !label || offsets.length !== nombreTranches) return [];
                return [{
                    code,
                    label,
                    nombre_tranches: nombreTranches,
                    offsets_mois: offsets,
                }];
            });
            if (normalized.length > 0) {
                return normalized;
            }
        }

        const trancheCount = this.resolveFinanceLineTrancheCount(fallbackTranches);
        return [{
            code: `${trancheCount}X`,
            label: trancheCount === 1 ? "Comptant" : `${trancheCount} tranches`,
            nombre_tranches: trancheCount,
            offsets_mois: Array.from({ length: trancheCount }, (_, index) => index),
        }];
    }

    private resolvePaymentPlanForFee(
        catalogue: {
            nombre_tranches: number;
            plans_paiement_autorises_json: Prisma.JsonValue | null;
            plan_paiement_defaut_code: string | null;
        },
        requestedCode: unknown,
        feeLabel: string,
    ): AnnualPaymentPlan {
        const plans = this.normalizeAnnualPaymentPlans(
            catalogue.plans_paiement_autorises_json,
            catalogue.nombre_tranches,
        );
        const normalizedRequested =
            typeof requestedCode === "string" && requestedCode.trim()
                ? requestedCode.trim().toUpperCase()
                : null;
        const defaultCode =
            typeof catalogue.plan_paiement_defaut_code === "string" && catalogue.plan_paiement_defaut_code.trim()
                ? catalogue.plan_paiement_defaut_code.trim().toUpperCase()
                : null;

        const selected =
            plans.find((plan) => plan.code === normalizedRequested) ??
            plans.find((plan) => plan.code === defaultCode) ??
            plans[0];

        if (!selected) {
            throw new Error(`Aucun plan de paiement n'est defini pour ${feeLabel}.`);
        }

        if (normalizedRequested && !plans.some((plan) => plan.code === normalizedRequested)) {
            throw new Error(`Le plan choisi n'est pas autorise pour ${feeLabel}.`);
        }

        return selected;
    }

    private async buildInvoiceLines(
        prisma: PrismaClient | Prisma.TransactionClient,
        etablissementId: string,
        niveauScolaireId: string,
        finance: any,
        servicesState: { transportActive: boolean; cantineActive: boolean },
        billingContext: { classeId: string | null; invoiceDate: Date; schoolYearStartDate: Date },
    ): Promise<BillingInvoiceLine[]> {
        const definitions = [
            {
                source_key: "catalogue_frais_inscription_id",
                tranche_key: "catalogue_frais_inscription_nombre_tranches",
                plan_key: "catalogue_frais_inscription_plan_code",
                fallback_label: "Frais d'inscription",
                enabled: true,
                allowed_scopes: ["GENERAL", "INSCRIPTION"],
            },
            {
                source_key: "catalogue_frais_scolarite_id",
                tranche_key: "catalogue_frais_scolarite_nombre_tranches",
                plan_key: "catalogue_frais_scolarite_plan_code",
                fallback_label: "Frais de scolarite",
                enabled: true,
                allowed_scopes: ["GENERAL", "SCOLARITE"],
            },
        ] as const;

        const selectedIds = definitions
            .map((definition) => this.toNullableString(finance?.[definition.source_key]))
            .filter((value): value is string => Boolean(value));

        const catalogueById = new Map<string, {
            id: string;
            nom: string;
            montant: number;
            devise: string;
            nombre_tranches: number;
            usage_scope: string;
            mode_facturation: string | null;
            est_recurrent: boolean;
            periodicite: string | null;
            prorata_eligible: boolean;
            eligibilite_json: Prisma.JsonValue | null;
            plans_paiement_autorises_json: Prisma.JsonValue | null;
            plan_paiement_defaut_code: string | null;
            statut_validation: string | null;
        }>();
        if (selectedIds.length > 0) {
            const catalogueRows = await prisma.catalogueFrais.findMany({
                where: {
                    etablissement_id: etablissementId,
                    id: { in: selectedIds },
                    OR: [
                        { niveau_scolaire_id: niveauScolaireId },
                        { niveau_scolaire_id: null },
                    ],
                } as never,
                select: {
                    id: true,
                    nom: true,
                    montant: true,
                    devise: true,
                    nombre_tranches: true,
                    usage_scope: true,
                    mode_facturation: true,
                    est_recurrent: true,
                    periodicite: true,
                    prorata_eligible: true,
                    eligibilite_json: true,
                    plans_paiement_autorises_json: true,
                    plan_paiement_defaut_code: true,
                    statut_validation: true,
                } as never,
            }) as Array<{
                id: string;
                nom: string;
                montant: unknown;
                devise: string | null;
                nombre_tranches: number | null;
                usage_scope: string | null;
                mode_facturation: string | null;
                est_recurrent: boolean | null;
                periodicite: string | null;
                prorata_eligible: boolean | null;
                eligibilite_json: Prisma.JsonValue | null;
                plans_paiement_autorises_json: Prisma.JsonValue | null;
                plan_paiement_defaut_code: string | null;
                statut_validation: string | null;
            }>;

            for (const item of catalogueRows) {
                catalogueById.set(item.id, {
                    id: item.id,
                    nom: item.nom,
                    montant: this.toMoney(item.montant),
                    devise: item.devise ?? "MGA",
                    nombre_tranches: this.resolveFinanceLineTrancheCount(item.nombre_tranches),
                    usage_scope: (item.usage_scope ?? "GENERAL").toUpperCase(),
                    mode_facturation: item.mode_facturation ? item.mode_facturation.toUpperCase() : null,
                    est_recurrent: Boolean(item.est_recurrent),
                    periodicite: item.periodicite ?? null,
                    prorata_eligible: Boolean(item.prorata_eligible),
                    eligibilite_json: item.eligibilite_json ?? null,
                    plans_paiement_autorises_json: item.plans_paiement_autorises_json ?? null,
                    plan_paiement_defaut_code: item.plan_paiement_defaut_code ?? null,
                    statut_validation: item.statut_validation ?? null,
                });
            }

            if (catalogueRows.length !== selectedIds.length) {
                throw new Error("Un frais selectionne dans l'inscription n'est pas applicable a la classe choisie.");
            }

            const devises = Array.from(new Set(catalogueRows.map((item) => item.devise ?? "MGA")));
            if (devises.length > 1) {
                throw new Error("Les frais selectionnes doivent partager la meme devise.");
            }
        }

        return definitions
            .filter((definition) => definition.enabled)
            .flatMap((definition) => {
                const selectedId = this.toNullableString(finance?.[definition.source_key]);
                const catalogue = selectedId ? catalogueById.get(selectedId) : null;

                if (!catalogue || catalogue.montant <= 0) {
                    return [];
                }

                if (!(definition.allowed_scopes as readonly string[]).includes(catalogue.usage_scope)) {
                    throw new Error(`Le frais selectionne pour ${definition.fallback_label.toLowerCase()} n'est pas du bon type.`);
                }

                if ((catalogue.statut_validation ?? "").toUpperCase() !== "APPROUVEE") {
                    throw new Error(`Le frais selectionne pour ${definition.fallback_label.toLowerCase()} n'est pas encore approuve.`);
                }

                const eligibilityRules =
                    catalogue.eligibilite_json && typeof catalogue.eligibilite_json === "object" && !Array.isArray(catalogue.eligibilite_json)
                        ? (catalogue.eligibilite_json as Record<string, unknown>)
                        : null;
                const allowedClasses = Array.isArray(eligibilityRules?.classe_ids)
                    ? eligibilityRules.classe_ids
                        .map((item) => (typeof item === "string" ? item.trim() : ""))
                        .filter(Boolean)
                    : [];
                if (allowedClasses.length > 0 && (!billingContext.classeId || !allowedClasses.includes(billingContext.classeId))) {
                    throw new Error(`Le frais selectionne pour ${definition.fallback_label.toLowerCase()} n'est pas autorise pour cette classe.`);
                }

                const montantAjuste = this.applyProrataIfNeeded(
                    catalogue.montant,
                    {
                        est_recurrent: catalogue.est_recurrent,
                        periodicite: catalogue.periodicite,
                        prorata_eligible: catalogue.prorata_eligible,
                    },
                    billingContext.invoiceDate,
                    billingContext.schoolYearStartDate,
                );

                let nombreTranches = this.resolveFinanceLineTrancheCount(
                    finance?.[definition.tranche_key] ?? catalogue.nombre_tranches,
                );
                let installmentOffsetsMonths: number[] | null = null;
                let planCode: string | null = null;
                let planLabel: string | null = null;

                const planManaged =
                    (catalogue.mode_facturation ?? "").toUpperCase() === "ANNUEL" ||
                    catalogue.usage_scope === "INSCRIPTION";
                if (definition.plan_key && planManaged) {
                    const annualPlan = this.resolvePaymentPlanForFee(
                        catalogue,
                        finance?.[definition.plan_key],
                        definition.fallback_label.toLowerCase(),
                    );
                    nombreTranches = annualPlan.nombre_tranches;
                    installmentOffsetsMonths = annualPlan.offsets_mois;
                    planCode = annualPlan.code;
                    planLabel = annualPlan.label;
                }

                return [{
                    source_key: definition.source_key,
                    catalogue_frais_id: catalogue.id,
                    libelle: montantAjuste < catalogue.montant ? `${catalogue.nom} (prorata)` : catalogue.nom,
                    montant: montantAjuste,
                    devise: catalogue.devise,
                    nombre_tranches: nombreTranches,
                    installment_offsets_months: installmentOffsetsMonths,
                    usage_scope: catalogue.usage_scope,
                    mode_facturation: catalogue.mode_facturation,
                    plan_code: planCode,
                    plan_label: planLabel,
                }];
            });
    }

    private applyProrataIfNeeded(
        amount: number,
        catalogue: { est_recurrent: boolean; periodicite: string | null; prorata_eligible: boolean },
        invoiceDate: Date,
        schoolYearStartDate: Date,
    ) {
        if (!catalogue.est_recurrent || catalogue.periodicite !== "monthly" || !catalogue.prorata_eligible) {
            return this.roundMoney(amount);
        }

        const invoiceDay = this.startOfDay(invoiceDate);
        const cycleMonthStart = new Date(invoiceDay.getFullYear(), invoiceDay.getMonth(), 1);
        const cycleStart = this.startOfDay(
            schoolYearStartDate > cycleMonthStart ? schoolYearStartDate : cycleMonthStart,
        );
        const cycleEnd = this.startOfDay(new Date(invoiceDay.getFullYear(), invoiceDay.getMonth() + 1, 0));

        if (invoiceDay <= cycleStart) {
            return this.roundMoney(amount);
        }

        const totalDays = this.diffInDays(cycleStart, cycleEnd) + 1;
        const remainingDays = this.diffInDays(invoiceDay, cycleEnd) + 1;
        if (totalDays <= 0 || remainingDays <= 0) {
            return this.roundMoney(amount);
        }

        return this.roundMoney(amount * (remainingDays / totalDays));
    }

    private startOfDay(value: Date) {
        return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }

    private diffInDays(start: Date, end: Date) {
        const dayMs = 24 * 60 * 60 * 1000;
        return Math.floor((this.startOfDay(end).getTime() - this.startOfDay(start).getTime()) / dayMs);
    }

    private applyDiscountToInvoiceLines(
        lines: BillingInvoiceLine[],
        discountAmount: number,
        discountLabel?: string | null,
        applyOnSourceKeys?: string[] | null,
    ): BillingInvoiceLine[] {
        if (discountAmount <= 0) return lines;
        return [
            ...lines,
            {
                libelle: discountLabel ? `Remise appliquee - ${discountLabel}` : "Remise appliquee",
                montant: this.roundMoney(-discountAmount),
                catalogue_frais_id: null,
                source_key: applyOnSourceKeys?.length ? `remise:${applyOnSourceKeys.join(",")}` : "remise",
                nombre_tranches: 1,
                installment_offsets_months: null,
                usage_scope: null,
                mode_facturation: null,
                plan_code: null,
                plan_label: null,
            },
        ];
    }

    private resolveFinanceLineTrancheCount(value: unknown): number {
        const parsed = Number.parseInt(String(value ?? 1), 10);
        if (!Number.isFinite(parsed) || parsed < 1) return 1;
        return parsed;
    }

    private deriveScheduleMode(lines: BillingInvoiceLine[]) {
        const hasInstallments = lines.some((line) => {
            const trancheCount = Math.max(1, Number(line.nombre_tranches || 1));
            const offsets = Array.isArray(line.installment_offsets_months)
                ? line.installment_offsets_months.filter((value) => Number.isFinite(value))
                : [];
            return trancheCount > 1 || offsets.some((value) => value > 0);
        });
        return hasInstallments ? "ECHELONNE" : "COMPTANT";
    }

    private resolvePaymentDayOfMonth(value: unknown, fallback: number | null = null): number | null {
        if (value === null || value === undefined || value === "") {
            if (fallback == null) return null;
            return Math.max(1, Math.min(28, Number(fallback) || 1));
        }
        const parsed = Number.parseInt(String(value), 10);
        if (!Number.isFinite(parsed)) {
            if (fallback == null) return null;
            return Math.max(1, Math.min(28, Number(fallback) || 1));
        }
        return Math.max(1, Math.min(28, parsed));
    }

    private getSchoolYearScheduleStartDate(dateDebut: Date) {
        return new Date(new Date(dateDebut).toISOString().slice(0, 10));
    }

    private getSchoolYearScheduleEndDate(dateFin: Date) {
        return new Date(new Date(dateFin).toISOString().slice(0, 10));
    }

    private buildMonthlyScheduledDate(year: number, month: number, paymentDay: number) {
        const safeDay = Math.max(1, Math.min(28, paymentDay));
        return new Date(Date.UTC(year, month, safeDay));
    }

    private getFirstScheduledPaymentDate(anchorDate: Date, paymentDay: number) {
        const anchor = new Date(anchorDate.toISOString().slice(0, 10));
        let candidate = this.buildMonthlyScheduledDate(
            anchor.getUTCFullYear(),
            anchor.getUTCMonth(),
            paymentDay,
        );

        if (candidate < anchor) {
            candidate = this.buildMonthlyScheduledDate(
                anchor.getUTCFullYear(),
                anchor.getUTCMonth() + 1,
                paymentDay,
            );
        }

        return candidate;
    }

    private distributeDiscountAcrossCatalogueLines<T extends { montant: number }>(
        lines: T[],
        discountAmount: number,
        applyOnSourceKeys?: string[] | null,
    ): Array<T & { montant_net: number }> {
        const normalizedDiscount = this.roundMoney(Math.max(0, discountAmount));
        if (normalizedDiscount <= 0) {
            return lines.map((line) => ({ ...line, montant_net: this.roundMoney(line.montant) }));
        }

        const eligibleLines = lines.filter((line) => this.isLineEligibleForDiscount(line as { source_key?: string | null }, applyOnSourceKeys));
        const total = this.roundMoney(eligibleLines.reduce((sum, line) => sum + this.toMoney(line.montant), 0));
        if (total <= 0) {
            return lines.map((line) => ({ ...line, montant_net: this.roundMoney(line.montant) }));
        }

        let remainingDiscount = normalizedDiscount;
        return lines.map((line, index) => {
            const lineMontant = this.roundMoney(this.toMoney(line.montant));
            if (!this.isLineEligibleForDiscount(line as { source_key?: string | null }, applyOnSourceKeys)) {
                return {
                    ...line,
                    montant_net: lineMontant,
                };
            }
            const lineDiscount = index === lines.length - 1
                ? remainingDiscount
                : this.roundMoney((lineMontant / total) * normalizedDiscount);
            remainingDiscount = this.roundMoney(Math.max(0, remainingDiscount - lineDiscount));
            return {
                ...line,
                montant_net: this.roundMoney(Math.max(0, lineMontant - lineDiscount)),
            };
        });
    }

    private buildPaymentSchedule(
        lines: Array<{
            libelle: string;
            montant: number;
            nombre_tranches: number;
            devise?: string | null;
            installment_offsets_months?: number[] | null;
        }>,
        discountAmount: number,
        modePaiement: string,
        schoolYearStartDate: Date,
        schoolYearEndDate: Date,
        immediateDueDate: Date,
        paymentDayOfMonth: number | null,
        applyOnSourceKeys?: string[] | null,
    ): Array<{ date: string; montant: number; statut: string; note: string | null; libelle: string | null }> {
        const normalizedLines = lines.filter((line) => this.toMoney(line.montant) > 0);
        const normalizedTotal = this.roundMoney(
            normalizedLines.reduce((sum, line) => sum + this.toMoney(line.montant), 0) - this.roundMoney(Math.max(0, discountAmount)),
        );

        if (modePaiement === "COMPTANT") {
            return [
                {
                    date: immediateDueDate.toISOString().slice(0, 10),
                    montant: normalizedTotal,
                    statut: normalizedTotal > 0 ? "PAYEE" : "A_VENIR",
                    note: "Reglement comptant",
                    libelle: "Reglement comptant",
                },
            ];
        }

        const linesWithNetAmount = this.distributeDiscountAcrossCatalogueLines(normalizedLines, discountAmount, applyOnSourceKeys);
        const schedule: Array<{ date: string; montant: number; statut: string; note: string | null; libelle: string | null }> = [];
        // Les plans annuels suivent toujours l'intervalle de l'annee scolaire,
        // meme si l'inscription est saisie plus tard dans l'annee.
        const anchorDate = schoolYearStartDate;
        const overdueReferenceDate = new Date(immediateDueDate.toISOString().slice(0, 10));
        const monthlyPaymentDay = this.resolvePaymentDayOfMonth(
            paymentDayOfMonth,
            schoolYearStartDate.getDate(),
        ) ?? schoolYearStartDate.getDate();
        const firstScheduledDate = this.getFirstScheduledPaymentDate(anchorDate, monthlyPaymentDay);

        for (const line of linesWithNetAmount) {
            const trancheCount = Math.max(1, Number(line.nombre_tranches || 1));
            const providedOffsets = Array.isArray(line.installment_offsets_months)
                ? line.installment_offsets_months
                    .map((value) => Number.parseInt(String(value), 10))
                    .filter((value) => Number.isFinite(value) && value >= 0)
                : [];
            const installmentOffsets =
                providedOffsets.length === trancheCount
                    ? [...providedOffsets]
                    : Array.from({ length: trancheCount }, (_, index) => index);
            let remaining = this.roundMoney(line.montant_net);
            const baseAmount = this.roundMoney(remaining / trancheCount);

            for (let index = 0; index < trancheCount; index += 1) {
                const date = this.buildMonthlyScheduledDate(
                    firstScheduledDate.getUTCFullYear(),
                    firstScheduledDate.getUTCMonth() + installmentOffsets[index],
                    monthlyPaymentDay,
                );
                if (date.getTime() > schoolYearEndDate.getTime()) {
                    throw new Error(
                        `Le plan de paiement ${line.libelle} depasse la fin de l'annee scolaire. Ajuste le jour du mois ou choisis un plan annuel plus court.`,
                    );
                }
                const montant = index === trancheCount - 1
                    ? this.roundMoney(remaining)
                    : baseAmount;
                remaining = this.roundMoney(Math.max(0, remaining - montant));

                if (montant <= 0) continue;

                schedule.push({
                    date: date.toISOString().slice(0, 10),
                    montant,
                    statut: date < overdueReferenceDate ? "EN_RETARD" : "A_VENIR",
                    note: `${line.libelle} - tranche ${index + 1}/${trancheCount}`,
                    libelle: `${line.libelle} - tranche ${index + 1}`,
                });
            }
        }

        return schedule;
    }

    private async resolveFinanceRemise(
        prisma: PrismaClient | Prisma.TransactionClient,
        etablissementId: string,
        finance: any,
    ): Promise<{ id: string; nom: string; type: string; valeur: number } | null> {
        const remiseId = this.toNullableString(finance?.remise_id);
        if (!remiseId) return null;

        const remise = await prisma.remise.findFirst({
            where: {
                id: remiseId,
                etablissement_id: etablissementId,
            },
            select: {
                id: true,
                nom: true,
                type: true,
                valeur: true,
                regles_json: true,
            },
        });

        if (!remise) {
            throw new Error("La remise selectionnee n'appartient pas a cet etablissement.");
        }

        const rules =
            remise.regles_json && typeof remise.regles_json === "object" && !Array.isArray(remise.regles_json)
                ? (remise.regles_json as Record<string, unknown>)
                : null;
        const validationRequired = Boolean(rules?.validation_requise);
        const validationStatus =
            typeof rules?.statut_validation === "string" ? rules.statut_validation.trim().toUpperCase() : "";
        if (validationRequired && validationStatus !== "APPROUVEE") {
            throw new Error("La remise selectionnee doit etre approuvee avant utilisation.");
        }

        return {
            id: remise.id,
            nom: remise.nom,
            type: remise.type,
            valeur: this.toMoney(remise.valeur),
        };
    }

    private computeDiscount(total: number, remiseType: string, remiseValeur: number): number {
        if (total <= 0 || remiseValeur <= 0) return 0;

        if (remiseType === "PERCENT") {
            return this.roundMoney(total * (remiseValeur / 100));
        }

        if (remiseType === "FIXED") {
            return Math.min(total, this.roundMoney(remiseValeur));
        }

        return 0;
    }

    private deriveFactureStatus(
        requestedStatus: string,
        total: number,
        paidAmount: number,
        dueDate: Date | null,
    ): StatutFacture {
        const normalizedRequested = requestedStatus.toUpperCase();

        if (normalizedRequested === "BROUILLON") return "BROUILLON";
        if (normalizedRequested === "ANNULEE") return "ANNULEE";
        if (total <= 0) return "PAYEE";
        if (paidAmount >= total) return "PAYEE";
        if (paidAmount > 0) return "PARTIELLE";
        if (dueDate && dueDate < new Date()) return "EN_RETARD";
        return "EMISE";
    }

    private async notifyFamilyForGeneratedInvoice(
        tx: Prisma.TransactionClient,
        args: {
            tenantId: string;
            factureId: string;
            eleveId: string;
            numeroFacture: string;
            totalMontant: number;
            devise: string;
            dueDate: Date | null;
        },
    ) {
        const parentLinks = await tx.eleveParentTuteur.findMany({
            where: {
                eleve_id: args.eleveId,
                parent_tuteur: {
                    etablissement_id: args.tenantId,
                },
            },
            select: {
                parent_tuteur: {
                    select: {
                        utilisateur_id: true,
                    },
                },
            },
        });

        const recipientIds = Array.from(
            new Set(
                parentLinks
                    .map((item) => item.parent_tuteur?.utilisateur_id)
                    .filter((value): value is string => Boolean(value)),
            ),
        );

        if (recipientIds.length === 0) return;

        await tx.notification.createMany({
            data: recipientIds.map((utilisateur_id) => ({
                utilisateur_id,
                type: "FACTURE_CREEE",
                payload_json: {
                    facture_id: args.factureId,
                    eleve_id: args.eleveId,
                    numero_facture: args.numeroFacture,
                    total_montant: args.totalMontant,
                    devise: args.devise,
                    date_echeance: args.dueDate?.toISOString() ?? null,
                    source: "INSCRIPTION",
                } as Prisma.InputJsonValue,
            })),
        });
    }

    private normalizeInitialPaymentMethod(value: unknown) {
        const normalized = this.toNullableString(value)?.trim().toUpperCase() ?? null;
        if (!normalized) return null;

        switch (normalized) {
            case "ESPECES":
                return "ESPECES" as const;
            case "MOBILE_MONEY":
                return "MOBILE_MONEY" as const;
            case "VIREMENT_BANCAIRE":
                return "VIREMENT_BANCAIRE" as const;
            case "CHEQUE":
                return "CHEQUE" as const;
            case "CARTE_BANCAIRE":
                return "CARTE_BANCAIRE" as const;
            case "AUTRE":
                return "AUTRE" as const;
            default:
                return null;
        }
    }

    private mapInitialPaymentMethodToStoredValue(value: ReturnType<InscriptionApp["normalizeInitialPaymentMethod"]>) {
        switch (value) {
            case "ESPECES":
                return "cash";
            case "MOBILE_MONEY":
                return "mobile_money";
            case "VIREMENT_BANCAIRE":
                return "bank_transfer";
            case "CHEQUE":
                return "cheque";
            case "CARTE_BANCAIRE":
                return "card";
            case "AUTRE":
                return "other";
            default:
                return null;
        }
    }

    private async buildEnrollmentReceiptNumber(
        tx: Prisma.TransactionClient,
        etablissementId: string,
        payeLe: Date,
    ) {
        const start = this.startOfDay(payeLe);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        const dateKey = start.toISOString().slice(0, 10).replace(/-/g, "");
        const count = await tx.paiement.count({
            where: {
                facture: {
                    etablissement_id: etablissementId,
                },
                paye_le: {
                    gte: start,
                    lt: end,
                },
            },
        });

        return `RECU-${dateKey}-${String(count + 1).padStart(4, "0")}`;
    }

    private async buildEnrollmentPaymentReference(
        tx: Prisma.TransactionClient,
        etablissementId: string,
        payeLe: Date,
        methode: string | null,
    ) {
        const start = this.startOfDay(payeLe);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        const dateKey = start.toISOString().slice(0, 10).replace(/-/g, "");
        const count = await tx.paiement.count({
            where: {
                facture: {
                    etablissement_id: etablissementId,
                },
                paye_le: {
                    gte: start,
                    lt: end,
                },
            },
        });
        const methodKey =
            (methode ?? "PAYMENT")
                .replace(/[^A-Z0-9]+/gi, "_")
                .replace(/^_+|_+$/g, "")
                .toUpperCase() || "PAYMENT";

        return `${methodKey}-${dateKey}-${String(count + 1).padStart(4, "0")}`;
    }

    private async buildInvoiceNumber(tx: Prisma.TransactionClient, etablissementId: string): Promise<string> {
        const year = new Date().getFullYear();
        const count = await tx.facture.count({
            where: {
                etablissement_id: etablissementId,
                numero_facture: {
                    startsWith: `FAC-${year}-`,
                },
            },
        });

        return `FAC-${year}-${String(count + 1).padStart(4, "0")}`;
    }

    private computeDiscountBase(
        lines: Array<{ montant: number; source_key?: string | null }>,
        applyOnSourceKeys?: string[] | null,
    ) {
        return this.roundMoney(
            lines
                .filter((line) => this.isLineEligibleForDiscount(line, applyOnSourceKeys))
                .reduce((sum, line) => sum + this.toMoney(line.montant), 0),
        );
    }

    private isLineEligibleForDiscount(
        line: { source_key?: string | null },
        applyOnSourceKeys?: string[] | null,
    ) {
        if (!applyOnSourceKeys || applyOnSourceKeys.length === 0) return true;
        return applyOnSourceKeys.includes((line.source_key ?? "").trim());
    }

    private parseSiblingRule(remise: {
        id: string;
        nom: string;
        type: string;
        valeur: number;
        regles_json?: Prisma.JsonValue | null;
    }, siblingRank: number) {
        const rules =
            remise.regles_json && typeof remise.regles_json === "object"
                ? (remise.regles_json as Record<string, any>)
                : null;
        if (!rules) return null;

        const markers = [
            rules.type,
            rules.kind,
            rules.scope,
            rules.mode,
            rules.source,
            rules.trigger,
        ]
            .map((value) => (typeof value === "string" ? value.trim().toUpperCase() : ""))
            .filter(Boolean);

        const fratrieMarked =
            Boolean(rules.fratrie) ||
            Boolean(rules.sibling) ||
            markers.includes("FRATRIE") ||
            markers.includes("SIBLING");

        if (!fratrieMarked) return null;

        const minimumChildren = Math.max(
            2,
            Number(
                rules.minimum_children ??
                rules.min_children ??
                rules.minimum_siblings ??
                rules.min_rank ??
                2,
            ) || 2,
        );
        if (siblingRank < minimumChildren) return null;

        const sourceKeys = Array.isArray(rules.apply_on_source_keys)
            ? rules.apply_on_source_keys.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
            : Array.isArray(rules.applyOnSourceKeys)
                ? rules.applyOnSourceKeys.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0)
                : null;

        const tiers = Array.isArray(rules.tiers)
            ? rules.tiers
            : Array.isArray(rules.rangs)
                ? rules.rangs
                : null;

        let resolvedType = remise.type;
        let resolvedValeur = this.toMoney(remise.valeur);

        if (tiers && tiers.length > 0) {
            const normalizedTiers = tiers
                .map((tier: any) => ({
                    minRank: Math.max(
                        2,
                        Number(
                            tier?.rang_min ??
                            tier?.min_rank ??
                            tier?.rank ??
                            tier?.rang ??
                            2,
                        ) || 2,
                    ),
                    type: typeof tier?.type === "string" ? tier.type.trim().toUpperCase() : remise.type,
                    valeur: this.toMoney(tier?.valeur ?? remise.valeur),
                }))
                .filter((tier) => tier.valeur > 0)
                .sort((left, right) => left.minRank - right.minRank);

            const matchedTier = normalizedTiers
                .filter((tier) => siblingRank >= tier.minRank)
                .pop();

            if (!matchedTier) return null;

            resolvedType = matchedTier.type;
            resolvedValeur = matchedTier.valeur;
        }

        return {
            id: remise.id,
            nom: remise.nom,
            type: resolvedType,
            valeur: resolvedValeur,
            automatique_fratrie: true,
            source_fratrie: true,
            apply_on_source_keys: sourceKeys,
        };
    }

    private extractRemiseApplySourceKeys(remise: { regles_json?: Prisma.JsonValue | null }) {
        const rules =
            remise.regles_json && typeof remise.regles_json === "object"
                ? (remise.regles_json as Record<string, any>)
                : null;
        if (!rules) return null;
        const sourceKeys = Array.isArray(rules.apply_on_source_keys)
            ? rules.apply_on_source_keys
            : Array.isArray(rules.applyOnSourceKeys)
                ? rules.applyOnSourceKeys
                : null;
        if (!sourceKeys) return null;
        return sourceKeys.filter((value: unknown): value is string => typeof value === "string" && value.trim().length > 0);
    }

    private async resolveApplicableFinanceRemise(
        prisma: PrismaClient | Prisma.TransactionClient,
        etablissementId: string,
        finance: any,
        siblingRank: number,
    ): Promise<{
        id: string;
        nom: string;
        type: string;
        valeur: number;
        automatique_fratrie?: boolean;
        source_fratrie?: boolean;
        apply_on_source_keys?: string[] | null;
    } | null> {
        const selected = await this.resolveFinanceRemise(prisma, etablissementId, finance);
        if (selected) {
            const selectedRaw = await prisma.remise.findFirst({
                where: {
                    id: selected.id,
                    etablissement_id: etablissementId,
                },
                select: {
                    id: true,
                    nom: true,
                    type: true,
                    valeur: true,
                    regles_json: true,
                },
            });
            if (selectedRaw) {
                const siblingRule = this.parseSiblingRule(selectedRaw, siblingRank);
                if (siblingRule) return siblingRule;
                return {
                    ...selected,
                    automatique_fratrie: false,
                    source_fratrie: false,
                    apply_on_source_keys: this.extractRemiseApplySourceKeys(selectedRaw),
                };
            }
            return selected;
        }

        if (siblingRank < 2) return null;

        const remises = await prisma.remise.findMany({
            where: {
                etablissement_id: etablissementId,
            },
            select: {
                id: true,
                nom: true,
                type: true,
                valeur: true,
                regles_json: true,
            },
            orderBy: [{ created_at: "asc" }],
        });

        for (const remise of remises) {
            const siblingRule = this.parseSiblingRule(remise, siblingRank);
            if (siblingRule) return siblingRule;
        }

        return null;
    }

    private async findOrCreateParentTuteur(
        tx: Prisma.TransactionClient,
        payload: {
            allowUserAccount?: boolean;
            deliveryMethod?: string | null;
            etablissement_id: string;
            raw: any;
            loginEmail?: string | null;
            generatedPassword: string;
        },
    ) {
        const fullName = `${payload.raw?.prenom ?? ""} ${payload.raw?.nom ?? ""}`.trim();
        const email = this.toNullableString(payload.loginEmail) ?? this.toNullableString(payload.raw?.email);
        const telephone = this.toNullableString(payload.raw?.telephone);
        const telephoneSecondaire = this.toNullableString(payload.raw?.telephone_secondaire);
        const profession = this.toNullableString(payload.raw?.profession);
        const lieuTravail = this.toNullableString(payload.raw?.lieu_travail);
        const explicitParentId = this.toNullableString(payload.raw?.parent_tuteur_id);
        const allowUserAccount = this.toBool(payload.allowUserAccount, false);

        let existingParent = explicitParentId
            ? await tx.parentTuteur.findFirst({
                where: {
                    id: explicitParentId,
                    etablissement_id: payload.etablissement_id,
                },
                include: {
                    utilisateur: {
                        include: {
                            profil: true,
                        },
                    },
                },
            })
            : null;

        if (!existingParent && (email || telephone)) {
            existingParent = await tx.parentTuteur.findFirst({
                where: {
                    etablissement_id: payload.etablissement_id,
                    OR: [
                        ...(email ? [{ email }] : []),
                        ...(telephone ? [{ telephone }] : []),
                        ...(email ? [{ utilisateur: { is: { email } } }] : []),
                        ...(telephone ? [{ utilisateur: { is: { telephone } } }] : []),
                    ],
                },
                include: {
                    utilisateur: {
                        include: {
                            profil: true,
                        },
                    },
                },
            });
        }

        if (existingParent) {
            let utilisateurId = existingParent.utilisateur_id ?? null;
            if (!utilisateurId && allowUserAccount && (email || telephone)) {
                const user = await tx.utilisateur.create({
                    data: {
                        etablissement_id: payload.etablissement_id,
                        email,
                        telephone,
                        mot_de_passe_hash: await bcrypt.hash(payload.generatedPassword, 10),
                        scope_json: {
                            account: {
                                delivery_method: this.toNullableString(payload.deliveryMethod),
                                email,
                                enabled: true,
                                password: payload.generatedPassword,
                            },
                            type: "tuteur",
                        } as Prisma.InputJsonValue,
                        statut: "ACTIF",
                    },
                });

                await tx.profil.create({
                    data: {
                        utilisateur_id: user.id,
                        prenom: payload.raw?.prenom ?? "",
                        nom: payload.raw?.nom ?? "",
                        adresse: this.toNullableString(payload.raw?.adresse),
                        date_naissance: null,
                        genre: null,
                        photo_url: null,
                        contact_urgence_json: Prisma.JsonNull,
                    },
                });

                utilisateurId = user.id;
            } else if (utilisateurId && allowUserAccount) {
                await tx.utilisateur.update({
                    where: { id: utilisateurId },
                    data: {
                        email: email ?? existingParent.utilisateur?.email ?? existingParent.email,
                        telephone: telephone ?? existingParent.utilisateur?.telephone ?? existingParent.telephone,
                    },
                });

                if (existingParent.utilisateur?.profil) {
                    await tx.profil.update({
                        where: { utilisateur_id: utilisateurId },
                        data: {
                            prenom: this.toNullableString(payload.raw?.prenom) ?? existingParent.utilisateur.profil.prenom,
                            nom: this.toNullableString(payload.raw?.nom) ?? existingParent.utilisateur.profil.nom,
                            adresse: this.toNullableString(payload.raw?.adresse) ?? existingParent.utilisateur.profil.adresse,
                        },
                    });
                }
            }

            const updatedParent = await tx.parentTuteur.update({
                where: { id: existingParent.id },
                data: {
                    utilisateur_id: utilisateurId,
                    nom_complet: fullName || existingParent.nom_complet,
                    telephone: telephone ?? existingParent.telephone,
                    telephone_secondaire: telephoneSecondaire ?? existingParent.telephone_secondaire,
                    email: email ?? existingParent.email,
                    adresse: this.toNullableString(payload.raw?.adresse) ?? existingParent.adresse,
                    profession: profession ?? existingParent.profession,
                    lieu_travail: lieuTravail ?? (existingParent as any).lieu_travail ?? null,
                } as any,
            });

            return {
                id: updatedParent.id,
                utilisateur_id: updatedParent.utilisateur_id ?? null,
                reused: true,
                nom_complet: updatedParent.nom_complet,
            };
        }

        let userTuteurId: string | null = null;
        if (allowUserAccount) {
            const userTuteur = await tx.utilisateur.create({
                data: {
                    etablissement_id: payload.etablissement_id,
                    email,
                    mot_de_passe_hash: await bcrypt.hash(payload.generatedPassword, 10),
                    telephone,
                    scope_json: {
                        account: {
                            delivery_method: this.toNullableString(payload.deliveryMethod),
                            email,
                            enabled: true,
                            password: payload.generatedPassword,
                        },
                        type: "tuteur",
                    } as Prisma.InputJsonValue,
                    statut: "ACTIF",
                },
            });

            await tx.profil.create({
                data: {
                    utilisateur_id: userTuteur.id,
                    prenom: payload.raw?.prenom ?? "",
                    nom: payload.raw?.nom ?? "",
                    date_naissance: null,
                    genre: null,
                    photo_url: null,
                    adresse: this.toNullableString(payload.raw?.adresse),
                    contact_urgence_json: Prisma.JsonNull,
                },
            });
            userTuteurId = userTuteur.id;
        }

        const parent = await tx.parentTuteur.create({
            data: {
                etablissement_id: payload.etablissement_id,
                utilisateur_id: userTuteurId,
                nom_complet: fullName,
                telephone,
                telephone_secondaire: telephoneSecondaire,
                email,
                adresse: this.toNullableString(payload.raw?.adresse),
                profession,
                lieu_travail: lieuTravail,
            } as any,
        });

        return {
            id: parent.id,
            utilisateur_id: parent.utilisateur_id ?? null,
            reused: false,
            nom_complet: parent.nom_complet,
        };
    }

    private async resolveTutorValidationContext(
        prismaClient: Prisma.TransactionClient | typeof this.prisma,
        etablissementId: string,
        tutors: any[],
    ) {
        if (!Array.isArray(tutors) || tutors.length === 0) {
            return [] as Array<{
                email: string | null;
                parent_tuteur_id: string | null;
                telephone_principal: string | null;
            }>;
        }

        const explicitIds = Array.from(
            new Set(
                tutors
                    .map((item) => this.toNullableString(item?.parent_tuteur_id))
                    .filter((value): value is string => Boolean(value)),
            ),
        );

        const existingParents = explicitIds.length > 0
            ? await prismaClient.parentTuteur.findMany({
                where: {
                    etablissement_id: etablissementId,
                    id: { in: explicitIds },
                },
                select: {
                    id: true,
                    email: true,
                    telephone: true,
                },
            })
            : [];

        const existingParentsById = new Map(
            existingParents.map((item) => [item.id, item]),
        );

        return tutors.map((item) => {
            const parentId = this.toNullableString(item?.parent_tuteur_id);
            const existingParent = parentId ? existingParentsById.get(parentId) : null;

            return {
                parent_tuteur_id: parentId,
                telephone_principal:
                    this.toNullableString(item?.telephone) ??
                    this.toNullableString(existingParent?.telephone) ??
                    null,
                email:
                    this.toNullableString(item?.email) ??
                    this.toNullableString(existingParent?.email) ??
                    null,
            };
        });
    }

    private async computeSiblingContext(
        tx: Prisma.TransactionClient,
        parentIds: string[],
        newEleveId: string,
        anneeScolaireId: string,
    ) {
        if (parentIds.length === 0) {
            return {
                detected: false,
                sibling_count: 0,
                sibling_rank: 1,
                siblings: [] as Array<Record<string, unknown>>,
            };
        }

        const siblingLinks = await tx.eleveParentTuteur.findMany({
            where: {
                parent_tuteur_id: { in: parentIds },
                eleve_id: { not: newEleveId },
            },
            include: {
                eleve: {
                    include: {
                        utilisateur: {
                            include: {
                                profil: true,
                            },
                        },
                        inscriptions: {
                            where: {
                                annee_scolaire_id: anneeScolaireId,
                                statut: "INSCRIT",
                            },
                            include: {
                                classe: true,
                            },
                        },
                    },
                },
            },
        });

        const siblingMap = new Map<string, Record<string, unknown>>();
        for (const link of siblingLinks) {
            if (!link.eleve || link.eleve.inscriptions.length === 0) continue;
            const profil = link.eleve.utilisateur?.profil;
            siblingMap.set(link.eleve_id, {
                eleve_id: link.eleve_id,
                code_eleve: link.eleve.code_eleve,
                nom_complet: [profil?.prenom?.trim(), profil?.nom?.trim()].filter(Boolean).join(" ").trim() || link.eleve.code_eleve || link.eleve_id,
                classe: link.eleve.inscriptions[0]?.classe?.nom ?? null,
                date_inscription: link.eleve.inscriptions[0]?.date_inscription ?? null,
            });
        }

        const siblings = [...siblingMap.values()].sort((left, right) => {
            const leftDate = new Date(String(left.date_inscription ?? 0)).getTime();
            const rightDate = new Date(String(right.date_inscription ?? 0)).getTime();
            return leftDate - rightDate;
        });

        return {
            detected: siblings.length > 0,
            sibling_count: siblings.length,
            sibling_rank: siblings.length + 1,
            siblings,
        };
    }
}

export default InscriptionApp;


