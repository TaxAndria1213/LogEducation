import { Application, NextFunction, Request, Response as R, Router } from "express";
import Response from "../../../common/app/response";
import EleveModel from "../models/eleve.model";
import { Eleve } from "@prisma/client";
import { getAllPaginated } from "../../../common/utils/functions";
import { prisma } from "../../../service/prisma";
import { extractRoleNamesFromPayload, hasSystemAdminRoleNames } from "../../../service/sessionPolicy";
import { updateWithConfig } from "../../../common/model-config/update-handler";
import { BackendModelConfigError } from "../../../common/model-config/types";
import { eleveUpdateConfig } from "./eleve.update-config";

class EleveApp {
    public app: Application;
    public router: Router;
    private eleve: EleveModel;

    constructor(app: Application) {
        this.app = app;
        this.router = Router();
        this.eleve = new EleveModel();
        this.routes();
    }

    public routes(): Router {
        this.router.post('/', this.create.bind(this));
        this.router.get('/', this.getAll.bind(this));
        this.router.get('/:id/dossier', this.getDossier.bind(this));
        this.router.get('/:id', this.getOne.bind(this));
        this.router.delete('/:id', this.delete.bind(this));
        this.router.put('/:id', this.update.bind(this));
        this.router.patch('/:id', this.patch.bind(this));

        return this.router;
    }

    private async create(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const data: Eleve = req.body;
            const result = await this.eleve.create(data);
            Response.success(res, "Stablisment creation success.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la création de l'établissement", 400, error as Error);        }
    }

    private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const result = await getAllPaginated(req.query, this.eleve);
            Response.success(res, "Stablisment list.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la récupération des établissements", 400, error as Error);        }
    }
    private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const includeSpec =
                req.query.includeSpec && typeof req.query.includeSpec === "string"
                    ? JSON.parse(req.query.includeSpec)
                    : {};
            const result = await this.eleve.findUnique(id, { includeSpec });
            Response.success(res, "Stablisment result.", result);
        } catch (error) {
            next(error);
        }
    }

    private async getDossier(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const tenantId = this.resolveTenantId(req);
            const eleveId = req.params.id;
            const canViewMedical = this.canAccessMedicalData(req);

            const currentYear = await prisma.anneeScolaire.findFirst({
                where: {
                    etablissement_id: tenantId,
                    est_active: true,
                },
                orderBy: [{ date_debut: "desc" }],
            });

            const eleve = await prisma.eleve.findFirst({
                where: {
                    id: eleveId,
                    etablissement_id: tenantId,
                },
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
                    inscriptions: {
                        include: {
                            annee: true,
                            niveau: true,
                            classe: {
                                include: {
                                    niveau: true,
                                    site: true,
                                },
                            },
                        },
                        orderBy: [{ date_inscription: "desc" }, { created_at: "desc" }],
                    },
                    profilMedical: true,
                },
            });

            if (!eleve) {
                return Response.error(res, "Eleve introuvable.", 404, new Error("student not found"));
            }

            const currentInscription =
                (currentYear
                    ? eleve.inscriptions.find((item) => item.annee_scolaire_id === currentYear.id) ?? null
                    : null) ??
                eleve.inscriptions[0] ??
                null;

            const [linkedFiles, factures] = await Promise.all([
                prisma.lienFichier.findMany({
                    where: {
                        id_entite: eleve.id,
                    },
                    include: {
                        fichier: true,
                    },
                    orderBy: [{ created_at: "desc" }],
                    take: 20,
                }),
                currentInscription
                    ? prisma.facture.findMany({
                        where: {
                            eleve_id: eleve.id,
                            annee_scolaire_id: currentInscription.annee_scolaire_id,
                        },
                        include: {
                            paiements: true,
                            lignes: true,
                        },
                        orderBy: [{ date_emission: "desc" }, { created_at: "desc" }],
                    })
                    : Promise.resolve([]),
            ]);

            const totalFacture = factures
                .filter((item) => (item.statut ?? "").toUpperCase() !== "ANNULEE")
                .reduce((sum, item) => sum + Number(item.total_montant ?? 0), 0);
            const totalPaye = factures.reduce(
                (sum, facture) =>
                    sum +
                    facture.paiements
                        .filter((paiement) => !["ANNULE", "ANNULEE"].includes((paiement.statut ?? "").toUpperCase()))
                        .reduce((inner, paiement) => inner + Number(paiement.montant ?? 0), 0),
                0,
            );
            const latestPayment = factures
                .flatMap((facture) => facture.paiements.map((paiement) => ({ ...paiement, facture })))
                .sort((left, right) => new Date(String(right.paye_le)).getTime() - new Date(String(left.paye_le)).getTime())[0] ?? null;

            const profile = eleve.utilisateur?.profil ?? null;

            Response.success(res, "Dossier eleve charge.", {
                eleve: {
                    id: eleve.id,
                    code_eleve: eleve.code_eleve,
                    statut: eleve.statut,
                    date_entree: eleve.date_entree,
                    prenom: profile?.prenom ?? null,
                    nom: profile?.nom ?? null,
                    date_naissance: profile?.date_naissance ?? null,
                    genre: profile?.genre ?? null,
                    photo_url: profile?.photo_url ?? null,
                    adresse: profile?.adresse ?? null,
                    telephone: eleve.utilisateur?.telephone ?? null,
                    email: eleve.utilisateur?.email ?? null,
                },
                current_year: currentYear
                    ? {
                        id: currentYear.id,
                        nom: currentYear.nom,
                        date_debut: currentYear.date_debut,
                        date_fin: currentYear.date_fin,
                    }
                    : null,
                current_inscription: currentInscription
                    ? {
                        id: currentInscription.id,
                        statut: currentInscription.statut,
                        type_inscription: currentInscription.type_inscription ?? null,
                        statut_administratif: currentInscription.statut_administratif ?? null,
                        statut_financier: currentInscription.statut_financier ?? null,
                        statut_dossier: currentInscription.statut_dossier ?? null,
                        date_inscription: currentInscription.date_inscription,
                        validation_date: currentInscription.validation_date,
                        annee: currentInscription.annee
                            ? {
                                id: currentInscription.annee.id,
                                nom: currentInscription.annee.nom,
                            }
                            : null,
                        niveau: currentInscription.niveau || currentInscription.classe?.niveau
                            ? {
                                id: currentInscription.niveau?.id ?? currentInscription.classe?.niveau?.id ?? null,
                                nom: currentInscription.niveau?.nom ?? currentInscription.classe?.niveau?.nom ?? null,
                            }
                            : null,
                        classe: currentInscription.classe
                            ? {
                                id: currentInscription.classe.id,
                                nom: currentInscription.classe.nom,
                                site: currentInscription.classe.site?.nom ?? null,
                            }
                            : null,
                    }
                    : null,
                inscriptions: eleve.inscriptions.map((item) => ({
                    id: item.id,
                    statut: item.statut,
                    type_inscription: item.type_inscription ?? null,
                    date_inscription: item.date_inscription,
                    validation_date: item.validation_date,
                    annee: item.annee
                        ? {
                            id: item.annee.id,
                            nom: item.annee.nom,
                        }
                        : null,
                    niveau: item.niveau || item.classe?.niveau
                        ? {
                            id: item.niveau?.id ?? item.classe?.niveau?.id ?? null,
                            nom: item.niveau?.nom ?? item.classe?.niveau?.nom ?? null,
                        }
                        : null,
                    classe: item.classe
                        ? {
                            id: item.classe.id,
                            nom: item.classe.nom,
                            site: item.classe.site?.nom ?? null,
                        }
                        : null,
                })),
                responsables: eleve.liensParents.map((link) => {
                    const parentProfile = link.parent_tuteur.utilisateur?.profil ?? null;
                    return {
                        id: link.parent_tuteur.id,
                        nom_complet:
                            [parentProfile?.prenom, parentProfile?.nom].filter(Boolean).join(" ").trim() ||
                            link.parent_tuteur.nom_complet,
                        relation: link.relation ?? null,
                        telephone_principal:
                            link.parent_tuteur.telephone ?? link.parent_tuteur.utilisateur?.telephone ?? null,
                        telephone_secondaire: link.parent_tuteur.telephone_secondaire ?? null,
                        email: link.parent_tuteur.email ?? link.parent_tuteur.utilisateur?.email ?? null,
                        adresse: link.parent_tuteur.adresse ?? null,
                        profession: link.parent_tuteur.profession ?? null,
                        est_principal: Boolean(link.est_principal),
                        est_responsable_legal: Boolean(link.est_responsable_legal),
                        est_responsable_financier: Boolean(link.est_responsable_financier),
                        est_contact_urgence: Boolean(link.est_contact_urgence),
                    };
                }),
                identifiants: eleve.identifiants.map((item) => ({
                    id: item.id,
                    type: item.type,
                    valeur: item.valeur,
                })),
                finance: {
                    total_facture: totalFacture,
                    total_paye: totalPaye,
                    reste_a_payer: Math.max(0, totalFacture - totalPaye),
                    nombre_factures: factures.length,
                    dernier_paiement: latestPayment
                        ? {
                            id: latestPayment.id,
                            montant: Number(latestPayment.montant ?? 0),
                            date: latestPayment.paye_le,
                            numero_recu: latestPayment.numero_recu ?? null,
                            facture_numero: latestPayment.facture?.numero_facture ?? null,
                        }
                        : null,
                },
                fichiers: linkedFiles.map((item) => ({
                    id: item.id,
                    tag: item.tag ?? null,
                    type_entite: item.type_entite ?? null,
                    chemin: item.fichier?.chemin ?? null,
                    nom_fichier: item.fichier?.chemin
                        ? item.fichier.chemin.split(/[\\\\/]/).pop() ?? item.fichier.chemin
                        : null,
                    type_mime: item.fichier?.type_mime ?? null,
                    televerse_le: item.fichier?.televerse_le ?? null,
                })),
                medical: {
                    authorized: canViewMedical,
                    note: canViewMedical
                        ? "Les informations medicales sont disponibles pour ce profil."
                        : "Les informations medicales sont masquees pour ce profil.",
                    data: canViewMedical && eleve.profilMedical
                        ? {
                            groupe_sanguin: eleve.profilMedical.groupe_sanguin ?? null,
                            allergies: eleve.profilMedical.allergies ?? null,
                            maladies_particulieres: eleve.profilMedical.maladies_particulieres ?? null,
                            traitement_medical: eleve.profilMedical.traitement_medical ?? null,
                            medecin_traitant: eleve.profilMedical.medecin_traitant ?? null,
                            telephone_medecin: eleve.profilMedical.telephone_medecin ?? null,
                            autorisation_prise_en_charge_medicale:
                                eleve.profilMedical.autorisation_prise_en_charge_medicale ?? false,
                            personne_a_contacter_urgence:
                                eleve.profilMedical.personne_a_contacter_urgence ?? null,
                            telephone_urgence: eleve.profilMedical.telephone_urgence ?? null,
                        }
                        : null,
                },
            });
        } catch (error) {
            next(error);
        }
    }

    private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.eleve.delete(id);
            Response.success(res, "Stablisment deleted.", result);
        } catch (error) {
            next(error);
        }
    }

    private async update(req: Request, res: R, next: NextFunction): Promise<void> {
        await this.handleUpdate(req, res, next);
    }

    private async patch(req: Request, res: R, next: NextFunction): Promise<void> {
        await this.handleUpdate(req, res, next);
    }

    private async handleUpdate(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const tenantId = this.resolveTenantId(req);
            const id: string = req.params.id;
            const data = req.body as Record<string, unknown>;
            const result = await updateWithConfig({
                config: eleveUpdateConfig,
                id,
                payload: data,
                user: (req as Request & { user?: unknown }).user,
                loadExisting: async (recordId) => {
                    return (await prisma.eleve.findFirst({
                        where: {
                            id: recordId,
                            etablissement_id: tenantId,
                        },
                    })) as unknown as Record<string, unknown> | null;
                },
                persistUpdate: async (recordId, payload) => {
                    return (await this.eleve.update(recordId, payload as Partial<Eleve>)) as unknown as Record<string, unknown>;
                },
            });
            Response.success(res, "L'element a ete modifie avec succes.", result);
        } catch (error) {
            if (error instanceof BackendModelConfigError) {
                return Response.error(
                    res,
                    error.message,
                    error.statusCode,
                    error,
                );
            }
            next(error);
        }
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
};

export default EleveApp;
