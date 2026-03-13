import { Application, Router, Request, Response as R, NextFunction } from "express";
import Response from "../../../common/app/response";
import PeriodeModel from "../models/periode.model";
import { getAllPaginated } from "../../../common/utils/functions";


class PeriodeApp {
    public app: Application;
    public router: Router;
    //les model de données
    private periode: PeriodeModel;

    constructor(app: Application) {
        this.app = app;
        this.router = Router();
        //initialiser les modèles ex: this.modelName = new ModelNameModel();
        this.periode = new PeriodeModel();
        this.routes();
    }

    public routes(): Router {
        //les requettes api rest
        this.router.post('/', this.create.bind(this));
        this.router.get('/', this.getAll.bind(this));
        this.router.delete('/:id', this.delete.bind(this));

        return this.router;
    }

    //méthodes pour les requettes
    //ex:
    private async create(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const body = req.body;
            const result = await this.periode.create(body);
            Response.success(res, "Période créé avec succès", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la création de la période", 400, error as Error);
            next(error);
        }
    }

    private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const result = await getAllPaginated(req.query, this.periode);
            Response.success(res, "Périodesrécupérés avec succès", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la récupération des périodes", 400, error as Error);
            next(error);
        }
    }

    private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.periode.delete(id);
            Response.success(res, "période supprimé.", result);
        } catch (error) {
            next(error);
        }
    }
};

export default PeriodeApp;