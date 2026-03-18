import { Application, NextFunction, Request, Response as R, Router } from "express";
import { EvenementCalendrier } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import EvenementCalendrierModel from "../models/evenement_calendrier.model";

class EvenementCalendrierApp {
    public app: Application;
    public router: Router;
    private evenementCalendrier: EvenementCalendrierModel;

    constructor(app: Application) {
        this.app = app;
        this.router = Router();
        this.evenementCalendrier = new EvenementCalendrierModel();
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

    private normalizeBody(body: Partial<EvenementCalendrier>) {
        return {
            ...body,
            titre: typeof body.titre === "string" ? body.titre.trim() : body.titre,
            type: typeof body.type === "string" ? body.type.trim() || null : body.type,
            description:
                typeof body.description === "string"
                    ? body.description.trim() || null
                    : body.description,
        };
    }

    private async validateEvent(
        body: Partial<EvenementCalendrier>,
        currentId?: string,
    ): Promise<string | null> {
        if (!body.etablissement_id) {
            return "L'etablissement est obligatoire pour enregistrer un evenement.";
        }

        if (!body.titre) {
            return "Le titre de l'evenement est obligatoire.";
        }

        if (!body.debut || !body.fin) {
            return "Le debut et la fin de l'evenement sont obligatoires.";
        }

        const start = new Date(body.debut);
        const end = new Date(body.fin);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return "Les dates de debut ou de fin sont invalides.";
        }

        if (end <= start) {
            return "La fin doit etre strictement apres le debut.";
        }

        if (!body.site_id) {
            return null;
        }

        const overlaps = await this.evenementCalendrier.findByCondition<EvenementCalendrier>({
            etablissement_id: body.etablissement_id,
            site_id: body.site_id,
            ...(currentId ? { id: { not: currentId } } : {}),
            debut: { lt: end },
            fin: { gt: start },
        });

        return overlaps.length > 0
            ? "Un autre evenement occupe deja ce site sur cette plage horaire."
            : null;
    }

    private async create(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const data = this.normalizeBody(req.body as EvenementCalendrier);
            const validationError = await this.validateEvent(data);

            if (validationError) {
                return Response.error(res, validationError, 400, new Error(validationError));
            }

            const result = await this.evenementCalendrier.create(data);
            Response.success(res, "Evenement calendrier created.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la creation de l'evenement", 400, error as Error);
            next(error);
        }
    }

    private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const result = await getAllPaginated(req.query, this.evenementCalendrier);
            Response.success(res, "Evenements calendrier list.", result);
        } catch (error) {
            Response.error(res, "Erreur lors de la recuperation des evenements", 400, error as Error);
            next(error);
        }
    }

    private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id = req.params.id;
            const result = await this.evenementCalendrier.findUnique(id);
            Response.success(res, "Evenement calendrier detail.", result);
        } catch (error) {
            next(error);
        }
    }

    private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id = req.params.id;
            const result = await this.evenementCalendrier.delete(id);
            Response.success(res, "Evenement calendrier deleted.", result);
        } catch (error) {
            next(error);
        }
    }

    private async update(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id = req.params.id;
            const data = this.normalizeBody(req.body as EvenementCalendrier);
            const validationError = await this.validateEvent(data, id);

            if (validationError) {
                return Response.error(res, validationError, 400, new Error(validationError));
            }

            const result = await this.evenementCalendrier.update(id, data);
            Response.success(res, "Evenement calendrier updated.", result);
        } catch (error) {
            next(error);
        }
    }
}

export default EvenementCalendrierApp;
