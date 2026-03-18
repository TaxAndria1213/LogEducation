import { Application, NextFunction, Request, Response as R, Router } from "express";
import Response from "../../../common/app/response";
import BulletinModel from "../models/bulletin.model";
import { Bulletin, PrismaClient } from "@prisma/client";
import { getAllPaginated } from "../../../common/utils/functions";
import InscriptionModel from "../../inscription/models/inscription.model";
import { BulletinLigne, Inscription, Note } from "../../../types/models.type";
import NoteModel from "../../note/models/note.model";
import BulletinLigneModel from "../models/bulletinLigne.model";

class BulletinApp {
    public app: Application;
    public router: Router;
    private bulletin: BulletinModel;
    private bulletinLigne: BulletinLigneModel;
    private inscription: InscriptionModel;
    private note: NoteModel;
    private prisma: PrismaClient;

    constructor(app: Application) {
        this.app = app;
        this.router = Router();
        this.bulletin = new BulletinModel();
        this.inscription = new InscriptionModel();
        this.bulletinLigne = new BulletinLigneModel();
        this.note = new NoteModel();
        this.prisma = new PrismaClient();
        this.routes();
    }

    public routes(): Router {
        this.router.post('/', this.create.bind(this));
        this.router.get('/', this.getAll.bind(this));
        this.router.get('/:id', this.getOne.bind(this));
        this.router.post('/:id/generer', this.generate.bind(this));
        this.router.delete('/:id', this.delete.bind(this));
        this.router.put('/:id', this.update.bind(this));
        return this.router;
    }

    private async create(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const data: {
                eleve_id: string; // ici eleve_id est le id de son inscription pour l'ann�e scolaire en cours
                periode_id: string;
                publie_le: Date;
                statut: string | null;
            } = req.body;
            const inscription: Partial<Inscription>[] = await this.inscription.findByCondition({
                id: data.eleve_id,
            },
                {
                    include: {
                        eleve: true,
                        classe: true,
                    }
                }) as Partial<Inscription>[];
            const inscriptionData = inscription[0];
            const dataBulletin: Partial<Bulletin> = {
                classe_id: inscriptionData.classe_id,
                periode_id: data.periode_id,
                eleve_id: inscriptionData.eleve_id,
                publie_le: data.publie_le,
                statut: data.statut || "EN_COURS",

            }

            const resultBulletin = await this.bulletin.create(dataBulletin);

            //r�cup�rer toutes les notes de l'eleve pour la periode en cours en examen
            const notes = await this.note.findByCondition({
                eleve_id: inscriptionData.eleve_id,
                evaluation: {
                    periode_id: data.periode_id,
                    type: "EXAMEN",
                }
            },
                {
                    includeSpec: {
                        evaluation: {
                            include: {
                                cours: {
                                    include: {
                                        matiere: true
                                    }
                                }
                            }
                        }
                    }
                }
            );

            //insertion de bulletin_lignes
            await Promise.all((notes as Note[]).map(async (note: Note) => {
                const dataBulletinLigne: Partial<BulletinLigne> = {
                    bulletin_id: resultBulletin.id,
                    commentaire_enseignant: note.commentaire,
                    matiere_id: note.evaluation?.cours?.matiere?.id,
                    moyenne: note.score,
                }

                await this.bulletinLigne.create(dataBulletinLigne);
            }))


            Response.success(res, "Bulletin created.", resultBulletin);
        } catch (error) {
            Response.error(res, "Erreur lors de la cr�ation du bulletin", 400, error as Error);
            next(error);
        }
    }

    private async generate(req: Request, res: R, next: NextFunction): Promise<void> {
        const bulletinId = req.params.id;

        try {
            const bulletin = await this.prisma.bulletin.findUnique({
                where: { id: bulletinId },
                select: {
                    id: true,
                    eleve_id: true,
                    periode_id: true,
                },
            });

            if (!bulletin) {
                Response.error(res, "Bulletin introuvable", 404, new Error("bulletin not found"));
                return;
            }

            const notes = await this.prisma.note.findMany({
                where: {
                    eleve_id: bulletin.eleve_id,
                    evaluation: { periode_id: bulletin.periode_id },
                },
                include: {
                    evaluation: {
                        include: {
                            cours: {
                                include: { matiere: true },
                            },
                        },
                    },
                },
            });

            const { lignes, moyenneGenerale } = await this.prisma.$transaction(async (tx) => {
                await tx.bulletinLigne.deleteMany({ where: { bulletin_id: bulletinId } });

                const lignesCreated = await Promise.all(
                    notes
                        .filter((note) => note.evaluation?.cours?.matiere?.id)
                        .map((note) =>
                            tx.bulletinLigne.create({
                                data: {
                                    bulletin_id: bulletinId,
                                    matiere_id: note.evaluation!.cours!.matiere!.id,
                                    moyenne: note.score,
                                    commentaire_enseignant: note.commentaire ?? null,
                                },
                            })
                        )
                );

                const moyenne = notes.length
                    ? notes.reduce((sum, note) => sum + (note.score ?? 0), 0) / notes.length
                    : 0;

                await tx.bulletin.update({
                    where: { id: bulletinId },
                    data: {
                        publie_le: new Date(),
                        statut: "PUBLIE",
                    },
                });

                return { lignes: lignesCreated, moyenneGenerale: moyenne };
            });

            Response.success(res, "Bulletin généré.", { bulletin_id: bulletinId, lignes, moyenne_generale: moyenneGenerale });
        } catch (error) {
            Response.error(res, "Erreur lors de la génération du bulletin", 400, error as Error);
            next(error);
        }
    }

    private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const result = await getAllPaginated(req.query, this.bulletin);
            Response.success(res, "Bulletins list.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la r�cup�ration des bulletins", 400, error as Error);
            next(error);
        }
    }

    private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.bulletin.findUnique(id);
            Response.success(res, "Bulletin detail.", result);
        } catch (error) {
            next(error);
        }
    }

    private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.bulletin.delete(id);
            Response.success(res, "Bulletin deleted.", result);
        } catch (error) {
            next(error);
        }
    }

    private async update(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const data: Bulletin = req.body;
            const result = await this.bulletin.update(id, data);
            Response.success(res, "Bulletin updated.", result);
        } catch (error) {
            next(error);
        }
    }
};

export default BulletinApp;
