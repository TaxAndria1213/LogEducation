import { Application, NextFunction, Request, Response as R, Router } from "express";
import type { Recompense } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import { prisma } from "../../../service/prisma";
import RecompenseModel from "../models/recompense.model";

type RecompensePayload = {
  eleve_id: string;
  date: Date;
  points: number;
  raison: string | null;
  donne_par: string | null;
};

class RecompenseApp {
  public app: Application;
  public router: Router;
  private recompense: RecompenseModel;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.recompense = new RecompenseModel();
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

  private resolveTenantId(req: Request) {
    const tenantId = (req as Request & { tenantId?: string }).tenantId;
    if (!tenantId) throw new Error("Aucun etablissement actif n'a ete fourni.");
    return tenantId;
  }

  private parseDate(value: unknown, fallback?: Date) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value === "string" || typeof value === "number") {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date;
    }
    if (fallback) return fallback;
    throw new Error("La date de recompense est invalide.");
  }

  private normalizePayload(raw: Partial<Recompense>, current?: Partial<Recompense>): RecompensePayload {
    const eleve_id =
      typeof raw.eleve_id === "string"
        ? raw.eleve_id.trim()
        : typeof current?.eleve_id === "string"
          ? current.eleve_id.trim()
          : "";
    const raisonSource =
      typeof raw.raison === "string" ? raw.raison : current?.raison ?? "";
    const raison = raisonSource.trim().replace(/\s+/g, " ") || null;
    const donneSource =
      typeof raw.donne_par === "string"
        ? raw.donne_par
        : typeof current?.donne_par === "string"
          ? current.donne_par
          : "";
    const donne_par = donneSource.trim() || null;
    const pointsSource = raw.points ?? current?.points ?? 0;
    const points = Number(pointsSource ?? 0);

    if (!eleve_id) throw new Error("L'eleve est requis.");
    if (!Number.isInteger(points) || points < 0) {
      throw new Error("Les points doivent etre un entier positif ou nul.");
    }

    return {
      eleve_id,
      date: this.parseDate(raw.date ?? current?.date ?? new Date()),
      points,
      raison,
      donne_par,
    };
  }

  private buildScopedWhere(existingWhere: Record<string, unknown>, tenantId: string) {
    const scope = { eleve: { etablissement_id: tenantId } };
    if (!existingWhere || Object.keys(existingWhere).length === 0) return scope;
    return { AND: [existingWhere, scope] };
  }

  private getInclude() {
    return {
      eleve: {
        include: {
          utilisateur: { include: { profil: true } },
        },
      },
    };
  }

  private async ensureEleve(eleveId: string, tenantId: string) {
    const eleve = await prisma.eleve.findFirst({
      where: { id: eleveId, etablissement_id: tenantId },
      select: { id: true },
    });

    if (!eleve) throw new Error("L'eleve selectionne n'appartient pas a cet etablissement.");
  }

  private async ensureUser(userId: string | null, tenantId: string, fieldLabel: string) {
    if (!userId) return;

    const user = await prisma.utilisateur.findFirst({
      where: { id: userId, etablissement_id: tenantId },
      select: { id: true },
    });

    if (!user) throw new Error(`${fieldLabel} ne correspond pas a un utilisateur de l'etablissement.`);
  }

  private async getScopedReward(id: string, tenantId: string) {
    return prisma.recompense.findFirst({
      where: { id, eleve: { etablissement_id: tenantId } },
      include: this.getInclude(),
    });
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const payload = this.normalizePayload(req.body);

      await this.ensureEleve(payload.eleve_id, tenantId);
      await this.ensureUser(payload.donne_par, tenantId, "L'attribution");

      const result = await prisma.recompense.create({
        data: payload,
        include: this.getInclude(),
      });

      Response.success(res, "Recompense creee.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la creation de la recompense", 400, error as Error);
      next(error);
    }
  }

  private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const where = parseJSON<Record<string, unknown>>(req.query.where, {});
      const scopedQuery = {
        ...req.query,
        where: JSON.stringify(this.buildScopedWhere(where, tenantId)),
        orderBy: req.query.orderBy ?? JSON.stringify([{ date: "desc" }, { created_at: "desc" }]),
      };
      const result = await getAllPaginated(scopedQuery as typeof req.query, this.recompense);
      Response.success(res, "Recompenses.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des recompenses", 400, error as Error);
      next(error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const result = await this.getScopedReward(req.params.id, tenantId);
      if (!result) throw new Error("Recompense introuvable pour cet etablissement.");
      Response.success(res, "Recompense detail.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation de la recompense", 404, error as Error);
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedReward(req.params.id, tenantId);
      if (!existing) throw new Error("Recompense introuvable pour cet etablissement.");

      const result = await prisma.recompense.delete({
        where: { id: req.params.id },
      });

      Response.success(res, "Recompense supprimee.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la suppression de la recompense", 400, error as Error);
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await prisma.recompense.findFirst({
        where: { id: req.params.id, eleve: { etablissement_id: tenantId } },
      });
      if (!existing) throw new Error("Recompense introuvable pour cet etablissement.");

      const payload = this.normalizePayload(req.body, existing);
      await this.ensureEleve(payload.eleve_id, tenantId);
      await this.ensureUser(payload.donne_par, tenantId, "L'attribution");

      const result = await prisma.recompense.update({
        where: { id: req.params.id },
        data: payload,
        include: this.getInclude(),
      });

      Response.success(res, "Recompense mise a jour.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la mise a jour de la recompense", 400, error as Error);
      next(error);
    }
  }
}

export default RecompenseApp;
