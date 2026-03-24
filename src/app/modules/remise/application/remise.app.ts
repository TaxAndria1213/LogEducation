import { Application, NextFunction, Request, Response as R, Router } from "express";
import { PrismaClient, type Prisma, type Remise } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import RemiseModel from "../models/remise.model";

type RemisePayload = {
  etablissement_id: string;
  nom: string;
  type: string;
  valeur: number;
  regles_json: Prisma.JsonValue | null;
};

const ALLOWED_TYPES = new Set(["PERCENT", "FIXED"]);

class RemiseApp {
  public app: Application;
  public router: Router;
  private remise: RemiseModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.remise = new RemiseModel();
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
      typeof req.body?.etablissement_id === "string"
        ? req.body.etablissement_id.trim()
        : undefined;
    const queryWhere = parseJSON<Record<string, unknown>>(req.query.where, {});
    const queryTenant =
      typeof queryWhere?.etablissement_id === "string"
        ? queryWhere.etablissement_id.trim()
        : undefined;

    const tenantCandidates = [requestTenant, bodyTenant, queryTenant].filter(
      (value): value is string => Boolean(value),
    );

    if (tenantCandidates.length === 0) {
      throw new Error("Aucun etablissement actif n'a ete fourni.");
    }

    if (new Set(tenantCandidates).size > 1) {
      throw new Error("Conflit d'etablissement detecte pour la remise.");
    }

    return tenantCandidates[0];
  }

  private normalizeRules(value: unknown): Prisma.JsonValue | null {
    if (value == null || value === "") return null;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      try {
        return JSON.parse(trimmed) as Prisma.JsonValue;
      } catch {
        throw new Error("Les regles de remise doivent etre un JSON valide.");
      }
    }
    return value as Prisma.JsonValue;
  }

  private normalizePayload(raw: Partial<Remise>, tenantId: string): RemisePayload {
    const nom = typeof raw.nom === "string" ? raw.nom.trim().replace(/\s+/g, " ") : "";
    const type = typeof raw.type === "string" ? raw.type.trim().toUpperCase() : "";
    const valeur = Number(raw.valeur ?? 0);

    if (!nom) {
      throw new Error("Le nom de la remise est requis.");
    }

    if (!ALLOWED_TYPES.has(type)) {
      throw new Error("Le type de remise doit etre `PERCENT` ou `FIXED`.");
    }

    if (!Number.isFinite(valeur) || valeur < 0) {
      throw new Error("La valeur de remise doit etre positive ou nulle.");
    }

    if (type === "PERCENT" && valeur > 100) {
      throw new Error("Une remise en pourcentage ne peut pas depasser 100.");
    }

    return {
      etablissement_id: tenantId,
      nom,
      type,
      valeur,
      regles_json: this.normalizeRules(raw.regles_json),
    };
  }

  private buildScopedWhere(existingWhere: Record<string, unknown>, tenantId: string) {
    if (!existingWhere || Object.keys(existingWhere).length === 0) {
      return { etablissement_id: tenantId };
    }

    return {
      AND: [existingWhere, { etablissement_id: tenantId }],
    };
  }

  private async ensureUniqueNom(data: RemisePayload, excludeId?: string) {
    const duplicate = await this.prisma.remise.findFirst({
      where: {
        etablissement_id: data.etablissement_id,
        nom: data.nom,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new Error("Une remise avec ce nom existe deja dans cet etablissement.");
    }
  }

  private async getScopedRemise(id: string, tenantId: string) {
    return this.prisma.remise.findFirst({
      where: { id, etablissement_id: tenantId },
    });
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const data = this.normalizePayload(req.body, tenantId);
      await this.ensureUniqueNom(data);
      const result = await this.remise.create(data);
      Response.success(res, "Remise creee avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la creation de la remise", 400, error as Error);
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
        orderBy: req.query.orderBy ?? JSON.stringify([{ nom: "asc" }, { created_at: "desc" }]),
      };
      const result = await getAllPaginated(scopedQuery as typeof req.query, this.remise);
      Response.success(res, "Liste des remises recuperee.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des remises", 400, error as Error);
      next(error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const includeSpec = parseJSON<Record<string, unknown>>(req.query.includeSpec, {});
      const result = await this.prisma.remise.findFirst({
        where: { id: req.params.id, etablissement_id: tenantId },
        include: includeSpec,
      });

      if (!result) {
        throw new Error("Remise introuvable pour cet etablissement.");
      }

      Response.success(res, "Detail de la remise.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation de la remise", 404, error as Error);
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedRemise(req.params.id, tenantId);

      if (!existing) {
        throw new Error("Remise introuvable pour cet etablissement.");
      }

      const result = await this.remise.delete(req.params.id);
      Response.success(res, "Remise supprimee avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la suppression de la remise", 400, error as Error);
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.prisma.remise.findFirst({
        where: { id: req.params.id, etablissement_id: tenantId },
      });

      if (!existing) {
        throw new Error("Remise introuvable pour cet etablissement.");
      }

      const data = this.normalizePayload(
        { ...existing, ...(req.body as Partial<Remise>) },
        tenantId,
      );

      await this.ensureUniqueNom(data, req.params.id);

      const result = await this.remise.update(req.params.id, data);
      Response.success(res, "Remise mise a jour avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la mise a jour de la remise", 400, error as Error);
      next(error);
    }
  }
}

export default RemiseApp;
