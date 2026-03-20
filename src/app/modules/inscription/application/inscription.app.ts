import { Application, NextFunction, Request, Response as R, Router } from "express";
import bcrypt from "bcrypt";
import { Inscription } from "@prisma/client";
import Response from "../../../common/app/response";
import { generateRandomPassword, getAllPaginated } from "../../../common/utils/functions";
import PrismaService from "../../../service/prisma_service";
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

            const userEleve = await this.user.create({
                etablissement_id,
                email: this.toNullableString(scolarite?.code_eleve),
                mot_de_passe_hash: await bcrypt.hash(passEleve, 10),
                scope_json: JSON.stringify({
                    account: {
                        email: this.toNullableString(scolarite?.code_eleve),
                        password: passEleve,
                    },
                    type: "eleve",
                }),
                statut: "ACTIF",
            });

            await this.profil.create({
                utilisateur_id: (userEleve as any).id,
                prenom: eleve?.prenom ?? "",
                nom: eleve?.nom ?? "",
                date_naissance: eleve?.date_naissance ? new Date(eleve.date_naissance) : null,
                genre: this.toNullableString(eleve?.genre),
                photo_url: null,
                adresse: this.toNullableString(eleve?.adresse),
                contact_urgence_json: eleve?.contact_urgence_json ?? null,
            });

            const eleveCreated = await this.eleve.create({
                etablissement_id,
                utilisateur_id: (userEleve as any).id,
                code_eleve: this.toNullableString(scolarite?.code_eleve),
                date_entree: scolarite?.date_entree ? new Date(scolarite.date_entree) : null,
                statut: "ACTIF",
            });

            for (const t of tuteurs as any[]) {
                if (!t || !(t.nom || t.prenom || t.telephone || t.email)) continue;

                const userTuteur = await this.user.create({
                    etablissement_id,
                    email: this.toNullableString(t.email),
                    mot_de_passe_hash: await bcrypt.hash(passTuteur, 10),
                    telephone: this.toNullableString(t.telephone),
                    scope_json: JSON.stringify({
                        account: {
                            email: this.toNullableString(t.email),
                            password: passTuteur,
                        },
                        type: "tuteur",
                    }),
                    statut: "ACTIF",
                });

                await this.profil.create({
                    utilisateur_id: (userTuteur as any).id,
                    prenom: t.prenom ?? "",
                    nom: t.nom ?? "",
                    date_naissance: null,
                    genre: null,
                    photo_url: null,
                    adresse: this.toNullableString(t.adresse),
                    contact_urgence_json: null,
                });

                const parent = await this.parentTuteur.create({
                    etablissement_id,
                    utilisateur_id: (userTuteur as any).id,
                    nom_complet: `${t.prenom ?? ""} ${t.nom ?? ""}`.trim(),
                    telephone: this.toNullableString(t.telephone),
                    email: this.toNullableString(t.email),
                    adresse: this.toNullableString(t.adresse),
                });

                await this.eleveParent.create({
                    eleve_id: (eleveCreated as any).id,
                    parent_tuteur_id: (parent as any).id,
                    relation: this.toNullableString(t.relation),
                    est_principal: this.toBool(t.est_principal, false),
                    autorise_recuperation: this.toBool(t.autorise_recuperation, true),
                });
            }

            const inscription = await this.inscription.create({
                eleve_id: (eleveCreated as any).id,
                classe_id: scolarite.classe_id,
                annee_scolaire_id,
                date_inscription: scolarite?.date_inscription
                    ? new Date(scolarite.date_inscription)
                    : new Date(),
                statut: scolarite?.statut_inscription ?? "INSCRIT",
            } as any);

            const transportActive = this.toBool(services?.transport_active, false);
            const cantineActive = this.toBool(services?.cantine_active, false);

            let abonnementTransport = null;
            if (transportActive && services?.ligne_transport_id) {
                abonnementTransport = await this.abonnementTransport.create({
                    eleve_id: (eleveCreated as any).id,
                    annee_scolaire_id,
                    ligne_transport_id: services.ligne_transport_id,
                    arret_transport_id: this.toNullableString(services?.arret_transport_id),
                    statut: "ACTIF",
                } as any);
            }

            let abonnementCantine = null;
            if (cantineActive && services?.formule_cantine_id) {
                abonnementCantine = await this.abonnementCantine.create({
                    eleve_id: (eleveCreated as any).id,
                    annee_scolaire_id,
                    formule_cantine_id: services.formule_cantine_id,
                    statut: "ACTIF",
                } as any);
            }

            const planPaiement = await this.planPaiementEleve.create({
                eleve_id: (eleveCreated as any).id,
                annee_scolaire_id,
                plan_json: {
                    services: {
                        transport_active: transportActive,
                        ligne_transport_id: this.toNullableString(services?.ligne_transport_id),
                        arret_transport_id: this.toNullableString(services?.arret_transport_id),
                        cantine_active: cantineActive,
                        formule_cantine_id: this.toNullableString(services?.formule_cantine_id),
                    },
                    finance: {
                        frais_inscription: this.toMoney(finance?.frais_inscription),
                        frais_scolarite: this.toMoney(finance?.frais_scolarite),
                        frais_transport: this.toMoney(finance?.frais_transport),
                        frais_cantine: this.toMoney(finance?.frais_cantine),
                        remise_type: finance?.remise_type ?? "AUCUNE",
                        remise_valeur: this.toMoney(finance?.remise_valeur),
                        devise: finance?.devise ?? "MGA",
                    },
                    echeancier: {
                        mode_paiement: echeancier?.mode_paiement ?? "COMPTANT",
                        nombre_tranches: Number(echeancier?.nombre_tranches ?? 1),
                        premiere_echeance: this.toNullableString(echeancier?.premiere_echeance),
                        notes: this.toNullableString(echeancier?.notes),
                    },
                    metadata: {
                        cree_depuis_inscription: true,
                        inscription_id: (inscription as any).id,
                    },
                },
            } as any);

            const invoiceLines = this.buildInvoiceLines(finance);
            const totalBrut = invoiceLines.reduce((sum, line) => sum + line.montant, 0);
            const remiseMontant = this.computeDiscount(
                totalBrut,
                finance?.remise_type ?? "AUCUNE",
                this.toMoney(finance?.remise_valeur),
            );
            const totalNet = Math.max(0, this.roundMoney(totalBrut - remiseMontant));

            let facture = null;
            if (invoiceLines.length > 0) {
                facture = await this.facture.create({
                    etablissement_id,
                    eleve_id: (eleveCreated as any).id,
                    annee_scolaire_id,
                    numero_facture: this.buildInvoiceNumber(),
                    date_emission: new Date(),
                    date_echeance: echeancier?.premiere_echeance
                        ? new Date(echeancier.premiere_echeance)
                        : null,
                    statut: "EMISE",
                    total_montant: totalNet,
                    devise: finance?.devise ?? "MGA",
                } as any);

                for (const line of invoiceLines) {
                    await this.factureLigne.create({
                        facture_id: (facture as any).id,
                        libelle: line.libelle,
                        quantite: 1,
                        prix_unitaire: line.montant,
                        montant: line.montant,
                    } as any);
                }
            }

            Response.success(res, "Inscription complete creee.", {
                eleve: eleveCreated,
                inscription,
                abonnementTransport,
                abonnementCantine,
                planPaiement,
                facture,
            });
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

    private buildInvoiceLines(finance: any): Array<{ libelle: string; montant: number }> {
        const lines = [
            { libelle: "Frais d'inscription", montant: this.toMoney(finance?.frais_inscription) },
            { libelle: "Frais de scolarite", montant: this.toMoney(finance?.frais_scolarite) },
            { libelle: "Frais de transport", montant: this.toMoney(finance?.frais_transport) },
            { libelle: "Frais de cantine", montant: this.toMoney(finance?.frais_cantine) },
        ];

        return lines.filter((line) => line.montant > 0);
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

    private buildInvoiceNumber(): string {
        const now = new Date();
        const yyyymmdd = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, "0"),
            String(now.getDate()).padStart(2, "0"),
        ].join("");
        const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();

        return `FAC-${yyyymmdd}-${suffix}`;
    }
}

export default InscriptionApp;
