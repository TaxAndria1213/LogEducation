import { Application, NextFunction, Request, Response as R, Router } from "express";
import Response from "../../../common/app/response";
import ProfileModel from "../models/profile.model";
import { Profil } from "@prisma/client";
import { getAllPaginated } from "../../../common/utils/functions";

class ProfileApp {
    public app: Application;
    public router: Router;
    private profil: ProfileModel;

    constructor(app: Application) {
        this.app = app;
        this.router = Router();
        this.profil = new ProfileModel();
        this.routes();
    }

    public routes(): Router {
        this.router.post('/', this.create.bind(this));
        this.router.get('/', this.getAll.bind(this));
        this.router.get('/:id', this.getOne.bind(this));
        this.router.get('/by-code/:code', this.getByCode.bind(this));
        this.router.delete('/:id', this.delete.bind(this));
        this.router.put('/:id', this.update.bind(this));

        return this.router;
    }

    private async create(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const data: Profil = req.body;
            const result = await this.profil.create(data);
            if(!result) throw new Error();
            Response.success(res, "Profil creation success.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la création du profil", 400, error as Error);
            next(error);
        }
    }

    private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const result = await getAllPaginated(req.query, this.profil);
            Response.success(res, "Profil list.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la récupération des profils", 400, error as Error);

            next(error);
        }
    }
    private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.profil.findUnique(id);
            Response.success(res, "Profil result.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la récupération du profil", 400, error as Error);
            next(error);
        }
    }

    private async getByCode(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const code: string = req.params.code;
            const result = await this.profil.findByCondition({ code });
            Response.success(res, "Profil result.", result);
        } catch (error) {
            next(error);
        }
    }

    private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.profil.delete(id);
            Response.success(res, "Profil deleted.", result);
        } catch (error) {
            next(error);
        }
    }

    private async update(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const data: Profil = req.body;
            const result = await this.profil.update(id, data);
            Response.success(res, "Profil updated.", result);
        } catch (error) {
            next(error);
        }
    }
};

export default ProfileApp;