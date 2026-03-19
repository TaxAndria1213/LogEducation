import { Application, NextFunction, Request, Response as R, Router } from "express";
import { CreneauHoraire } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import CreneauHoraireModel from "../models/creneau_horaire.model";
import { prisma } from "../../../service/prisma";

type CreneauPayload = Omit<CreneauHoraire, "id" | "created_at" | "updated_at">;

function toOptionalString(value: unknown): string | null {
    if (value == null) return null;
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
}

function isTimeValue(value: string | null): value is string {
    return Boolean(value && /^([01]\d|2[0-3]):([0-5]\d)$/.test(value));
}

function toMinutes(value: string): number {
    const [hours, minutes] = value.split(":").map((part) => Number.parseInt(part, 10));
    return hours * 60 + minutes;
}

class CreneauHoraireApp {
    public app: Application;
    public router: Router;
    private creneauHoraire: CreneauHoraireModel;

    constructor(app: Application) {
        this.app = app;
        this.router = Router();
        this.creneauHoraire = new CreneauHoraireModel();
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

    private respondValidationError(res: R, error: unknown): void {
        const normalizedError = error instanceof Error ? error : new Error("Requete invalide.");
        Response.error(res, normalizedError.message, 400, normalizedError);
    }

    private async normalizeBody(
        body: Partial<CreneauHoraire>,
        currentId?: string,
    ): Promise<CreneauPayload> {
        const etablissementId = toOptionalString(body.etablissement_id);
        const nom = toOptionalString(body.nom);
        const heureDebut = toOptionalString(body.heure_debut);
        const heureFin = toOptionalString(body.heure_fin);
        const ordre =
            typeof body.ordre === "number"
                ? body.ordre
                : body.ordre == null
                    ? null
                    : Number.parseInt(String(body.ordre), 10);

        if (!etablissementId) {
            throw new Error("L'etablissement est obligatoire pour enregistrer un creneau.");
        }

        if (!nom) {
            throw new Error("Le nom du creneau est obligatoire.");
        }

        if (!isTimeValue(heureDebut) || !isTimeValue(heureFin)) {
            throw new Error("Les heures du creneau doivent respecter le format HH:mm.");
        }

        if (toMinutes(heureFin) <= toMinutes(heureDebut)) {
            throw new Error("L'heure de fin doit etre strictement apres l'heure de debut.");
        }

        if (ordre != null && (!Number.isInteger(ordre) || ordre < 0)) {
            throw new Error("L'ordre d'affichage doit etre un entier positif.");
        }

        const duplicate = await prisma.creneauHoraire.findFirst({
            where: {
                etablissement_id: etablissementId,
                heure_debut: heureDebut,
                heure_fin: heureFin,
                ...(currentId ? { id: { not: currentId } } : {}),
            },
        });

        if (duplicate) {
            throw new Error("Un creneau identique existe deja pour cet etablissement.");
        }

        return {
            etablissement_id: etablissementId,
            nom,
            heure_debut: heureDebut,
            heure_fin: heureFin,
            ordre,
        };
    }

    private async create(req: Request, res: R): Promise<void> {
        try {
            const data = await this.normalizeBody(req.body as Partial<CreneauHoraire>);
            const result = await this.creneauHoraire.create(data);
            Response.success(res, "Creneau horaire created.", result);
        } catch (error) {
            this.respondValidationError(res, error);
        }
    }

    private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const result = await getAllPaginated(req.query, this.creneauHoraire);
            Response.success(res, "Creneaux horaires list.", result);
        } catch (error) {
            next(error);
        }
    }

    private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const id = req.params.id;
            const result = await this.creneauHoraire.findUnique(id);
            Response.success(res, "Creneau horaire detail.", result);
        } catch (error) {
            next(error);
        }
    }

    private async delete(req: Request, res: R): Promise<void> {
        try {
            const id = req.params.id;

            const usageCount = await prisma.emploiDuTemps.count({
                where: { creneau_horaire_id: id },
            });

            if (usageCount > 0) {
                return Response.error(
                    res,
                    "Ce creneau est deja utilise dans l'emploi du temps et ne peut pas etre supprime.",
                    400,
                    new Error("Creneau in use"),
                );
            }

            const result = await this.creneauHoraire.delete(id);
            Response.success(res, "Creneau horaire deleted.", result);
        } catch (error) {
            this.respondValidationError(res, error);
        }
    }

    private async update(req: Request, res: R): Promise<void> {
        try {
            const id = req.params.id;
            const data = await this.normalizeBody(req.body as Partial<CreneauHoraire>, id);
            const result = await this.creneauHoraire.update(id, data);
            Response.success(res, "Creneau horaire updated.", result);
        } catch (error) {
            this.respondValidationError(res, error);
        }
    }
}

export default CreneauHoraireApp;
