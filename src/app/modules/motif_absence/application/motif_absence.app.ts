import { Application, NextFunction, Request, Response as R, Router } from "express";
import type { MotifAbsence } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import { prisma } from "../../../service/prisma";
import MotifAbsenceModel from "../models/motif_absence.model";

type MotifPayload = {
  etablissement_id: string;
  nom: string;
  est_excuse_par_defaut: boolean;
};

class MotifAbsenceApp {
  public app: Application;
  public router: Router;
  private motifAbsence: MotifAbsenceModel;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.motifAbsence = new MotifAbsenceModel();
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

  private resolveTenantId(req: Request): string {
    const tenantId = (req as Request & { tenantId?: string }).tenantId;
    if (!tenantId) throw new Error("Aucun etablissement actif n'a ete fourni.");
    return tenantId;
  }

  private normalizePayload(raw: Partial<MotifAbsence>, tenantId: string): MotifPayload {
    const nom = typeof raw.nom === "string" ? raw.nom.trim().replace(/\s+/g, " ") : "";
    if (!nom) throw new Error("Le nom du motif est requis.");

    return {
      etablissement_id: tenantId,
      nom,
      est_excuse_par_defaut: Boolean(raw.est_excuse_par_defaut),
    };
  }

  private buildScopedWhere(existingWhere: Record<string, unknown>, tenantId: string) {
    const scope = { etablissement_id: tenantId };
    if (!existingWhere || Object.keys(existingWhere).length === 0) return scope;
    return { AND: [existingWhere, scope] };
  }

  private async ensureUnique(nom: string, tenantId: string, excludeId?: string) {
    const existing = await prisma.motifAbsence.findFirst({
      where: {
        etablissement_id: tenantId,
        nom,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) throw new Error("Un motif d'absence avec ce nom existe deja pour cet etablissement.");
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const payload = this.normalizePayload(req.body, tenantId);
      await this.ensureUnique(payload.nom, tenantId);
      const result = await prisma.motifAbsence.create({ data: payload });
      Response.success(res, "Motif d'absence cree.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la creation du motif d'absence", 400, error as Error);
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
        orderBy: req.query.orderBy ?? JSON.stringify([{ nom: "asc" }]),
      };
      const result = await getAllPaginated(scopedQuery as typeof req.query, this.motifAbsence);
      Response.success(res, "Motifs d'absence.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des motifs d'absence", 400, error as Error);
      next(error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const result = await prisma.motifAbsence.findFirst({
        where: { id: req.params.id, etablissement_id: tenantId },
      });
      if (!result) throw new Error("Motif d'absence introuvable pour cet etablissement.");
      Response.success(res, "Motif d'absence detail.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation du motif d'absence", 404, error as Error);
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await prisma.motifAbsence.findFirst({
        where: { id: req.params.id, etablissement_id: tenantId },
        include: { justificatifs: { select: { id: true } } },
      });
      if (!existing) throw new Error("Motif d'absence introuvable pour cet etablissement.");
      if ((existing.justificatifs?.length ?? 0) > 0) {
        throw new Error("Ce motif est deja utilise par des justificatifs et ne peut pas etre supprime.");
      }
      const result = await prisma.motifAbsence.delete({ where: { id: req.params.id } });
      Response.success(res, "Motif d'absence supprime.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la suppression du motif d'absence", 400, error as Error);
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await prisma.motifAbsence.findFirst({ where: { id: req.params.id, etablissement_id: tenantId } });
      if (!existing) throw new Error("Motif d'absence introuvable pour cet etablissement.");
      const payload = this.normalizePayload({ ...existing, ...(req.body as Partial<MotifAbsence>) }, tenantId);
      await this.ensureUnique(payload.nom, tenantId, req.params.id);
      const result = await prisma.motifAbsence.update({ where: { id: req.params.id }, data: payload });
      Response.success(res, "Motif d'absence mis a jour.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la mise a jour du motif d'absence", 400, error as Error);
      next(error);
    }
  }
}

export default MotifAbsenceApp;
