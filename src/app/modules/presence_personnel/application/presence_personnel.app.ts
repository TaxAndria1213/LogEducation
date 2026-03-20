import { Application, NextFunction, Request, Response as R, Router } from "express";
import type { PresencePersonnel } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import { prisma } from "../../../service/prisma";
import PresencePersonnelModel from "../models/presence_personnel.model";

type PresencePersonnelPayload = {
  personnel_id: string;
  date: Date;
  statut: string;
  note: string | null;
};

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

class PresencePersonnelApp {
  public app: Application;
  public router: Router;
  private presencePersonnel: PresencePersonnelModel;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.presencePersonnel = new PresencePersonnelModel();
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

  private normalizePayload(raw: Partial<PresencePersonnel>): PresencePersonnelPayload {
    const personnel_id = typeof raw.personnel_id === "string" ? raw.personnel_id.trim() : "";
    const date = parseDate(raw.date);
    const statut = typeof raw.statut === "string" && raw.statut.trim()
      ? raw.statut.trim().toUpperCase()
      : "PRESENT";
    const note = typeof raw.note === "string" && raw.note.trim() ? raw.note.trim() : null;

    if (!personnel_id) throw new Error("Le personnel est requis.");
    if (!date) throw new Error("La date de presence est invalide.");

    return {
      personnel_id,
      date,
      statut,
      note,
    };
  }

  private buildScopedWhere(existingWhere: Record<string, unknown>, tenantId: string) {
    const scope = { personnel: { etablissement_id: tenantId } };
    if (!existingWhere || Object.keys(existingWhere).length === 0) return scope;
    return { AND: [existingWhere, scope] };
  }

  private getInclude() {
    return {
      personnel: {
        include: {
          utilisateur: { include: { profil: true } },
        },
      },
    };
  }

  private async getScopedPresence(id: string, tenantId: string) {
    return prisma.presencePersonnel.findFirst({
      where: {
        id,
        personnel: { etablissement_id: tenantId },
      },
      include: this.getInclude(),
    });
  }

  private async validateReferences(payload: PresencePersonnelPayload, tenantId: string) {
    const personnel = await prisma.personnel.findFirst({
      where: { id: payload.personnel_id, etablissement_id: tenantId },
    });
    if (!personnel) throw new Error("Le personnel selectionne n'appartient pas a l'etablissement actif.");
  }

  private async ensureUnique(payload: PresencePersonnelPayload, excludeId?: string) {
    const existing = await prisma.presencePersonnel.findFirst({
      where: {
        personnel_id: payload.personnel_id,
        date: payload.date,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new Error("Une presence personnel existe deja pour cette personne a cette date.");
    }
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const payload = this.normalizePayload(req.body);
      await this.validateReferences(payload, tenantId);
      await this.ensureUnique(payload);
      const result = await prisma.presencePersonnel.create({ data: payload, include: this.getInclude() });
      Response.success(res, "Presence personnel creee.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la creation de la presence personnel", 400, error as Error);
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
      const result = await getAllPaginated(scopedQuery as typeof req.query, this.presencePersonnel);
      Response.success(res, "Presences personnel.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des presences personnel", 400, error as Error);
      next(error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const result = await this.getScopedPresence(req.params.id, tenantId);
      if (!result) throw new Error("Presence personnel introuvable pour cet etablissement.");
      Response.success(res, "Presence personnel detail.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation de la presence personnel", 404, error as Error);
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedPresence(req.params.id, tenantId);
      if (!existing) throw new Error("Presence personnel introuvable pour cet etablissement.");
      const result = await prisma.presencePersonnel.delete({ where: { id: req.params.id } });
      Response.success(res, "Presence personnel supprimee.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la suppression de la presence personnel", 400, error as Error);
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedPresence(req.params.id, tenantId);
      if (!existing) throw new Error("Presence personnel introuvable pour cet etablissement.");
      const payload = this.normalizePayload({ ...existing, ...(req.body as Partial<PresencePersonnel>) });
      await this.validateReferences(payload, tenantId);
      await this.ensureUnique(payload, req.params.id);
      const result = await prisma.presencePersonnel.update({ where: { id: req.params.id }, data: payload, include: this.getInclude() });
      Response.success(res, "Presence personnel mise a jour.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la mise a jour de la presence personnel", 400, error as Error);
      next(error);
    }
  }
}

export default PresencePersonnelApp;
