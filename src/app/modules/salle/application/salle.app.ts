import { Application, Router, Request, Response as R, NextFunction } from "express";
import Response from "../../../common/app/response";
import SalleModel from "../models/salle.model";
import { Salle } from "../../../types/models.type";
import { getAllPaginated } from "../../../common/utils/functions";

class SalleApp {
    public app: Application;
    public router: Router;
    //les model de données
    private salleModel: SalleModel

    constructor(app: Application) {
        this.app = app;
        this.router = Router();
        this.salleModel = new SalleModel();
        //initialiser les modèles ex: this.modelName = new ModelNameModel();
        this.routes();
    }

    public routes(): Router {
        //les requettes api rest
        this.router.post('/', this.create.bind(this))
        this.router.get('/', this.getAll.bind(this));
        this.router.delete('/:id', this.delete.bind(this));

        return this.router;
    }

    //méthodes pour les requettes
    //ex:
    private async create(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const body: Salle = req.body;
            console.log("🚀 ~ SalleApp ~ create ~ body:", body);
            const result = await this.salleModel.create(body);
            Response.success(res, "Salle created successfully", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la création de la salle", 400, error as Error);
            next(error);
        }
    }

    private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const result = await getAllPaginated(req.query, this.salleModel);
            Response.success(res, "Salles list.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la récupération des Salles", 400, error as Error);

            next(error);
        }
    }

    private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.salleModel.delete(id);
            Response.success(res, "Stablisment deleted.", result);
        } catch (error) {
            next(error);
        }
    }
};

export default SalleApp;