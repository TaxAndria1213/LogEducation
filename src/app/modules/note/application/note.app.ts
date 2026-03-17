import { Application, NextFunction, Request, Response as R, Router } from "express";
import Response from "../../../common/app/response";
import NoteModel from "../models/note.model";
import { Note } from "@prisma/client";
import { getAllPaginated } from "../../../common/utils/functions";

class NoteApp {
    public app: Application;
    public router: Router;
    private note: NoteModel;

    constructor(app: Application) {
        this.app = app;
        this.router = Router();
        this.note = new NoteModel();
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
            const data: Note = req.body;
            const result = await this.note.create(data);
            Response.success(res, "Note created.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la création de la note", 400, error as Error);
            next(error);
        }
    }

    private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const result = await getAllPaginated(req.query, this.note);
            Response.success(res, "Notes list.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la récupération des notes", 400, error as Error);
            next(error);
        }
    }

    private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.note.findUnique(id);
            Response.success(res, "Note detail.", result);
        } catch (error) {
            next(error);
        }
    }

    private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const result = await this.note.delete(id);
            Response.success(res, "Note deleted.", result);
        } catch (error) {
            next(error);
        }
    }

    private async update(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id: string = req.params.id;
            const data: Note = req.body;
            const result = await this.note.update(id, data);
            Response.success(res, "Note updated.", result);
        } catch (error) {
            next(error);
        }
    }
};

export default NoteApp;
