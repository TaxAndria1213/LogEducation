import { Application, NextFunction, Request, Response as R, Router } from "express";
import { AnneeScolaire, Prisma } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { prisma } from "../../../service/prisma";
import AnneeScolaireModel from "../models/anneeScolaire.model";

type CreateYearPayload = Omit<AnneeScolaire, "id" | "created_at" | "updated_at">;

type StartNewYearBody = {
  etablissement_id?: string;
  nom?: string;
  date_debut?: string | Date;
  date_fin?: string | Date;
  source_annee_id?: string;
  copy_periodes?: boolean;
  close_current_year?: boolean;
  est_active?: boolean;
};

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

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
  }
  return fallback;
}

class AnneeScolaireApp {
  public app: Application;
  public router: Router;
  private anneeScolaire: AnneeScolaireModel;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.anneeScolaire = new AnneeScolaireModel();
    this.routes();
  }

  public routes(): Router {
    this.router.post("/", this.create.bind(this));
    this.router.post("/close-active", this.closeActive.bind(this));
    this.router.post("/start-new", this.startNewYear.bind(this));
    this.router.get("/", this.getAll.bind(this));
    this.router.get("/last", this.getLast.bind(this));
    this.router.delete("/:id", this.delete.bind(this));

    return this.router;
  }

  private normalizeYearPayload(body: Partial<StartNewYearBody | CreateYearPayload>) {
    const etablissementId = toOptionalString(body.etablissement_id);
    const nom = toOptionalString(body.nom);
    const dateDebut = toDayStart(body.date_debut);
    const dateFin = toDayEnd(body.date_fin);
    const estActive = toBoolean(body.est_active, false);

    if (!etablissementId) {
      throw new Error("L'etablissement est obligatoire.");
    }

    if (!nom) {
      throw new Error("Le nom de l'annee scolaire est obligatoire.");
    }

    if (!dateDebut || !dateFin) {
      throw new Error("Les dates de debut et de fin sont obligatoires.");
    }

    if (dateDebut.getTime() > dateFin.getTime()) {
      throw new Error("La date de debut doit etre anterieure ou egale a la date de fin.");
    }

    return {
      etablissement_id: etablissementId,
      nom,
      date_debut: dateDebut,
      date_fin: dateFin,
      est_active: estActive,
    };
  }

  private async assertNoOverlap(
    etablissementId: string,
    dateDebut: Date,
    dateFin: Date,
    excludeId?: string,
  ) {
    const conflicts = await prisma.anneeScolaire.findMany({
      where: {
        etablissement_id: etablissementId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        date_debut: { lte: dateFin },
        date_fin: { gte: dateDebut },
      },
      select: {
        id: true,
        nom: true,
      },
      take: 1,
    });

    if (conflicts.length > 0) {
      throw new Error(
        `La periode choisie chevauche deja l'annee scolaire ${conflicts[0].nom}.`,
      );
    }
  }

  private async copyPeriodesFromSource(
    tx: Prisma.TransactionClient,
    sourceYear: AnneeScolaire,
    targetYear: AnneeScolaire,
  ) {
    const sourcePeriods = await tx.periode.findMany({
      where: { annee_scolaire_id: sourceYear.id },
      orderBy: [{ ordre: "asc" }, { date_debut: "asc" }],
    });

    if (!sourcePeriods.length) {
      return [];
    }

    const sourceStart = toDayStart(sourceYear.date_debut);
    const targetStart = toDayStart(targetYear.date_debut);
    const targetEnd = toDayEnd(targetYear.date_fin);

    if (!sourceStart || !targetStart || !targetEnd) {
      throw new Error("Impossible de calculer la nouvelle position des periodes.");
    }

    const mappedPeriods = sourcePeriods.map((periode) => {
      const periodeStart = toDayStart(periode.date_debut);
      const periodeEnd = toDayEnd(periode.date_fin);

      if (!periodeStart || !periodeEnd) {
        throw new Error("Une periode source contient des dates invalides.");
      }

      const startOffset = Math.round(
        (periodeStart.getTime() - sourceStart.getTime()) / (1000 * 60 * 60 * 24),
      );
      const endOffset = Math.round(
        (periodeEnd.getTime() - sourceStart.getTime()) / (1000 * 60 * 60 * 24),
      );

      const nextStart = new Date(targetStart.getTime());
      nextStart.setDate(nextStart.getDate() + startOffset);

      const nextEnd = new Date(targetStart.getTime());
      nextEnd.setDate(nextEnd.getDate() + endOffset);
      nextEnd.setHours(23, 59, 59, 999);

      if (nextStart.getTime() > targetEnd.getTime() || nextEnd.getTime() > targetEnd.getTime()) {
        throw new Error(
          "Impossible de reprendre les periodes: elles depassent les bornes de la nouvelle annee scolaire.",
        );
      }

      return {
        annee_scolaire_id: targetYear.id,
        nom: periode.nom,
        date_debut: nextStart,
        date_fin: nextEnd,
        ordre: periode.ordre,
      };
    });

    const operations = mappedPeriods.map((periode) => tx.periode.create({ data: periode }));
    return Promise.all(operations);
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const payload = this.normalizeYearPayload(req.body);

      await this.assertNoOverlap(
        payload.etablissement_id,
        payload.date_debut,
        payload.date_fin,
      );

      const result = await prisma.$transaction(async (tx) => {
        if (payload.est_active) {
          await tx.anneeScolaire.updateMany({
            where: {
              etablissement_id: payload.etablissement_id,
              est_active: true,
            },
            data: {
              est_active: false,
            },
          });
        }

        return tx.anneeScolaire.create({
          data: payload,
        });
      });

      Response.success(res, "Annee scolaire creee avec succes", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la creation de l'annee scolaire",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async closeActive(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const etablissementId = toOptionalString(req.body?.etablissement_id ?? req.query.etablissement_id);
      if (!etablissementId) {
        throw new Error("L'etablissement est obligatoire pour cloturer l'annee scolaire.");
      }

      const activeYear = await prisma.anneeScolaire.findFirst({
        where: {
          etablissement_id: etablissementId,
          est_active: true,
        },
        orderBy: {
          created_at: "desc",
        },
      });

      if (!activeYear) {
        throw new Error("Aucune annee scolaire active n'a ete trouvee pour cet etablissement.");
      }

      const result = await prisma.anneeScolaire.update({
        where: { id: activeYear.id },
        data: { est_active: false },
      });

      Response.success(res, "Annee scolaire cloturee avec succes", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la cloture de l'annee scolaire",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async startNewYear(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const body = req.body as StartNewYearBody;
      const payload = this.normalizeYearPayload({
        ...body,
        est_active: body.est_active ?? true,
      });
      const copyPeriodes = toBoolean(body.copy_periodes, false);
      const closeCurrentYear = toBoolean(body.close_current_year, true);
      const sourceYearId = toOptionalString(body.source_annee_id);

      await this.assertNoOverlap(
        payload.etablissement_id,
        payload.date_debut,
        payload.date_fin,
      );

      const activeYear = await prisma.anneeScolaire.findFirst({
        where: {
          etablissement_id: payload.etablissement_id,
          est_active: true,
        },
        orderBy: {
          created_at: "desc",
        },
      });

      const sourceYear = sourceYearId
        ? await prisma.anneeScolaire.findUnique({ where: { id: sourceYearId } })
        : activeYear;

      if (copyPeriodes && !sourceYear) {
        throw new Error(
          "Aucune annee source n'est disponible pour reprendre les periodes.",
        );
      }

      if (sourceYear && sourceYear.etablissement_id !== payload.etablissement_id) {
        throw new Error("L'annee source selectionnee n'appartient pas a cet etablissement.");
      }

      const result = await prisma.$transaction(async (tx) => {
        if (closeCurrentYear && activeYear) {
          await tx.anneeScolaire.update({
            where: { id: activeYear.id },
            data: { est_active: false },
          });
        }

        if (payload.est_active) {
          await tx.anneeScolaire.updateMany({
            where: {
              etablissement_id: payload.etablissement_id,
              est_active: true,
            },
            data: {
              est_active: false,
            },
          });
        }

        const newYear = await tx.anneeScolaire.create({
          data: payload,
        });

        const copiedPeriodes = copyPeriodes && sourceYear
          ? await this.copyPeriodesFromSource(tx, sourceYear, newYear)
          : [];

        return {
          annee: newYear,
          copied_periodes: copiedPeriodes.length,
          previous_year_closed: closeCurrentYear ? activeYear?.id ?? null : null,
        };
      });

      Response.success(res, "Nouvelle annee scolaire lancee avec succes", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors du lancement de la nouvelle annee scolaire",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const result = await getAllPaginated(req.query, this.anneeScolaire);
      Response.success(res, "Annees scolaires recuperees avec succes", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation des annees scolaires",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id;
      const year = await prisma.anneeScolaire.findUnique({ where: { id } });

      if (!year) {
        throw new Error("Annee scolaire introuvable.");
      }

      if (year.est_active) {
        throw new Error(
          "Impossible de supprimer une annee scolaire active. Cloture-la d'abord.",
        );
      }

      const result = await this.anneeScolaire.delete(id);
      Response.success(res, "Annee scolaire supprimee.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la suppression de l'annee scolaire",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async getLast(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const query = req.query;
      const where: Partial<AnneeScolaire> = {
        etablissement_id: query.etablissement_id as string,
        est_active: true,
      };
      const result = await this.anneeScolaire.findLast({
        where,
      });
      Response.success(res, "Last year.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation de l'annee scolaire active",
        400,
        error as Error,
      );
      next(error);
    }
  }
}

export default AnneeScolaireApp;
