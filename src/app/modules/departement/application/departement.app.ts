import { Application, NextFunction, Request, Response as R, Router } from "express";
import Response from "../../../common/app/response";
import DepartementModel from "../models/departement.model";
import { Departement } from "@prisma/client";
import { getAllPaginated } from "../../../common/utils/functions";

class DepartementApp {
    public app: Application;
    public router: Router;
    private departement: DepartementModel;

    constructor(app: Application) {
        this.app = app;
        this.router = Router();
        this.departement = new DepartementModel();
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
            const data: Departement = req.body;
            const result = await this.departement.create(data);
            Response.success(res, "Departement created.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la création du département", 400, error as Error);
            next(error);
        }
    }

    private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const result = await getAllPaginated(req.query, this.departement);
            Response.success(res, "Departements list.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la récupération des départements", 400, error as Error);
            next(error);
        }
    }

    private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.departement.findUnique(id);
            Response.success(res, "Departement detail.", result);
        } catch (error) {
            next(error);
        }
    }

    private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.departement.delete(id);
            Response.success(res, "Departement deleted.", result);
        } catch (error) {
            next(error);
        }
    }

    private async update(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const data: Departement = req.body;
            const result = await this.departement.update(id, data);
            Response.success(res, "Departement updated.", result);
        } catch (error) {
            next(error);
        }
    }
};

export default DepartementApp;
