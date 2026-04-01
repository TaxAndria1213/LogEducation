import { Application, NextFunction, Request, Response as R, Router } from "express";
import { PrismaClient } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import FormuleCantineModel from "../models/formule_cantine.model";

type FormuleCantinePayload = {
  etablissement_id: string;
  nom: string;
  catalogue_frais_id: string;
};

class FormuleCantineApp {
  public app: Application;
  public router: Router;
  private formuleCantine: FormuleCantineModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.formuleCantine = new FormuleCantineModel();
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

  private resolveTenantId(req: Request): string {
    const requestTenant = (req as Request & { tenantId?: string }).tenantId;
    const bodyTenant =
      typeof req.body?.etablissement_id === "string" ? req.body.etablissement_id.trim() : undefined;
    const queryWhere = parseJSON<Record<string, unknown>>(req.query.where, {});
    const queryTenant =
      typeof queryWhere?.etablissement_id === "string" ? queryWhere.etablissement_id.trim() : undefined;
    const candidates = [requestTenant, bodyTenant, queryTenant].filter(
      (value): value is string => Boolean(value),
    );
    if (candidates.length === 0) throw new Error("Aucun etablissement actif n'a ete fourni.");
    if (new Set(candidates).size > 1) throw new Error("Conflit d'etablissement detecte pour les formules de cantine.");
    return candidates[0];
  }

  private buildScopedWhere(existingWhere: Record<string, unknown>, tenantId: string) {
    if (!existingWhere || Object.keys(existingWhere).length === 0) return { etablissement_id: tenantId };
    return { AND: [existingWhere, { etablissement_id: tenantId }] };
  }

  private async normalizePayload(raw: Record<string, unknown>, tenantId: string): Promise<FormuleCantinePayload> {
    const nom = typeof raw.nom === "string" ? raw.nom.trim() : "";
    const catalogue_frais_id =
      typeof raw.catalogue_frais_id === "string" && raw.catalogue_frais_id.trim()
        ? raw.catalogue_frais_id.trim()
        : "";

    if (!nom) {
      throw new Error("Le nom de la formule de cantine est obligatoire.");
    }

    if (!catalogue_frais_id) {
      throw new Error("Le frais catalogue de la formule de cantine est obligatoire.");
    }

    const frais = await this.prisma.catalogueFrais.findFirst({
      where: {
        id: catalogue_frais_id,
        etablissement_id: tenantId,
      },
      select: {
        id: true,
        usage_scope: true as never,
      },
    }) as {
      id: string;
      usage_scope: string | null;
    } | null;

    if (!frais) {
      throw new Error("Le frais selectionne n'appartient pas a cet etablissement.");
    }

    const usageScope = (frais.usage_scope ?? "GENERAL").toUpperCase();
    if (!["GENERAL", "CANTINE"].includes(usageScope)) {
      throw new Error("Le frais selectionne n'est pas compatible avec la cantine.");
    }

    return {
      etablissement_id: tenantId,
      nom,
      catalogue_frais_id,
    };
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const data = await this.normalizePayload(req.body as Record<string, unknown>, tenantId);
      const result = await this.formuleCantine.create(data);
      Response.success(res, "Formule de cantine creee.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la creation de la formule de cantine",
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
      const result = await getAllPaginated(scopedQuery as typeof req.query, this.formuleCantine);
      Response.success(res, "Formules de cantine.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation des formules de cantine",
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
      const result = await this.prisma.formuleCantine.findFirst({
        where: { id, etablissement_id: tenantId },
        include: { abonnements: true, frais: true },
      });
      Response.success(res, "Formule de cantine.", result);
    } catch (error) {
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const id: string = req.params.id;
      const existing = await this.prisma.formuleCantine.findFirst({
        where: { id, etablissement_id: tenantId },
        include: { abonnements: true, frais: true },
      });
      if (!existing) throw new Error("Formule de cantine introuvable.");
      if ((existing.abonnements?.length ?? 0) > 0) {
        throw new Error("Cette formule est utilisee par des abonnements cantine.");
      }
      const result = await this.formuleCantine.delete(id);
      Response.success(res, "Formule de cantine supprimee.", result);
    } catch (error) {
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const id: string = req.params.id;
      const existing = await this.prisma.formuleCantine.findFirst({
        where: { id, etablissement_id: tenantId },
        select: { id: true },
      });
      if (!existing) throw new Error("Formule de cantine introuvable.");
      const data = await this.normalizePayload(req.body as Record<string, unknown>, tenantId);
      const result = await this.formuleCantine.update(id, data);
      Response.success(res, "Formule de cantine mise a jour.", result);
    } catch (error) {
      next(error);
    }
  }
}

export default FormuleCantineApp;
