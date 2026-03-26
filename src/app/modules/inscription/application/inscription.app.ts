import { Application, NextFunction, Request, Response as R, Router } from "express";
import bcrypt from "bcrypt";
import { Inscription, Prisma, PrismaClient, type StatutFacture } from "@prisma/client";
import Response from "../../../common/app/response";
import { generateRandomPassword, getAllPaginated } from "../../../common/utils/functions";
import PrismaService from "../../../service/prisma_service";
import {
    allocatePaiementsToFactureEcheances,
    syncPlanJsonFromEcheances,
    upsertPlanEcheances,
    type EcheanceInput,
} from "../../finance_shared/utils/echeance_paiement";
import EleveModel from "../../eleve/models/eleve.model";
import EleveParentTuteurModel from "../../eleve_parent_tuteur/models/eleve_parent_tuteur.model";
import ParentTuteurModel from "../../parent_tuteur/models/parent_tuteur.model";
import ProfileModel from "../../profile/models/profile.model";
import UserModel from "../../user/models/user.model";
import InscriptionModel from "../models/inscription.model";

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
        this.prisma = new PrismaClient();
        this.routes();
    }

    public routes(): Router {
        this.router.post("/", this.create.bind(this));
        this.router.post("/full", this.createFull.bind(this));
        this.router.get("/", this.getAll.bind(this));
        this.router.get("/:id", this.getOne.bind(this));
        this.router.delete("/:id", this.delete.bind(this));
        this.router.put("/:id", this.update.bind(this));

        return this.router;
    }

    private async create(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const data: Inscription = req.body;
            const result = await this.inscription.create(data);
            Response.success(res, "Stablisment creation success.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la creation de l'etablissement", 400, error as Error);
            next(error);
        }
    }

    private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const result = await getAllPaginated(req.query, this.inscription);
            Response.success(res, "Stablisment list.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la recuperation des etablissements", 400, error as Error);
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
                services = {},
                finance = {},
                echeancier = {},
            } = req.body as any;

            if (!etablissement_id || !annee_scolaire_id) {
                return Response.error(res, "etablissement_id et annee_scolaire_id sont obligatoires", 400, new Error());
            }
            if (!scolarite?.classe_id) {
                return Response.error(res, "classe_id est obligatoire", 400, new Error());
            }

            const passEleve = generateRandomPassword(9);
            const passTuteur = generateRandomPassword(9);
            const transportActive = this.toBool(services?.transport_active, false);
            const cantineActive = this.toBool(services?.cantine_active, false);
            const factureDateEmission = scolarite?.date_inscription
                ? new Date(scolarite.date_inscription)
                : new Date();
            const anneeScolaire = await this.prisma.anneeScolaire.findFirst({
                where: {
                    id: annee_scolaire_id,
                    etablissement_id,
                },
                select: {
                    id: true,
                    date_debut: true,
                },
            });
            const classe = await this.prisma.classe.findFirst({
                where: {
                    id: scolarite.classe_id,
                    etablissement_id,
                    annee_scolaire_id,
                },
                select: {
                    id: true,
                    niveau_scolaire_id: true,
                    nom: true,
                },
            });
            if (!classe) {
                return Response.error(res, "La classe selectionnee n'appartient pas a cet etablissement ou a cette annee scolaire.", 400, new Error());
            }
            if (!anneeScolaire) {
                return Response.error(res, "L'annee scolaire selectionnee n'appartient pas a cet etablissement.", 400, new Error());
            }
            const normalizedModePaiement = this.normalizeModePaiement(
                this.toNullableString(echeancier?.mode_paiement),
            );
            const invoiceLines = await this.buildInvoiceLines(this.prisma, etablissement_id, classe.niveau_scolaire_id, finance, {
                transportActive,
                cantineActive,
            });
            const totalBrut = invoiceLines.reduce((sum, line) => sum + line.montant, 0);
            const schoolYearStartDate = this.getSchoolYearScheduleStartDate(anneeScolaire.date_debut);
            const invoiceDevise =
                invoiceLines.find((line) => line.devise)?.devise ??
                "MGA";

            const result = await this.prisma.$transaction(async (tx) => {
                const userEleve = await tx.utilisateur.create({
                    data: {
                        etablissement_id,
                        email: this.toNullableString(scolarite?.code_eleve),
                        mot_de_passe_hash: await bcrypt.hash(passEleve, 10),
                        scope_json: {
                            account: {
                                email: this.toNullableString(scolarite?.code_eleve),
                                password: passEleve,
                            },
                            type: "eleve",
                        } as Prisma.InputJsonValue,
                        statut: "ACTIF",
                    },
                });

                await tx.profil.create({
                    data: {
                        utilisateur_id: userEleve.id,
                        prenom: eleve?.prenom ?? "",
                        nom: eleve?.nom ?? "",
                        date_naissance: eleve?.date_naissance ? new Date(eleve.date_naissance) : null,
                        genre: this.toNullableString(eleve?.genre),
                        photo_url: null,
                        adresse: this.toNullableString(eleve?.adresse),
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

                const linkedParents: Array<{
                    id: string;
                    utilisateur_id: string | null;
                    reused: boolean;
                    nom_complet: string;
                }> = [];

                for (const t of tuteurs as any[]) {
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
                        etablissement_id,
                        raw: t,
                        generatedPassword: passTuteur,
                    });

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
                            est_principal: this.toBool(t.est_principal, false),
                            autorise_recuperation: this.toBool(t.autorise_recuperation, true),
                        },
                        update: {
                            relation: this.toNullableString(t.relation),
                            est_principal: this.toBool(t.est_principal, false),
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
                    annee_scolaire_id,
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
                const hasFinancialFlow = finalInvoiceLines.length > 0;
                const paymentSchedule = this.buildPaymentSchedule(
                    invoiceLines,
                    remiseMontant,
                    normalizedModePaiement,
                    schoolYearStartDate,
                    factureDateEmission,
                    remiseSourceKeys,
                );
                const factureDateEcheance = paymentSchedule.length > 0
                    ? new Date(paymentSchedule[0].date)
                    : (normalizedModePaiement === "COMPTANT" ? factureDateEmission : schoolYearStartDate);

                const inscription = await tx.inscription.create({
                    data: {
                        eleve_id: eleveCreated.id,
                        classe_id: scolarite.classe_id,
                        annee_scolaire_id,
                        date_inscription: factureDateEmission,
                        statut: scolarite?.statut_inscription ?? "INSCRIT",
                    },
                });

                let abonnementTransport = null;
                if (transportActive && services?.ligne_transport_id) {
                    abonnementTransport = await tx.abonnementTransport.create({
                        data: {
                            eleve_id: eleveCreated.id,
                            annee_scolaire_id,
                            ligne_transport_id: services.ligne_transport_id,
                            arret_transport_id: this.toNullableString(services?.arret_transport_id),
                            statut: "ACTIF",
                        },
                    });
                }

                let abonnementCantine = null;
                if (cantineActive && services?.formule_cantine_id) {
                    abonnementCantine = await tx.abonnementCantine.create({
                        data: {
                            eleve_id: eleveCreated.id,
                            annee_scolaire_id,
                            formule_cantine_id: services.formule_cantine_id,
                            statut: "ACTIF",
                        },
                    });
                }

                let facture = null;
                let paiementInitial = null;
                if (hasFinancialFlow) {
                    const numeroFacture = await this.buildInvoiceNumber(tx, etablissement_id);
                    const montantPaiementInitial =
                        normalizedModePaiement === "COMPTANT" && totalNet > 0 ? totalNet : 0;
                    const statutFacture = this.deriveFactureStatus(
                        "EMISE",
                        totalNet,
                        montantPaiementInitial,
                        factureDateEcheance,
                    );

                    facture = await tx.facture.create({
                        data: {
                            etablissement_id,
                            eleve_id: eleveCreated.id,
                            annee_scolaire_id,
                            remise_id: appliedRemise?.id ?? null,
                            numero_facture: numeroFacture,
                            date_emission: factureDateEmission,
                            date_echeance: factureDateEcheance,
                            statut: statutFacture,
                            total_montant: totalNet,
                            devise: invoiceDevise,
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

                    if (normalizedModePaiement === "COMPTANT" && totalNet > 0) {
                        paiementInitial = await tx.paiement.create({
                            data: {
                                facture_id: facture.id,
                                paye_le: factureDateEmission,
                                montant: totalNet,
                                methode: "comptant",
                                reference: `AUTO-INSCRIPTION-${numeroFacture}`,
                                recu_par: null,
                            },
                        });
                    }
                }

                let planPaiement = null;
                if (hasFinancialFlow) {
                    const planJson = {
                        mode_paiement: normalizedModePaiement,
                        nombre_tranches: paymentSchedule.length,
                        devise: invoiceDevise,
                        notes: this.toNullableString(echeancier?.notes),
                        echeances: paymentSchedule,
                        services: {
                            transport_active: transportActive,
                            ligne_transport_id: this.toNullableString(services?.ligne_transport_id),
                            arret_transport_id: this.toNullableString(services?.arret_transport_id),
                            cantine_active: cantineActive,
                            formule_cantine_id: this.toNullableString(services?.formule_cantine_id),
                        },
                        finance: {
                            catalogue_frais_inscription_id: this.toNullableString(finance?.catalogue_frais_inscription_id),
                            catalogue_frais_inscription_nombre_tranches: this.resolveFinanceLineTrancheCount(finance?.catalogue_frais_inscription_nombre_tranches),
                            catalogue_frais_scolarite_id: this.toNullableString(finance?.catalogue_frais_scolarite_id),
                            catalogue_frais_scolarite_nombre_tranches: this.resolveFinanceLineTrancheCount(finance?.catalogue_frais_scolarite_nombre_tranches),
                            catalogue_frais_transport_id: this.toNullableString(finance?.catalogue_frais_transport_id),
                            catalogue_frais_transport_nombre_tranches: this.resolveFinanceLineTrancheCount(finance?.catalogue_frais_transport_nombre_tranches),
                            catalogue_frais_cantine_id: this.toNullableString(finance?.catalogue_frais_cantine_id),
                            catalogue_frais_cantine_nombre_tranches: this.resolveFinanceLineTrancheCount(finance?.catalogue_frais_cantine_nombre_tranches),
                            remise_id: appliedRemise?.id ?? this.toNullableString(finance?.remise_id),
                            remise_nom: appliedRemise?.nom ?? null,
                            frais_inscription: this.extractFinanceLineAmount(invoiceLines, "catalogue_frais_inscription_id", finance),
                            frais_scolarite: this.extractFinanceLineAmount(invoiceLines, "catalogue_frais_scolarite_id", finance),
                            frais_transport: this.extractFinanceLineAmount(invoiceLines, "catalogue_frais_transport_id", finance),
                            frais_cantine: this.extractFinanceLineAmount(invoiceLines, "catalogue_frais_cantine_id", finance),
                            remise_type: appliedRemise?.type ?? finance?.remise_type ?? "AUCUNE",
                            remise_valeur: appliedRemise?.valeur ?? this.toMoney(finance?.remise_valeur),
                            remise_montant: remiseMontant,
                            remise_automatique_fratrie: appliedRemise?.automatique_fratrie ?? false,
                            remise_source_fratrie: appliedRemise?.source_fratrie ?? false,
                            fratrie_detectee: fratrie.detected,
                            fratrie_rang: fratrie.sibling_rank,
                            fratrie_nombre_autres_enfants: fratrie.sibling_count,
                            total_brut: totalBrut,
                            total_net: totalNet,
                            devise: invoiceDevise,
                            annee_scolaire_debut: schoolYearStartDate.toISOString().slice(0, 10),
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
                            annee_scolaire_id,
                            remise_id: appliedRemise?.id ?? null,
                            plan_json: planJson as Prisma.InputJsonValue,
                        },
                    });

                    await upsertPlanEcheances(tx, {
                        planId: planPaiement.id,
                        factureId: facture?.id ?? null,
                        eleveId: eleveCreated.id,
                        anneeScolaireId: annee_scolaire_id,
                        devise: invoiceDevise,
                        lines: paymentSchedule as EcheanceInput[],
                    });

                    if (facture?.id) {
                        await allocatePaiementsToFactureEcheances(tx, facture.id);
                    } else {
                        await syncPlanJsonFromEcheances(tx, planPaiement.id);
                    }
                }

                return {
                    eleve: eleveCreated,
                    inscription,
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
            Response.error(res, "Erreur lors de l'inscription complete", 400, error as Error);
            next(error);
        }
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

    private roundMoney(value: number): number {
        return Math.round(value * 100) / 100;
    }

    private extractFinanceLineAmount(
        lines: Array<{ source_key: string; montant: number }>,
        sourceKey: string,
        _finance: any,
    ): number {
        const found = lines.find((line) => line.source_key === sourceKey);
        return found ? found.montant : 0;
    }

    private async buildInvoiceLines(
        prisma: PrismaClient | Prisma.TransactionClient,
        etablissementId: string,
        niveauScolaireId: string,
        finance: any,
        servicesState: { transportActive: boolean; cantineActive: boolean },
    ): Promise<Array<{ libelle: string; montant: number; catalogue_frais_id: string | null; source_key: string; devise?: string | null; nombre_tranches: number }>> {
        const definitions = [
            {
                source_key: "catalogue_frais_inscription_id",
                tranche_key: "catalogue_frais_inscription_nombre_tranches",
                fallback_label: "Frais d'inscription",
                enabled: true,
            },
            {
                source_key: "catalogue_frais_scolarite_id",
                tranche_key: "catalogue_frais_scolarite_nombre_tranches",
                fallback_label: "Frais de scolarite",
                enabled: true,
            },
            {
                source_key: "catalogue_frais_transport_id",
                tranche_key: "catalogue_frais_transport_nombre_tranches",
                fallback_label: "Frais de transport",
                enabled: servicesState.transportActive,
            },
            {
                source_key: "catalogue_frais_cantine_id",
                tranche_key: "catalogue_frais_cantine_nombre_tranches",
                fallback_label: "Frais de cantine",
                enabled: servicesState.cantineActive,
            },
        ] as const;

        const selectedIds = definitions
            .map((definition) => this.toNullableString(finance?.[definition.source_key]))
            .filter((value): value is string => Boolean(value));

        const catalogueById = new Map<string, { id: string; nom: string; montant: number; devise: string }>();
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
                },
            });

            for (const item of catalogueRows) {
                catalogueById.set(item.id, {
                    id: item.id,
                    nom: item.nom,
                    montant: this.toMoney(item.montant),
                    devise: item.devise ?? "MGA",
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
                const nombreTranches = this.resolveFinanceLineTrancheCount(finance?.[definition.tranche_key]);

                if (!catalogue || catalogue.montant <= 0) {
                    return [];
                }

                return [{
                    source_key: definition.source_key,
                    catalogue_frais_id: catalogue.id,
                    libelle: catalogue.nom,
                    montant: catalogue.montant,
                    devise: catalogue.devise,
                    nombre_tranches: nombreTranches,
                }];
            });
    }

    private applyDiscountToInvoiceLines(
        lines: Array<{ libelle: string; montant: number; catalogue_frais_id?: string | null; source_key?: string; devise?: string | null; nombre_tranches?: number }>,
        discountAmount: number,
        discountLabel?: string | null,
        applyOnSourceKeys?: string[] | null,
    ): Array<{ libelle: string; montant: number; catalogue_frais_id?: string | null; source_key?: string; devise?: string | null; nombre_tranches?: number }> {
        if (discountAmount <= 0) return lines;
        return [
            ...lines,
            {
                libelle: discountLabel ? `Remise appliquee - ${discountLabel}` : "Remise appliquee",
                montant: this.roundMoney(-discountAmount),
                catalogue_frais_id: null,
                source_key: applyOnSourceKeys?.length ? `remise:${applyOnSourceKeys.join(",")}` : "remise",
                nombre_tranches: 1,
            },
        ];
    }

    private normalizeModePaiement(mode: string | null): string {
        const normalized = (mode ?? "").trim().toUpperCase();
        if (normalized === "COMPTANT") return "COMPTANT";
        return "ECHELONNE";
    }

    private resolveFinanceLineTrancheCount(value: unknown): number {
        const parsed = Number.parseInt(String(value ?? 1), 10);
        if (!Number.isFinite(parsed) || parsed < 1) return 1;
        return parsed;
    }

    private getSchoolYearScheduleStartDate(dateDebut: Date) {
        return new Date(new Date(dateDebut).toISOString().slice(0, 10));
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
        lines: Array<{ libelle: string; montant: number; nombre_tranches: number; devise?: string | null }>,
        discountAmount: number,
        modePaiement: string,
        schoolYearStartDate: Date,
        immediateDueDate: Date,
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

        for (const line of linesWithNetAmount) {
            const trancheCount = Math.max(1, Number(line.nombre_tranches || 1));
            let remaining = this.roundMoney(line.montant_net);
            const baseAmount = this.roundMoney(remaining / trancheCount);

            for (let index = 0; index < trancheCount; index += 1) {
                const date = new Date(schoolYearStartDate);
                date.setMonth(date.getMonth() + index);
                const montant = index === trancheCount - 1
                    ? this.roundMoney(remaining)
                    : baseAmount;
                remaining = this.roundMoney(Math.max(0, remaining - montant));

                if (montant <= 0) continue;

                schedule.push({
                    date: date.toISOString().slice(0, 10),
                    montant,
                    statut: "A_VENIR",
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
            },
        });

        if (!remise) {
            throw new Error("La remise selectionnee n'appartient pas a cet etablissement.");
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
            etablissement_id: string;
            raw: any;
            generatedPassword: string;
        },
    ) {
        const fullName = `${payload.raw?.prenom ?? ""} ${payload.raw?.nom ?? ""}`.trim();
        const email = this.toNullableString(payload.raw?.email);
        const telephone = this.toNullableString(payload.raw?.telephone);
        const explicitParentId = this.toNullableString(payload.raw?.parent_tuteur_id);

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
            if (!utilisateurId && (email || telephone)) {
                const user = await tx.utilisateur.create({
                    data: {
                        etablissement_id: payload.etablissement_id,
                        email,
                        telephone,
                        mot_de_passe_hash: await bcrypt.hash(payload.generatedPassword, 10),
                        scope_json: {
                            account: {
                                email,
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
            } else if (utilisateurId) {
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
                    email: email ?? existingParent.email,
                    adresse: this.toNullableString(payload.raw?.adresse) ?? existingParent.adresse,
                },
            });

            return {
                id: updatedParent.id,
                utilisateur_id: updatedParent.utilisateur_id ?? null,
                reused: true,
                nom_complet: updatedParent.nom_complet,
            };
        }

        const userTuteur = await tx.utilisateur.create({
            data: {
                etablissement_id: payload.etablissement_id,
                email,
                mot_de_passe_hash: await bcrypt.hash(payload.generatedPassword, 10),
                telephone,
                scope_json: {
                    account: {
                        email,
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

        const parent = await tx.parentTuteur.create({
            data: {
                etablissement_id: payload.etablissement_id,
                utilisateur_id: userTuteur.id,
                nom_complet: fullName,
                telephone,
                email,
                adresse: this.toNullableString(payload.raw?.adresse),
            },
        });

        return {
            id: parent.id,
            utilisateur_id: parent.utilisateur_id ?? null,
            reused: false,
            nom_complet: parent.nom_complet,
        };
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
