import { Application, NextFunction, Request, Response as R, Router } from "express";
import Response from "../../../common/app/response";
import NiveauModel from "../models/niveau.model";
import { NiveauScolaire } from "@prisma/client";
import { getAllPaginated } from "../../../common/utils/functions";

class NiveauApp {
    public app: Application;
    public router: Router;
    private niveau: NiveauModel;

    constructor(app: Application) {
        this.app = app;
        this.router = Router();
        this.niveau = new NiveauModel();
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
            const data: NiveauScolaire = req.body;
            const result = await this.niveau.create(data);
            Response.success(res, "Stablisment creation success.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la création de l'établissement", 400, error as Error);
            next(error);
        }
    }

    private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const result = await getAllPaginated(req.query, this.niveau);
            Response.success(res, "Stablisment list.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la récupération des établissements", 400, error as Error);

            next(error);
        }
    }
    private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.niveau.findUnique(id);
            Response.success(res, "Stablisment result.", result);
        } catch (error) {
            next(error);
        }
    }

    private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.niveau.delete(id);
            Response.success(res, "Stablisment deleted.", result);
        } catch (error) {
            next(error);
        }
    }

    private async update(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const data: NiveauScolaire = req.body;
            const result = await this.niveau.update(id, data);
            Response.success(res, "Stablisment updated.", result);
        } catch (error) {
            next(error);
        }
    }
};

export default NiveauApp;