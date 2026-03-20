import { Application, NextFunction, Request, Response as R, Router } from "express";
import Response from "../../../common/app/response";
import PeriodeModel from "../models/periode.model";
import { getAllPaginated } from "../../../common/utils/functions";
import { prisma } from "../../../service/prisma";

function parseDateValue(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);

    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }

  return null;
}

function toDayStart(value: unknown): Date | null {
  const date = parseDateValue(value);
  if (!date) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function toDayEnd(value: unknown): Date | null {
  const date = parseDateValue(value);
  if (!date) return null;
  date.setHours(23, 59, 59, 999);
  return date;
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

class PeriodeApp {
  public app: Application;
  public router: Router;
  private periode: PeriodeModel;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.periode = new PeriodeModel();
    this.routes();
  }

  public routes(): Router {
    this.router.post("/", this.create.bind(this));
    this.router.get("/", this.getAll.bind(this));
    this.router.delete("/:id", this.delete.bind(this));

    return this.router;
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const body = req.body;
      const anneeScolaireId = toOptionalString(body.annee_scolaire_id);
      const dateDebut = toDayStart(body.date_debut);
      const dateFin = toDayEnd(body.date_fin);

      if (!anneeScolaireId) {
        throw new Error("L'annee scolaire est obligatoire.");
      }

      if (!dateDebut || !dateFin) {
        throw new Error("Les dates de debut et de fin sont obligatoires.");
      }

      if (dateDebut.getTime() > dateFin.getTime()) {
        throw new Error("La date de debut doit etre anterieure ou egale a la date de fin.");
      }

      const annee = await prisma.anneeScolaire.findUnique({
        where: { id: anneeScolaireId },
      });

      if (!annee) {
        throw new Error("L'annee scolaire selectionnee est introuvable.");
      }

      const yearStart = toDayStart(annee.date_debut);
      const yearEnd = toDayEnd(annee.date_fin);

      if (!yearStart || !yearEnd) {
        throw new Error("Les bornes de l'annee scolaire sont invalides.");
      }

      if (dateDebut.getTime() < yearStart.getTime() || dateFin.getTime() > yearEnd.getTime()) {
        throw new Error("La periode doit rester comprise dans les bornes de l'annee scolaire.");
      }

      const overlappingPeriode = await prisma.periode.findFirst({
        where: {
          annee_scolaire_id: anneeScolaireId,
          date_debut: { lte: dateFin },
          date_fin: { gte: dateDebut },
        },
        select: {
          id: true,
          nom: true,
        },
      });

      if (overlappingPeriode) {
        throw new Error(
          `La nouvelle periode chevauche deja la periode ${overlappingPeriode.nom}.`,
        );
      }

      const result = await this.periode.create({
        ...body,
        annee_scolaire_id: anneeScolaireId,
        date_debut: dateDebut,
        date_fin: dateFin,
      });

      Response.success(res, "Periode creee avec succes", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la creation de la periode", 400, error as Error);
      next(error);
    }
  }

  private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const result = await getAllPaginated(req.query, this.periode);
      Response.success(res, "Periodes recuperees avec succes", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des periodes", 400, error as Error);
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      const result = await this.periode.delete(id);
      Response.success(res, "Periode supprimee.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la suppression de la periode", 400, error as Error);
      next(error);
    }
  }
}

export default PeriodeApp;
