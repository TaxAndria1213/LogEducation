import { Application, NextFunction, Request, Response as R, Router } from "express";
import type { PresenceEleve, StatutPresence } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import { prisma } from "../../../service/prisma";
import PresenceEleveModel from "../models/presence_eleve.model";

type PresenceElevePayload = {
  session_appel_id: string;
  eleve_id: string;
  statut: StatutPresence;
  minutes_retard: number | null;
  note: string | null;
};

class PresenceEleveApp {
  public app: Application;
  public router: Router;
  private presenceEleve: PresenceEleveModel;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.presenceEleve = new PresenceEleveModel();
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
    const requestTenant = (req as Request & { tenantId?: string }).tenantId;
    const queryWhere = parseJSON<Record<string, unknown>>(req.query.where, {});
    const queryTenant =
      typeof queryWhere?.session === "object" &&
      queryWhere.session !== null &&
      typeof (queryWhere.session as { classe?: { etablissement_id?: unknown } }).classe === "object" &&
      (queryWhere.session as { classe?: { etablissement_id?: unknown } }).classe !== null &&
      typeof ((queryWhere.session as { classe: { etablissement_id?: unknown } }).classe.etablissement_id) === "string"
        ? (((queryWhere.session as { classe: { etablissement_id: string } }).classe.etablissement_id)).trim()
        : requestTenant;

    if (!queryTenant) {
      throw new Error("Aucun etablissement actif n'a ete fourni.");
    }

    return queryTenant;
  }

  private normalizePayload(raw: Partial<PresenceEleve>): PresenceElevePayload {
    const session_appel_id = typeof raw.session_appel_id === "string" ? raw.session_appel_id.trim() : "";
    const eleve_id = typeof raw.eleve_id === "string" ? raw.eleve_id.trim() : "";
    const statut = ["PRESENT", "ABSENT", "RETARD", "EXCUSE"].includes(String(raw.statut))
      ? (String(raw.statut) as StatutPresence)
      : null;
    const minutes_retard =
      raw.minutes_retard == null ? null : Number(raw.minutes_retard);
    const note = typeof raw.note === "string" && raw.note.trim() ? raw.note.trim() : null;

    if (!session_appel_id) throw new Error("La session d'appel est requise.");
    if (!eleve_id) throw new Error("L'eleve est requis.");
    if (!statut) throw new Error("Le statut de presence est requis.");
    if (minutes_retard !== null && (!Number.isFinite(minutes_retard) || minutes_retard < 0)) {
      throw new Error("Les minutes de retard doivent etre un nombre positif.");
    }

    return {
      session_appel_id,
      eleve_id,
      statut,
      minutes_retard: statut === "RETARD" ? minutes_retard ?? 0 : null,
      note,
    };
  }

  private buildScopedWhere(existingWhere: Record<string, unknown>, tenantId: string) {
    const scope = { session: { classe: { etablissement_id: tenantId } } };
    if (!existingWhere || Object.keys(existingWhere).length === 0) return scope;
    return { AND: [existingWhere, scope] };
  }

  private getInclude() {
    return {
      session: {
        include: {
          classe: { include: { niveau: true, site: true, annee: true } },
          creneau: true,
        },
      },
      eleve: {
        include: {
          utilisateur: { include: { profil: true } },
        },
      },
    };
  }

  private async getScopedPresence(id: string, tenantId: string) {
    return prisma.presenceEleve.findFirst({
      where: {
        id,
        session: { classe: { etablissement_id: tenantId } },
      },
      include: this.getInclude(),
    });
  }

  private async validateReferences(payload: PresenceElevePayload, tenantId: string) {
    const [session, eleve] = await Promise.all([
      prisma.sessionAppel.findFirst({
        where: {
          id: payload.session_appel_id,
          classe: { etablissement_id: tenantId },
        },
        include: {
          classe: true,
        },
      }),
      prisma.eleve.findFirst({
        where: {
          id: payload.eleve_id,
          etablissement_id: tenantId,
        },
      }),
    ]);

    if (!session) throw new Error("La session selectionnee n'appartient pas a l'etablissement actif.");
    if (!eleve) throw new Error("L'eleve selectionne n'appartient pas a l'etablissement actif.");

    const inscription = await prisma.inscription.findFirst({
      where: {
        eleve_id: payload.eleve_id,
        classe_id: session.classe_id,
        annee_scolaire_id: session.classe.annee_scolaire_id,
        statut: "INSCRIT",
      },
      select: { id: true },
    });

    if (!inscription) {
      throw new Error("L'eleve selectionne n'est pas inscrit dans la classe de cette session.");
    }
  }

  private async ensureUnique(payload: PresenceElevePayload, excludeId?: string) {
    const existing = await prisma.presenceEleve.findFirst({
      where: {
        session_appel_id: payload.session_appel_id,
        eleve_id: payload.eleve_id,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (existing) {
      throw new Error("Une presence existe deja pour cet eleve dans cette session.");
    }
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const payload = this.normalizePayload(req.body);
      await this.validateReferences(payload, tenantId);
      await this.ensureUnique(payload);
      const result = await prisma.presenceEleve.create({ data: payload, include: this.getInclude() });
      Response.success(res, "Presence eleve creee.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la creation de la presence eleve", 400, error as Error);
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
      const result = await getAllPaginated(scopedQuery as typeof req.query, this.presenceEleve);
      Response.success(res, "Presences eleves.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des presences eleves", 400, error as Error);
      next(error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const result = await this.getScopedPresence(req.params.id, tenantId);
      if (!result) throw new Error("Presence eleve introuvable pour cet etablissement.");
      Response.success(res, "Presence eleve detail.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation de la presence eleve", 404, error as Error);
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedPresence(req.params.id, tenantId);
      if (!existing) throw new Error("Presence eleve introuvable pour cet etablissement.");
      const result = await prisma.presenceEleve.delete({ where: { id: req.params.id } });
      Response.success(res, "Presence eleve supprimee.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la suppression de la presence eleve", 400, error as Error);
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedPresence(req.params.id, tenantId);
      if (!existing) throw new Error("Presence eleve introuvable pour cet etablissement.");
      const payload = this.normalizePayload({ ...existing, ...(req.body as Partial<PresenceEleve>) });
      await this.validateReferences(payload, tenantId);
      await this.ensureUnique(payload, req.params.id);
      const result = await prisma.presenceEleve.update({ where: { id: req.params.id }, data: payload, include: this.getInclude() });
      Response.success(res, "Presence eleve mise a jour.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la mise a jour de la presence eleve", 400, error as Error);
      next(error);
    }
  }
}

export default PresenceEleveApp;
