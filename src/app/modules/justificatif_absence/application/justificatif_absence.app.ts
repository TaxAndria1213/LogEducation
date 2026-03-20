import { Application, NextFunction, Request, Response as R, Router } from "express";
import type { JustificatifAbsence } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import { prisma } from "../../../service/prisma";
import JustificatifAbsenceModel from "../models/justificatif_absence.model";

type JustificatifPayload = {
  eleve_id: string;
  date_debut: Date;
  date_fin: Date;
  motif_absence_id: string | null;
  document_url: string | null;
  approuve_par: string | null;
  approuve_le: Date | null;
  statut: string;
};

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

class JustificatifAbsenceApp {
  public app: Application;
  public router: Router;
  private justificatifAbsence: JustificatifAbsenceModel;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.justificatifAbsence = new JustificatifAbsenceModel();
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

  private normalizePayload(raw: Partial<JustificatifAbsence>, req: Request): JustificatifPayload {
    const eleve_id = typeof raw.eleve_id === "string" ? raw.eleve_id.trim() : "";
    const date_debut = parseDate(raw.date_debut);
    const date_fin = parseDate(raw.date_fin);
    const motif_absence_id = typeof raw.motif_absence_id === "string" && raw.motif_absence_id.trim()
      ? raw.motif_absence_id.trim()
      : null;
    const document_url = typeof raw.document_url === "string" && raw.document_url.trim()
      ? raw.document_url.trim()
      : null;
    const statutRaw = typeof raw.statut === "string" && raw.statut.trim()
      ? raw.statut.trim().toUpperCase()
      : "EN_ATTENTE";
    const statut = ["EN_ATTENTE", "APPROUVE", "REFUSE"].includes(statutRaw)
      ? statutRaw
      : "EN_ATTENTE";
    const actorId = (req as Request & { user?: { sub?: string } }).user?.sub ?? null;
    const approuve_par = statut === "EN_ATTENTE"
      ? null
      : (typeof raw.approuve_par === "string" && raw.approuve_par.trim() ? raw.approuve_par.trim() : actorId);
    const approuve_le = statut === "EN_ATTENTE" ? null : parseDate(raw.approuve_le) ?? new Date();

    if (!eleve_id) throw new Error("L'eleve est requis.");
    if (!date_debut || !date_fin) throw new Error("Les dates du justificatif sont requises.");
    if (date_fin < date_debut) throw new Error("La date de fin du justificatif doit etre posterieure ou egale a la date de debut.");

    return {
      eleve_id,
      date_debut,
      date_fin,
      motif_absence_id,
      document_url,
      approuve_par,
      approuve_le,
      statut,
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
      motif: true,
    };
  }

  private async getScopedJustificatif(id: string, tenantId: string) {
    return prisma.justificatifAbsence.findFirst({
      where: {
        id,
        eleve: { etablissement_id: tenantId },
      },
      include: this.getInclude(),
    });
  }

  private async validateReferences(payload: JustificatifPayload, tenantId: string) {
    const [eleve, motif] = await Promise.all([
      prisma.eleve.findFirst({
        where: { id: payload.eleve_id, etablissement_id: tenantId },
      }),
      payload.motif_absence_id
        ? prisma.motifAbsence.findFirst({
            where: { id: payload.motif_absence_id, etablissement_id: tenantId },
          })
        : Promise.resolve(null),
    ]);

    if (!eleve) throw new Error("L'eleve selectionne n'appartient pas a l'etablissement actif.");
    if (payload.motif_absence_id && !motif) {
      throw new Error("Le motif d'absence selectionne n'appartient pas a l'etablissement actif.");
    }
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const payload = this.normalizePayload(req.body, req);
      await this.validateReferences(payload, tenantId);
      const result = await prisma.justificatifAbsence.create({ data: payload, include: this.getInclude() });
      Response.success(res, "Justificatif d'absence cree.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la creation du justificatif d'absence", 400, error as Error);
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
        orderBy: req.query.orderBy ?? JSON.stringify([{ date_debut: "desc" }, { created_at: "desc" }]),
      };
      const result = await getAllPaginated(scopedQuery as typeof req.query, this.justificatifAbsence);
      Response.success(res, "Justificatifs d'absence.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des justificatifs d'absence", 400, error as Error);
      next(error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const result = await this.getScopedJustificatif(req.params.id, tenantId);
      if (!result) throw new Error("Justificatif d'absence introuvable pour cet etablissement.");
      Response.success(res, "Justificatif d'absence detail.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation du justificatif d'absence", 404, error as Error);
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedJustificatif(req.params.id, tenantId);
      if (!existing) throw new Error("Justificatif d'absence introuvable pour cet etablissement.");
      const result = await prisma.justificatifAbsence.delete({ where: { id: req.params.id } });
      Response.success(res, "Justificatif d'absence supprime.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la suppression du justificatif d'absence", 400, error as Error);
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedJustificatif(req.params.id, tenantId);
      if (!existing) throw new Error("Justificatif d'absence introuvable pour cet etablissement.");
      const payload = this.normalizePayload({ ...existing, ...(req.body as Partial<JustificatifAbsence>) }, req);
      await this.validateReferences(payload, tenantId);
      const result = await prisma.justificatifAbsence.update({ where: { id: req.params.id }, data: payload, include: this.getInclude() });
      Response.success(res, "Justificatif d'absence mis a jour.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la mise a jour du justificatif d'absence", 400, error as Error);
      next(error);
    }
  }
}

export default JustificatifAbsenceApp;
