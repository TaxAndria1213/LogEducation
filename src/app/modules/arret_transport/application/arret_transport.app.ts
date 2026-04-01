import { Application, NextFunction, Request, Response as R, Router } from "express";
import { ArretTransport, PrismaClient } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import ArretTransportModel from "../models/arret_transport.model";

class ArretTransportApp {
  public app: Application;
  public router: Router;
  private arretTransport: ArretTransportModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.arretTransport = new ArretTransportModel();
    this.prisma = new PrismaClient();
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

  private async resolveTenantIdForWrite(req: Request, ligneTransportId?: string): Promise<string> {
    try {
      return this.resolveTenantId(req);
    } catch (error) {
      const ligneId =
        ligneTransportId ??
        (typeof req.body?.ligne_transport_id === "string"
          ? req.body.ligne_transport_id.trim()
          : "");

      if (!ligneId) throw error;

      const ligne = await this.prisma.ligneTransport.findUnique({
        where: { id: ligneId },
        select: { etablissement_id: true },
      });

      if (!ligne?.etablissement_id) throw error;
      return ligne.etablissement_id;
    }
  }

  private resolveTenantId(req: Request): string {
    const requestTenant = (req as Request & { tenantId?: string }).tenantId;
    const bodyTenant =
      typeof req.body?.etablissement_id === "string" ? req.body.etablissement_id.trim() : undefined;
    const queryWhere = parseJSON<Record<string, unknown>>(req.query.where, {});
    const queryTenant =
      typeof (queryWhere?.ligne as { is?: { etablissement_id?: unknown } } | undefined)?.is
        ?.etablissement_id === "string"
        ? ((queryWhere.ligne as { is?: { etablissement_id?: string } }).is?.etablissement_id ?? "").trim()
        : undefined;
    const candidates = [requestTenant, bodyTenant, queryTenant].filter(
      (value): value is string => Boolean(value),
    );
    if (candidates.length === 0) throw new Error("Aucun etablissement actif n'a ete fourni.");
    if (new Set(candidates).size > 1) throw new Error("Conflit d'etablissement detecte pour les arrets de transport.");
    return candidates[0];
  }

  private buildScopedWhere(existingWhere: Record<string, unknown>, tenantId: string) {
    const scope = { ligne: { is: { etablissement_id: tenantId } } };
    if (!existingWhere || Object.keys(existingWhere).length === 0) return scope;
    return { AND: [existingWhere, scope] };
  }

  private async ensureScopedLigne(ligneId: string, tenantId: string) {
    const ligne = await this.prisma.ligneTransport.findFirst({
      where: { id: ligneId, etablissement_id: tenantId },
      select: { id: true },
    });
    if (!ligne) throw new Error("La ligne selectionnee n'appartient pas a cet etablissement.");
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = await this.resolveTenantIdForWrite(req);
      const data: ArretTransport = req.body;
      await this.ensureScopedLigne(data.ligne_transport_id, tenantId);
      const result = await this.arretTransport.create(data);
      Response.success(res, "Arret de transport cree.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la creation de l'arret de transport",
        400,
        error as Error,
      );
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
      };
      const result = await getAllPaginated(scopedQuery as typeof req.query, this.arretTransport);
      Response.success(res, "Arrets de transport.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation des arrets de transport",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const id: string = req.params.id;
      const result = await this.prisma.arretTransport.findFirst({
        where: { id, ligne: { is: { etablissement_id: tenantId } } },
        include: { ligne: true, AbonnementTransport: true },
      });
      Response.success(res, "Arret de transport.", result);
    } catch (error) {
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const id: string = req.params.id;
      const existing = await this.prisma.arretTransport.findFirst({
        where: { id, ligne: { is: { etablissement_id: tenantId } } },
        include: { AbonnementTransport: true },
      });
      if (!existing) throw new Error("Arret de transport introuvable.");
      if ((existing.AbonnementTransport?.length ?? 0) > 0) {
        throw new Error("Cet arret est utilise par des abonnements transport.");
      }
      const result = await this.arretTransport.delete(id);
      Response.success(res, "Arret de transport supprime.", result);
    } catch (error) {
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = await this.resolveTenantIdForWrite(req);
      const id: string = req.params.id;
      const data: ArretTransport = req.body;
      const existing = await this.prisma.arretTransport.findFirst({
        where: { id, ligne: { is: { etablissement_id: tenantId } } },
        select: { id: true },
      });
      if (!existing) throw new Error("Arret de transport introuvable.");
      await this.ensureScopedLigne(data.ligne_transport_id, tenantId);
      const result = await this.arretTransport.update(id, data);
      Response.success(res, "Arret de transport mis a jour.", result);
    } catch (error) {
      next(error);
    }
  }
}

export default ArretTransportApp;
