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
            const normalizedModePaiement = this.normalizeModePaiement(
                this.toNullableString(echeancier?.mode_paiement),
            );
            const factureDateEcheance = normalizedModePaiement === "COMPTANT"
                ? factureDateEmission
                : echeancier?.premiere_echeance
                    ? new Date(echeancier.premiere_echeance)
                    : null;
            const invoiceLines = await this.buildInvoiceLines(this.prisma, etablissement_id, classe.niveau_scolaire_id, finance, {
                transportActive,
                cantineActive,
            });
            const totalBrut = invoiceLines.reduce((sum, line) => sum + line.montant, 0);
            const appliedRemise = await this.resolveFinanceRemise(this.prisma, etablissement_id, finance);
            const remiseMontant = this.computeDiscount(
                totalBrut,
                appliedRemise?.type ?? finance?.remise_type ?? "AUCUNE",
                appliedRemise?.valeur ?? this.toMoney(finance?.remise_valeur),
            );
            const finalInvoiceLines = this.applyDiscountToInvoiceLines(
                invoiceLines,
                remiseMontant,
                appliedRemise?.nom ?? null,
            );
            const totalNet = this.roundMoney(
                finalInvoiceLines.reduce((sum, line) => sum + line.montant, 0),
            );
            const invoiceDevise =
                invoiceLines.find((line) => line.devise)?.devise ??
                "MGA";
            const hasFinancialFlow = finalInvoiceLines.length > 0;
            const paymentSchedule = this.buildPaymentSchedule(
                totalNet,
                normalizedModePaiement,
                Number(echeancier?.nombre_tranches ?? 1),
                factureDateEcheance,
            );

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

                for (const t of tuteurs as any[]) {
                    if (!t || !(t.nom || t.prenom || t.telephone || t.email)) continue;

                    const userTuteur = await tx.utilisateur.create({
                        data: {
                            etablissement_id,
                            email: this.toNullableString(t.email),
                            mot_de_passe_hash: await bcrypt.hash(passTuteur, 10),
                            telephone: this.toNullableString(t.telephone),
                            scope_json: {
                                account: {
                                    email: this.toNullableString(t.email),
                                    password: passTuteur,
                                },
                                type: "tuteur",
                            } as Prisma.InputJsonValue,
                            statut: "ACTIF",
                        },
                    });

                    await tx.profil.create({
                        data: {
                            utilisateur_id: userTuteur.id,
                            prenom: t.prenom ?? "",
                            nom: t.nom ?? "",
                            date_naissance: null,
                            genre: null,
                            photo_url: null,
                            adresse: this.toNullableString(t.adresse),
                            contact_urgence_json: Prisma.JsonNull,
                        },
                    });

                    const parent = await tx.parentTuteur.create({
                        data: {
                            etablissement_id,
                            utilisateur_id: userTuteur.id,
                            nom_complet: `${t.prenom ?? ""} ${t.nom ?? ""}`.trim(),
                            telephone: this.toNullableString(t.telephone),
                            email: this.toNullableString(t.email),
                            adresse: this.toNullableString(t.adresse),
                        },
                    });

                    await tx.eleveParentTuteur.create({
                        data: {
                            eleve_id: eleveCreated.id,
                            parent_tuteur_id: parent.id,
                            relation: this.toNullableString(t.relation),
                            est_principal: this.toBool(t.est_principal, false),
                            autorise_recuperation: this.toBool(t.autorise_recuperation, true),
                        },
                    });
                }

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
                            catalogue_frais_scolarite_id: this.toNullableString(finance?.catalogue_frais_scolarite_id),
                            catalogue_frais_transport_id: this.toNullableString(finance?.catalogue_frais_transport_id),
                            catalogue_frais_cantine_id: this.toNullableString(finance?.catalogue_frais_cantine_id),
                            remise_id: appliedRemise?.id ?? this.toNullableString(finance?.remise_id),
                            remise_nom: appliedRemise?.nom ?? null,
                            frais_inscription: this.extractFinanceLineAmount(invoiceLines, "catalogue_frais_inscription_id", finance),
                            frais_scolarite: this.extractFinanceLineAmount(invoiceLines, "catalogue_frais_scolarite_id", finance),
                            frais_transport: this.extractFinanceLineAmount(invoiceLines, "catalogue_frais_transport_id", finance),
                            frais_cantine: this.extractFinanceLineAmount(invoiceLines, "catalogue_frais_cantine_id", finance),
                            remise_type: appliedRemise?.type ?? finance?.remise_type ?? "AUCUNE",
                            remise_valeur: appliedRemise?.valeur ?? this.toMoney(finance?.remise_valeur),
                            remise_montant: remiseMontant,
                            total_brut: totalBrut,
                            total_net: totalNet,
                            devise: invoiceDevise,
                        },
                        metadata: {
                            cree_depuis_inscription: true,
                            inscription_id: inscription.id,
                            facture_id: facture?.id ?? null,
                            paiement_initial_id: paiementInitial?.id ?? null,
                        },
                    };

                    planPaiement = await tx.planPaiementEleve.create({
                        data: {
                            eleve_id: eleveCreated.id,
                            annee_scolaire_id,
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
                        }
                        : null,
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
        finance: any,
    ): number {
        const found = lines.find((line) => line.source_key === sourceKey);
        if (found) return found.montant;

        const legacyMap: Record<string, string> = {
            catalogue_frais_inscription_id: "frais_inscription",
            catalogue_frais_scolarite_id: "frais_scolarite",
            catalogue_frais_transport_id: "frais_transport",
            catalogue_frais_cantine_id: "frais_cantine",
        };

        return this.toMoney(finance?.[legacyMap[sourceKey]]);
    }

    private async buildInvoiceLines(
        prisma: PrismaClient | Prisma.TransactionClient,
        etablissementId: string,
        niveauScolaireId: string,
        finance: any,
        servicesState: { transportActive: boolean; cantineActive: boolean },
    ): Promise<Array<{ libelle: string; montant: number; catalogue_frais_id: string | null; source_key: string; devise?: string | null }>> {
        const definitions = [
            {
                source_key: "catalogue_frais_inscription_id",
                fallback_label: "Frais d'inscription",
                legacy_amount_key: "frais_inscription",
                enabled: true,
            },
            {
                source_key: "catalogue_frais_scolarite_id",
                fallback_label: "Frais de scolarite",
                legacy_amount_key: "frais_scolarite",
                enabled: true,
            },
            {
                source_key: "catalogue_frais_transport_id",
                fallback_label: "Frais de transport",
                legacy_amount_key: "frais_transport",
                enabled: servicesState.transportActive,
            },
            {
                source_key: "catalogue_frais_cantine_id",
                fallback_label: "Frais de cantine",
                legacy_amount_key: "frais_cantine",
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
                    niveau_scolaire_id: niveauScolaireId,
                    id: { in: selectedIds },
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
                throw new Error("Un frais selectionne dans l'inscription ne correspond pas au niveau scolaire de la classe choisie.");
            }

            const devises = Array.from(new Set(catalogueRows.map((item) => item.devise ?? "MGA")));
            if (devises.length > 1) {
                throw new Error("Les frais selectionnes doivent partager la meme devise.");
            }
        }

        return definitions
            .filter((definition) => definition.enabled)
            .map((definition) => {
                const selectedId = this.toNullableString(finance?.[definition.source_key]);
                const catalogue = selectedId ? catalogueById.get(selectedId) : null;

                if (catalogue) {
                    return {
                        source_key: definition.source_key,
                        catalogue_frais_id: catalogue.id,
                        libelle: catalogue.nom,
                        montant: catalogue.montant,
                        devise: catalogue.devise,
                    };
                }

                return {
                    source_key: definition.source_key,
                    catalogue_frais_id: null,
                    libelle: definition.fallback_label,
                    montant: this.toMoney(finance?.[definition.legacy_amount_key]),
                    devise: "MGA",
                };
            })
            .filter((line) => line.montant > 0);
    }

    private applyDiscountToInvoiceLines(
        lines: Array<{ libelle: string; montant: number; catalogue_frais_id?: string | null; source_key?: string; devise?: string | null }>,
        discountAmount: number,
        discountLabel?: string | null,
    ): Array<{ libelle: string; montant: number; catalogue_frais_id?: string | null; source_key?: string; devise?: string | null }> {
        if (discountAmount <= 0) return lines;
        return [
            ...lines,
            {
                libelle: discountLabel ? `Remise appliquee - ${discountLabel}` : "Remise appliquee",
                montant: this.roundMoney(-discountAmount),
                catalogue_frais_id: null,
                source_key: "remise",
            },
        ];
    }

    private normalizeModePaiement(mode: string | null): string {
        const normalized = (mode ?? "").trim().toUpperCase();
        if (normalized === "COMPTANT") return "COMPTANT";
        return "ECHELONNE";
    }

    private buildPaymentSchedule(
        totalNet: number,
        modePaiement: string,
        nombreTranches: number,
        firstDueDate: Date | null,
    ): Array<{ date: string; montant: number; statut: string; note: string | null; libelle: string | null }> {
        const baseDate = firstDueDate ?? new Date();
        const trancheCount = Math.max(1, modePaiement === "COMPTANT" ? 1 : Number(nombreTranches || 1));
        const normalizedTotal = this.roundMoney(Math.max(0, totalNet));

        if (trancheCount === 1) {
            return [
                {
                    date: baseDate.toISOString().slice(0, 10),
                    montant: normalizedTotal,
                    statut: modePaiement === "COMPTANT" && normalizedTotal > 0 ? "PAYEE" : "A_VENIR",
                    note: modePaiement === "COMPTANT" ? "Reglement comptant" : "Echeance unique",
                    libelle: modePaiement === "COMPTANT" ? "Reglement comptant" : "Echeance unique",
                },
            ];
        }

        const baseAmount = this.roundMoney(normalizedTotal / trancheCount);
        let remaining = normalizedTotal;

        return Array.from({ length: trancheCount }).map((_, index) => {
            const date = new Date(baseDate);
            date.setMonth(date.getMonth() + index);
            const montant =
                index === trancheCount - 1 ? this.roundMoney(remaining) : baseAmount;
            remaining = this.roundMoney(remaining - montant);

            return {
                date: date.toISOString().slice(0, 10),
                montant,
                statut: "A_VENIR",
                note: `Tranche ${index + 1}`,
                libelle: `Tranche ${index + 1}`,
            };
        });
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
}

export default InscriptionApp;
