import { Application, NextFunction, Request, Response as R, Router } from "express";
import Response from "../../../common/app/response";
import ProgrammeModel from "../models/programme.model";
import { Programme } from "@prisma/client";
import { getAllPaginated } from "../../../common/utils/functions";

class ProgrammeApp {
    public app: Application;
    public router: Router;
    private programme: ProgrammeModel;

    constructor(app: Application) {
        this.app = app;
        this.router = Router();
        this.programme = new ProgrammeModel();
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
            const data: Programme = req.body;
            const result = await this.programme.create(data);
            Response.success(res, "Programme created.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la création du programme", 400, error as Error);
            next(error);
        }
    }

    private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const result = await getAllPaginated(req.query, this.programme);
            Response.success(res, "Programmes list.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la récupération des programmes", 400, error as Error);
            next(error);
        }
    }

    private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.programme.findUnique(id);
            Response.success(res, "Programme detail.", result);
        } catch (error) {
            next(error);
        }
    }

    private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.programme.delete(id);
            Response.success(res, "Programme deleted.", result);
        } catch (error) {
            next(error);
        }
    }

    private async update(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const data: Programme = req.body;
            const result = await this.programme.update(id, data);
            Response.success(res, "Programme updated.", result);
        } catch (error) {
            next(error);
        }
    }
};

export default ProgrammeApp;
