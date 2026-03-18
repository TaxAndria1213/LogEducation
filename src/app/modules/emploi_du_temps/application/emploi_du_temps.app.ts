import { Application, NextFunction, Request, Response as R, Router } from "express";
import { EmploiDuTemps } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import EmploiDuTempsModel from "../models/emploi_du_temps.model";

class EmploiDuTempsApp {
    public app: Application;
    public router: Router;
    private emploiDuTemps: EmploiDuTempsModel;

    constructor(app: Application) {
        this.app = app;
        this.router = Router();
        this.emploiDuTemps = new EmploiDuTempsModel();
        this.routes();
    }

    public routes(): Router {
        this.router.post("/", this.create.bind(this));
        this.router.get("/", this.getAll.bind(this));
        this.router.get("/:id", this.getOne.bind(this));
        this.router.delete("/:id", this.delete.bind(this));
        this.router.put("/:id", this.update.bind(this));
        return this.router;
    }

    private async create(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const data: EmploiDuTemps = req.body;
            const result = await this.emploiDuTemps.create(data);
            Response.success(res, "Emploi du temps created.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la creation de l'emploi du temps", 400, error as Error);
            next(error);
        }
    }

    private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const result = await getAllPaginated(req.query, this.emploiDuTemps);
            Response.success(res, "Emploi du temps list.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la recuperation de l'emploi du temps", 400, error as Error);
            next(error);
        }
    }

    private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id = req.params.id;
            const result = await this.emploiDuTemps.findUnique(id);
            Response.success(res, "Emploi du temps detail.", result);
        } catch (error) {
            next(error);
        }
    }

    private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id = req.params.id;
            const result = await this.emploiDuTemps.delete(id);
            Response.success(res, "Emploi du temps deleted.", result);
        } catch (error) {
            next(error);
        }
    }

    private async update(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id = req.params.id;
            const data: EmploiDuTemps = req.body;
            const result = await this.emploiDuTemps.update(id, data);
            Response.success(res, "Emploi du temps updated.", result);
        } catch (error) {
            next(error);
        }
    }
}

export default EmploiDuTempsApp;
