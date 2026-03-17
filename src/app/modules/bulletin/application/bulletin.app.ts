import { Application, NextFunction, Request, Response as R, Router } from "express";
import Response from "../../../common/app/response";
import BulletinModel from "../models/bulletin.model";
import { Bulletin } from "@prisma/client";
import { getAllPaginated } from "../../../common/utils/functions";
import InscriptionModel from "../../inscription/models/inscription.model";
import { Inscription } from "../../../types/models.type";

class BulletinApp {
    public app: Application;
    public router: Router;
    private bulletin: BulletinModel;
    private inscription: InscriptionModel;

    constructor(app: Application) {
        this.app = app;
        this.router = Router();
        this.bulletin = new BulletinModel();
        this.inscription = new InscriptionModel();
        this.routes();
    }

    public routes(): Router {
        this.router.post('/', this.create.bind(this));
        this.router.get('/', this.getAll.bind(this));
        this.router.get('/:id', this.getOne.bind(this));
        this.router.delete('/:id', this.delete.bind(this));
        this.router.put('/:id', this.update.bind(this));
        return this.router;
    }

    private async create(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const data: {
                eleve_id: string; // ici eleve_id est le id de son inscription pour l'année scolaire en cours
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
            console.log("🚀 ~ BulletinApp ~ create ~ inscription:", )
            const dataBulletin: Partial<Bulletin> = {
                classe_id: inscriptionData.classe_id,
                periode_id: data.periode_id,
                eleve_id: inscriptionData.eleve_id,
                publie_le: data.publie_le,
                statut: data.statut || "EN_COURS",
                 
            }

            const resultBulletin = await this.bulletin.create(dataBulletin);
            Response.success(res, "Bulletin created.", resultBulletin);
        } catch (error) {
            Response.error(res, "Erreur lors de la création du bulletin", 400, error as Error);
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
