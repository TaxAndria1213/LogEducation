import { Application, Router, Request, Response as R, NextFunction } from "express";
import Response from "../../../common/app/response";
import SiteModel from "../models/site.model";
import { getAllPaginated } from "../../../common/utils/functions";


class SiteApp {
    public app: Application;
    public router: Router;
    //les model de données
    private siteModel: SiteModel;

    constructor(app: Application) {
        this.app = app;
        this.router = Router();
        //initialiser les modèles ex: this.modelName = new ModelNameModel();
        this.siteModel = new SiteModel();
        this.routes();
    }

    public routes(): Router {
        //les requettes api rest
        this.router.post('/', this.create.bind(this));
        this.router.get('/', this.getAll.bind(this));

        return this.router;
    }

    //méthodes pour les requettes
    //ex:
    private async create(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const body = req.body;
            const result = await this.siteModel.create(body);
            Response.success(res, "Site créé avec succès", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la création du site", 400, error as Error);
            next(error);
        }
    }

    private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const result = await getAllPaginated(req.query, this.siteModel);
            Response.success(res, "Sites récupérés avec succès", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la récupération des sites", 400, error as Error);
            next(error);
        }
    }
};

export default SiteApp;