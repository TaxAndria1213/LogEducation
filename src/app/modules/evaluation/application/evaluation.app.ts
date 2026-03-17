import { Application, NextFunction, Request, Response as R, Router } from "express";
import Response from "../../../common/app/response";
import EvaluationModel from "../models/evaluation.model";
import { Evaluation } from "@prisma/client";
import { getAllPaginated } from "../../../common/utils/functions";

class EvaluationApp {
    public app: Application;
    public router: Router;
    private evaluation: EvaluationModel;

    constructor(app: Application) {
        this.app = app;
        this.router = Router();
        this.evaluation = new EvaluationModel();
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
            const data: Evaluation = req.body;
            const result = await this.evaluation.create(data);
            Response.success(res, "Evaluation created.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la création de l'évaluation", 400, error as Error);
            next(error);
        }
    }

    private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const result = await getAllPaginated(req.query, this.evaluation);
            Response.success(res, "Evaluations list.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la récupération des évaluations", 400, error as Error);
            next(error);
        }
    }

    private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.evaluation.findUnique(id);
            Response.success(res, "Evaluation detail.", result);
        } catch (error) {
            next(error);
        }
    }

    private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.evaluation.delete(id);
            Response.success(res, "Evaluation deleted.", result);
        } catch (error) {
            next(error);
        }
    }

    private async update(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const data: Evaluation = req.body;
            const result = await this.evaluation.update(id, data);
            Response.success(res, "Evaluation updated.", result);
        } catch (error) {
            next(error);
        }
    }
};

export default EvaluationApp;
