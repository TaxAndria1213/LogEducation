import { Application, NextFunction, Request, Response as R, Router } from "express";
import Response from "../../../common/app/response";
import PersonnelModel from "../models/personnel.model";
import { Personnel } from "@prisma/client";
import { getAllPaginated } from "../../../common/utils/functions";

class PersonnelApp {
    public app: Application;
    public router: Router;
    private personnel: PersonnelModel;

    constructor(app: Application) {
        this.app = app;
        this.router = Router();
        this.personnel = new PersonnelModel();
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
            const data: Personnel = req.body;
            const result = await this.personnel.create(data);
            Response.success(res, "Personnel created.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la création du personnel", 400, error as Error);
            next(error);
        }
    }

    private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const result = await getAllPaginated(req.query, this.personnel);
            Response.success(res, "Personnel list.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la récupération des personnels", 400, error as Error);
            next(error);
        }
    }

    private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.personnel.findUnique(id);
            Response.success(res, "Personnel detail.", result);
        } catch (error) {
            next(error);
        }
    }

    private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.personnel.delete(id);
            Response.success(res, "Personnel deleted.", result);
        } catch (error) {
            next(error);
        }
    }

    private async update(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const data: Personnel = req.body;
            const result = await this.personnel.update(id, data);
            Response.success(res, "Personnel updated.", result);
        } catch (error) {
            next(error);
        }
    }
};

export default PersonnelApp;
