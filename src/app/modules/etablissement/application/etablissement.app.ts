import { Application, NextFunction, Request, Response as R, Router } from "express";
import Response from "../../../common/app/response";
import EtablissementModel from "../models/etablissement.model";
import { Etablissement } from "@prisma/client";
import Code from "../../../common/app/code";
import { getAllPaginated } from "../../../common/utils/functions";

class EtablissementApp {
    public app: Application;
    public router: Router;
    private etablissement: EtablissementModel;

    constructor(app: Application) {
        this.app = app;
        this.router = Router();
        this.etablissement = new EtablissementModel();
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
            const data: Etablissement = req.body;
            //récupération de la dernière ligne
            const lastLine: Etablissement = await this.etablissement.findLast();
            //générer un code
            const code = new Code("ET", 3, lastLine?.code as string);
            //affectation du code
            data.code = code.next();
            data.fuseau_horaire = "Indian/Antananarivo";
            const result = await this.etablissement.create(data);
            Response.success(res, "Stablisment creation success.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la création de l'établissement", 400, error as Error);
            next(error);
        }
    }

    private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const result = await getAllPaginated(req.query, this.etablissement);
            Response.success(res, "Stablisment list.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la récupération des établissements", 400, error as Error);

            next(error);
        }
    }
    private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.etablissement.findUnique(id);
            Response.success(res, "Stablisment result.", result);
        } catch (error) {
            next(error);
        }
    }

    private async getByCode(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const code: string = req.params.code;
            const result = await this.etablissement.findByCondition({ code });
            Response.success(res, "Stablisment result.", result);
        } catch (error) {
            next(error);
        }
    }

    private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.etablissement.delete(id);
            Response.success(res, "Stablisment deleted.", result);
        } catch (error) {
            next(error);
        }
    }

    private async update(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const data: Etablissement = req.body;
            const result = await this.etablissement.update(id, data);
            Response.success(res, "Stablisment updated.", result);
        } catch (error) {
            next(error);
        }
    }
};

export default EtablissementApp;