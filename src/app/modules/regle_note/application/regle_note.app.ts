import { Application, NextFunction, Request, Response as R, Router } from "express";
import Response from "../../../common/app/response";
import RegleNoteModel from "../models/regle_note.model";
import { RegleNote } from "@prisma/client";
import { getAllPaginated } from "../../../common/utils/functions";

class RegleNoteApp {
    public app: Application;
    public router: Router;
    private regleNote: RegleNoteModel;

    constructor(app: Application) {
        this.app = app;
        this.router = Router();
        this.regleNote = new RegleNoteModel();
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
            const data: RegleNote = req.body;
            const result = await this.regleNote.create(data);
            Response.success(res, "RegleNote created.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la création de la règle de note", 400, error as Error);
            next(error);
        }
    }

    private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const result = await getAllPaginated(req.query, this.regleNote);
            Response.success(res, "Regles de note list.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la récupération des règles de notes", 400, error as Error);
            next(error);
        }
    }

    private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.regleNote.findUnique(id);
            Response.success(res, "RegleNote detail.", result);
        } catch (error) {
            next(error);
        }
    }

    private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.regleNote.delete(id);
            Response.success(res, "RegleNote deleted.", result);
        } catch (error) {
            next(error);
        }
    }

    private async update(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const data: RegleNote = req.body;
            const result = await this.regleNote.update(id, data);
            Response.success(res, "RegleNote updated.", result);
        } catch (error) {
            next(error);
        }
    }
};

export default RegleNoteApp;
