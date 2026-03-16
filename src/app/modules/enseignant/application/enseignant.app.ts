import { Application, NextFunction, Request, Response as R, Router } from "express";
import Response from "../../../common/app/response";
import EnseignantModel from "../models/enseignant.model";
import { Enseignant } from "@prisma/client";
import { getAllPaginated } from "../../../common/utils/functions";

class EnseignantApp {
    public app: Application;
    public router: Router;
    private enseignant: EnseignantModel;

    constructor(app: Application) {
        this.app = app;
        this.router = Router();
        this.enseignant = new EnseignantModel();
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
            const data: Enseignant = req.body;
            const result = await this.enseignant.create(data);
            Response.success(res, "Enseignant créé.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la création de l'enseignant", 400, error as Error);
            next(error);
        }
    }

    private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const result = await getAllPaginated(req.query, this.enseignant);
            Response.success(res, "Liste des enseignants.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la récupération des enseignants", 400, error as Error);
            next(error);
        }
    }

    private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.enseignant.findUnique(id);
            Response.success(res, "Détail enseignant.", result);
        } catch (error) {
            next(error);
        }
    }

    private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.enseignant.delete(id);
            Response.success(res, "Enseignant supprimé.", result);
        } catch (error) {
            next(error);
        }
    }

    private async update(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const data: Enseignant = req.body;
            const result = await this.enseignant.update(id, data);
            Response.success(res, "Enseignant mis à jour.", result);
        } catch (error) {
            next(error);
        }
    }
};

export default EnseignantApp;
