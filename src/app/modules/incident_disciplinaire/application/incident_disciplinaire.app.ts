import { Application, NextFunction, Request, Response as R, Router } from "express";
import type { IncidentDisciplinaire } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import { prisma } from "../../../service/prisma";
import IncidentDisciplinaireModel from "../models/incident_disciplinaire.model";

type IncidentPayload = {
  eleve_id: string;
  date: Date;
  signale_par: string | null;
  description: string;
  gravite: number | null;
  statut: string | null;
};

class IncidentDisciplinaireApp {
  public app: Application;
  public router: Router;
  private incident: IncidentDisciplinaireModel;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.incident = new IncidentDisciplinaireModel();
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
    throw new Error("La date de l'incident est invalide.");
  }

  private normalizePayload(
    raw: Partial<IncidentDisciplinaire>,
    current?: Partial<IncidentDisciplinaire>,
  ): IncidentPayload {
    const eleve_id =
      typeof raw.eleve_id === "string"
        ? raw.eleve_id.trim()
        : typeof current?.eleve_id === "string"
          ? current.eleve_id.trim()
          : "";
    const descriptionSource =
      typeof raw.description === "string" ? raw.description : current?.description ?? "";
    const description = descriptionSource.trim().replace(/\s+/g, " ");
    const signaleParSource =
      typeof raw.signale_par === "string"
        ? raw.signale_par
        : typeof current?.signale_par === "string"
          ? current.signale_par
          : "";
    const signale_par = signaleParSource.trim() || null;
    const statutSource =
      typeof raw.statut === "string" ? raw.statut : current?.statut ?? "OUVERT";
    const statut = statutSource?.trim() ? statutSource.trim().toUpperCase() : "OUVERT";
    const graviteSource =
      raw.gravite ?? current?.gravite ?? null;
    const gravite =
      graviteSource == null || (typeof graviteSource === "string" && graviteSource === "")
        ? null
        : Number(graviteSource);

    if (!eleve_id) throw new Error("L'eleve est requis.");
    if (!description) throw new Error("La description de l'incident est requise.");
    if (gravite !== null && (!Number.isInteger(gravite) || gravite < 1 || gravite > 5)) {
      throw new Error("La gravite doit etre un entier compris entre 1 et 5.");
    }

    return {
      eleve_id,
      date: this.parseDate(raw.date ?? current?.date ?? new Date()),
      signale_par,
      description,
      gravite,
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
      sanctions: true,
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

  private async getScopedIncident(id: string, tenantId: string) {
    return prisma.incidentDisciplinaire.findFirst({
      where: { id, eleve: { etablissement_id: tenantId } },
      include: this.getInclude(),
    });
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const payload = this.normalizePayload(req.body);

      await this.ensureEleve(payload.eleve_id, tenantId);
      await this.ensureUser(payload.signale_par, tenantId, "Le declarant");

      const result = await prisma.incidentDisciplinaire.create({
        data: payload,
        include: this.getInclude(),
      });

      Response.success(res, "Incident disciplinaire cree.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la creation de l'incident disciplinaire", 400, error as Error);
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
      const result = await getAllPaginated(scopedQuery as typeof req.query, this.incident);
      Response.success(res, "Incidents disciplinaires.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des incidents disciplinaires", 400, error as Error);
      next(error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const result = await this.getScopedIncident(req.params.id, tenantId);
      if (!result) throw new Error("Incident disciplinaire introuvable pour cet etablissement.");
      Response.success(res, "Incident disciplinaire detail.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation de l'incident disciplinaire", 404, error as Error);
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedIncident(req.params.id, tenantId);
      if (!existing) throw new Error("Incident disciplinaire introuvable pour cet etablissement.");
      if ((existing.sanctions?.length ?? 0) > 0) {
        throw new Error("Cet incident contient deja des sanctions et ne peut pas etre supprime.");
      }

      const result = await prisma.incidentDisciplinaire.delete({
        where: { id: req.params.id },
      });

      Response.success(res, "Incident disciplinaire supprime.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la suppression de l'incident disciplinaire", 400, error as Error);
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await prisma.incidentDisciplinaire.findFirst({
        where: { id: req.params.id, eleve: { etablissement_id: tenantId } },
      });
      if (!existing) throw new Error("Incident disciplinaire introuvable pour cet etablissement.");

      const payload = this.normalizePayload(req.body, existing);
      await this.ensureEleve(payload.eleve_id, tenantId);
      await this.ensureUser(payload.signale_par, tenantId, "Le declarant");

      const result = await prisma.incidentDisciplinaire.update({
        where: { id: req.params.id },
        data: payload,
        include: this.getInclude(),
      });

      Response.success(res, "Incident disciplinaire mis a jour.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la mise a jour de l'incident disciplinaire", 400, error as Error);
      next(error);
    }
  }
}

export default IncidentDisciplinaireApp;
