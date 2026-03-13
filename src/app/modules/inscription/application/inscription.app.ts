import { Application, NextFunction, Request, Response as R, Router } from "express";
import Response from "../../../common/app/response";
import InscriptionModel from "../models/inscription.model";
import { Inscription } from "@prisma/client";
import { generateRandomPassword, getAllPaginated } from "../../../common/utils/functions";
import UserModel from "../../user/models/user.model";
import ProfileModel from "../../profile/models/profile.model";
import EleveModel from "../../eleve/models/eleve.model";
import ParentTuteurModel from "../../parent_tuteur/models/parent_tuteur.model";
import EleveParentTuteurModel from "../../eleve_parent_tuteur/models/eleve_parent_tuteur.model";
import bcrypt from "bcrypt";

class InscriptionApp {
    public app: Application;
    public router: Router;
    private inscription: InscriptionModel;
    private user: UserModel;
    private profil: ProfileModel;
    private eleve: EleveModel;
    private parentTuteur: ParentTuteurModel;
    private eleveParent: EleveParentTuteurModel;

    constructor(app: Application) {
        this.app = app;
        this.router = Router();
        this.inscription = new InscriptionModel();
        this.user = new UserModel();
        this.profil = new ProfileModel();
        this.eleve = new EleveModel();
        this.parentTuteur = new ParentTuteurModel();
        this.eleveParent = new EleveParentTuteurModel();
        this.routes();
    }

    public routes(): Router {
        this.router.post('/', this.create.bind(this));
        this.router.post('/full', this.createFull.bind(this));
        this.router.get('/', this.getAll.bind(this));
        this.router.get('/:id', this.getOne.bind(this));
        this.router.delete('/:id', this.delete.bind(this));
        this.router.put('/:id', this.update.bind(this));

        return this.router;
    }

    private async create(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const data: Inscription = req.body;
            const result = await this.inscription.create(data);
            Response.success(res, "Stablisment creation success.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la création de l'établissement", 400, error as Error);
            next(error);
        }
    }

    private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const result = await getAllPaginated(req.query, this.inscription);
            Response.success(res, "Stablisment list.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la récupération des établissements", 400, error as Error);

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
     * Crée une inscription complète (élève + utilisateurs + tuteurs + pivot)
     * Body attendu:
     * {
     *   etablissement_id: string,
     *   annee_scolaire_id: string,
     *   eleve: { prenom, nom, date_naissance?, genre?, adresse? },
     *   scolarite: { code_eleve?, date_entree?, date_inscription, classe_id, statut_inscription? },
     *   tuteurs: [{ prenom, nom, telephone?, email?, adresse?, relation, est_principal?, autorise_recuperation? }]
     * }
     */
    private async createFull(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const {
                etablissement_id,
                annee_scolaire_id,
                eleve,
                scolarite,
                tuteurs = [],
            } = req.body as any;

            console.log("elève : ", eleve);

            if (!etablissement_id || !annee_scolaire_id) {
                return Response.error(res, "etablissement_id et annee_scolaire_id sont obligatoires", 400, new Error());
            }
            if (!scolarite?.classe_id) {
                return Response.error(res, "classe_id est obligatoire", 400, new Error());
            }

            const passEleve = generateRandomPassword(9);
            const passTuteur = generateRandomPassword(9);
            // 1) utilisateur élève
            const userEleve = await this.user.create({
                etablissement_id,
                email: scolarite?.code_eleve,
                mot_de_passe_hash: await bcrypt.hash(passEleve, 10),
                scope_json: JSON.stringify({
                    account: {
                        email: scolarite?.code_eleve,
                        password: passEleve
                    },
                    type: "eleve"
                }),
                statut: "ACTIF",
            });

            // 2) profil élève
            await this.profil.create({
                utilisateur_id: (userEleve as any).id,
                prenom: eleve?.prenom ?? "",
                nom: eleve?.nom ?? "",
                date_naissance: eleve?.date_naissance ? new Date(eleve.date_naissance) : null,
                genre: eleve?.genre ?? null,
                photo_url: null,
                adresse: eleve?.adresse ?? null,
                contact_urgence_json: eleve?.contact_urgence_json ?? null,
            });

            // 3) fiche élève
            const eleveCreated = await this.eleve.create({
                etablissement_id,
                utilisateur_id: (userEleve as any).id,
                code_eleve: scolarite?.code_eleve ?? null,
                date_entree: scolarite?.date_entree ? new Date(scolarite.date_entree) : null,
                statut: "ACTIF",
            });

            // 4) tuteurs (utilisateur + profil + parent_tuteur + pivot)
            for (const t of tuteurs as any[]) {
                if (!t || !(t.nom || t.prenom)) continue;

                const userTuteur = await this.user.create({
                    etablissement_id,
                    email: t.email ?? null,
                    mot_de_passe_hash: await bcrypt.hash(passTuteur, 10),
                    telephone: t.telephone ?? null,
                    scope_json: JSON.stringify({
                        account: {
                            email: t.email ?? null,
                            password: passTuteur
                        },
                        type: "tuteur"
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
                    adresse: t.adresse ?? null,
                    contact_urgence_json: null,
                });

                const parent = await this.parentTuteur.create({
                    etablissement_id,
                    utilisateur_id: (userTuteur as any).id,
                    nom_complet: `${t.prenom ?? ""} ${t.nom ?? ""}`.trim(),
                    telephone: t.telephone ?? null,
                    email: t.email ?? null,
                    adresse: t.adresse ?? null,
                });

                await this.eleveParent.create({
                    eleve_id: (eleveCreated as any).id,
                    parent_tuteur_id: (parent as any).id,
                    relation: t.relation ?? null,
                    est_principal: this.toBool(t.est_principal, true),
                    autorise_recuperation: this.toBool(t.autorise_recuperation, true),
                });
            }

            // 5) inscription
            const inscription = await this.inscription.create({
                eleve_id: (eleveCreated as any).id,
                classe_id: scolarite.classe_id,
                annee_scolaire_id,
                date_inscription: scolarite?.date_inscription ? new Date(scolarite.date_inscription) : new Date(),
                statut: scolarite?.statut_inscription ?? "INSCRIT",
            } as any);

            Response.success(res, "Inscription complète créée.", {
                eleve: eleveCreated,
                inscription,
            });
        } catch (error) {
            Response.error(res, "Erreur lors de l'inscription complète", 400, error as Error);
            next(error);
        } finally {
            // no transaction to close
        }
    }

    private toBool(value: any, fallback = false): boolean {
        if (value === undefined || value === null) return fallback;
        if (typeof value === "boolean") return value;
        if (typeof value === "string") return value === "true" || value === "1";
        if (typeof value === "number") return value !== 0;
        return fallback;
    }
};

export default InscriptionApp;
