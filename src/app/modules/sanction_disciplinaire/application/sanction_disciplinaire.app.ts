import { Application, NextFunction, Request, Response as R, Router } from "express";
import type { SanctionDisciplinaire } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import { prisma } from "../../../service/prisma";
import SanctionDisciplinaireModel from "../models/sanction_disciplinaire.model";

type SanctionPayload = {
  incident_id: string;
  type_action: string;
  debut: Date | null;
  fin: Date | null;
  notes: string | null;
  decide_par: string | null;
};

class SanctionDisciplinaireApp {
  public app: Application;
  public router: Router;
  private sanction: SanctionDisciplinaireModel;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.sanction = new SanctionDisciplinaireModel();
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

  private parseDate(value: unknown) {
    if (value == null || value === "") return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value === "string" || typeof value === "number") {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date;
    }
    throw new Error("Une des dates de sanction est invalide.");
  }

  private normalizePayload(
    raw: Partial<SanctionDisciplinaire>,
    current?: Partial<SanctionDisciplinaire>,
  ): SanctionPayload {
    const incident_id =
      typeof raw.incident_id === "string"
        ? raw.incident_id.trim()
        : typeof current?.incident_id === "string"
          ? current.incident_id.trim()
          : "";
    const typeSource =
      typeof raw.type_action === "string" ? raw.type_action : current?.type_action ?? "";
    const type_action = typeSource.trim().replace(/\s+/g, " ");
    const notesSource =
      typeof raw.notes === "string" ? raw.notes : current?.notes ?? "";
    const notes = notesSource.trim() || null;
    const decideSource =
      typeof raw.decide_par === "string"
        ? raw.decide_par
        : typeof current?.decide_par === "string"
          ? current.decide_par
          : "";
    const decide_par = decideSource.trim() || null;
    const debut = this.parseDate(raw.debut ?? current?.debut ?? null);
    const fin = this.parseDate(raw.fin ?? current?.fin ?? null);

    if (!incident_id) throw new Error("L'incident disciplinaire est requis.");
    if (!type_action) throw new Error("Le type de sanction est requis.");
    if (debut && fin && fin < debut) {
      throw new Error("La date de fin de sanction doit etre posterieure a la date de debut.");
    }

    return {
      incident_id,
      type_action,
      debut,
      fin,
      notes,
      decide_par,
    };
  }

  private buildScopedWhere(existingWhere: Record<string, unknown>, tenantId: string) {
    const scope = { incident: { eleve: { etablissement_id: tenantId } } };
    if (!existingWhere || Object.keys(existingWhere).length === 0) return scope;
    return { AND: [existingWhere, scope] };
  }

  private getInclude() {
    return {
      incident: {
        include: {
          eleve: {
            include: {
              utilisateur: { include: { profil: true } },
            },
          },
        },
      },
    };
  }

  private async ensureIncident(incidentId: string, tenantId: string) {
    const incident = await prisma.incidentDisciplinaire.findFirst({
      where: { id: incidentId, eleve: { etablissement_id: tenantId } },
      select: { id: true },
    });

    if (!incident) {
      throw new Error("L'incident selectionne n'appartient pas a cet etablissement.");
    }
  }

  private async ensureUser(userId: string | null, tenantId: string, fieldLabel: string) {
    if (!userId) return;

    const user = await prisma.utilisateur.findFirst({
      where: { id: userId, etablissement_id: tenantId },
      select: { id: true },
    });

    if (!user) throw new Error(`${fieldLabel} ne correspond pas a un utilisateur de l'etablissement.`);
  }

  private async getScopedSanction(id: string, tenantId: string) {
    return prisma.sanctionDisciplinaire.findFirst({
      where: { id, incident: { eleve: { etablissement_id: tenantId } } },
      include: this.getInclude(),
    });
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const payload = this.normalizePayload(req.body);

      await this.ensureIncident(payload.incident_id, tenantId);
      await this.ensureUser(payload.decide_par, tenantId, "Le decideur");

      const result = await prisma.sanctionDisciplinaire.create({
        data: payload,
        include: this.getInclude(),
      });

      Response.success(res, "Sanction disciplinaire creee.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la creation de la sanction disciplinaire", 400, error as Error);
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
        orderBy: req.query.orderBy ?? JSON.stringify([{ created_at: "desc" }]),
      };
      const result = await getAllPaginated(scopedQuery as typeof req.query, this.sanction);
      Response.success(res, "Sanctions disciplinaires.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des sanctions disciplinaires", 400, error as Error);
      next(error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const result = await this.getScopedSanction(req.params.id, tenantId);
      if (!result) throw new Error("Sanction disciplinaire introuvable pour cet etablissement.");
      Response.success(res, "Sanction disciplinaire detail.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation de la sanction disciplinaire", 404, error as Error);
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedSanction(req.params.id, tenantId);
      if (!existing) throw new Error("Sanction disciplinaire introuvable pour cet etablissement.");

      const result = await prisma.sanctionDisciplinaire.delete({
        where: { id: req.params.id },
      });

      Response.success(res, "Sanction disciplinaire supprimee.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la suppression de la sanction disciplinaire", 400, error as Error);
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await prisma.sanctionDisciplinaire.findFirst({
        where: { id: req.params.id, incident: { eleve: { etablissement_id: tenantId } } },
      });
      if (!existing) throw new Error("Sanction disciplinaire introuvable pour cet etablissement.");

      const payload = this.normalizePayload(req.body, existing);
      await this.ensureIncident(payload.incident_id, tenantId);
      await this.ensureUser(payload.decide_par, tenantId, "Le decideur");

      const result = await prisma.sanctionDisciplinaire.update({
        where: { id: req.params.id },
        data: payload,
        include: this.getInclude(),
      });

      Response.success(res, "Sanction disciplinaire mise a jour.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la mise a jour de la sanction disciplinaire", 400, error as Error);
      next(error);
    }
  }
}

export default SanctionDisciplinaireApp;
