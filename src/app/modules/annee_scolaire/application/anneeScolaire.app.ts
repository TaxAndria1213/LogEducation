import { Application, Router, Request, Response as R, NextFunction } from "express";
import Response from "../../../common/app/response";
import AnneeScolaireModel from "../models/anneeScolaire.model";
import { getAllPaginated } from "../../../common/utils/functions";
import { AnneeScolaire } from "@prisma/client";


class AnneeScolaireApp {
    public app: Application;
    public router: Router;
    //les model de données
    private anneeScolaire: AnneeScolaireModel;

    constructor(app: Application) {
        this.app = app;
        this.router = Router();
        //initialiser les modèles ex: this.modelName = new ModelNameModel();
        this.anneeScolaire = new AnneeScolaireModel();
        this.routes();
    }

    public routes(): Router {
        //les requettes api rest
        this.router.post('/', this.create.bind(this));
        this.router.get('/', this.getAll.bind(this));
        this.router.get('/last', this.getLast.bind(this));
        this.router.delete('/:id', this.delete.bind(this));

        return this.router;
    }

    //méthodes pour les requettes
    //ex:
    private async create(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const body = req.body;
            const result = await this.anneeScolaire.create(body);
            Response.success(res, "Année scolaire créé avec succès", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la création de l'année scolaire", 400, error as Error);
            next(error);
        }
    }

    private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const result = await getAllPaginated(req.query, this.anneeScolaire);
            Response.success(res, "Années scolaires récupérés avec succès", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la récupération des années scolaires", 400, error as Error);
            next(error);
        }
    }

    private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.anneeScolaire.delete(id);
            Response.success(res, "Stablisment deleted.", result);
        } catch (error) {
            next(error);
        }
    }

    private async getLast(req: Request, res:R, next: NextFunction): Promise<void> {
        try {
            const query = req.query;
            const where: Partial<AnneeScolaire> = {
                etablissement_id: query.etablissement_id as string,
                est_active: true
            }
            const result = await this.anneeScolaire.findLast({
                where
            });
            Response.success(res, "Last year.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la récupération des année scolaires", 400, error as Error);
            next(error);
        }
    }
};

export default AnneeScolaireApp;