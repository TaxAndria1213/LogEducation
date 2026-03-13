import { Application, NextFunction, Request, Response as R, Router } from "express";
import Response from "../../../common/app/response";
import ParentTuteurModel from "../models/parent_tuteur.model";
import { ParentTuteur } from "@prisma/client";
import { getAllPaginated } from "../../../common/utils/functions";

class ParentTuteurApp {
    public app: Application;
    public router: Router;
    private parentTuteur: ParentTuteurModel;

    constructor(app: Application) {
        this.app = app;
        this.router = Router();
        this.parentTuteur = new ParentTuteurModel();
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
            const data: ParentTuteur = req.body;
            const result = await this.parentTuteur.create(data);
            Response.success(res, "Stablisment creation success.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la création de l'établissement", 400, error as Error);
            next(error);
        }
    }

    private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const result = await getAllPaginated(req.query, this.parentTuteur);
            Response.success(res, "Stablisment list.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la récupération des établissements", 400, error as Error);

            next(error);
        }
    }
    private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.parentTuteur.findUnique(id);
            Response.success(res, "Stablisment result.", result);
        } catch (error) {
            next(error);
        }
    }

    private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.parentTuteur.delete(id);
            Response.success(res, "Stablisment deleted.", result);
        } catch (error) {
            next(error);
        }
    }

    private async update(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const data: ParentTuteur = req.body;
            const result = await this.parentTuteur.update(id, data);
            Response.success(res, "Stablisment updated.", result);
        } catch (error) {
            next(error);
        }
    }
};

export default ParentTuteurApp;