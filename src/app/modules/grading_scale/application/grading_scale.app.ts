import { Application, NextFunction, Request, Response as R, Router } from "express";
import {
  GradingType,
  Prisma,
  PrismaClient,
  type GradingScale,
  type GradingScaleLevel,
} from "@prisma/client";
import Response from "../../../common/app/response";
import GradingScaleModel from "../models/grading_scale.model";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import { prisma } from "../../../service/prisma";
import { getRequiredActiveAcademicYear } from "../../pedagogie_shared/utils/academicScope";

type GradingScalePayload = Pick<
  GradingScale,
  | "etablissement_id"
  | "annee_scolaire_id"
  | "nom"
  | "grading_type"
  | "base_score"
  | "use_for_calculation"
  | "allow_decimal"
  | "is_default"
  | "is_active"
>;

type GradingScaleLevelPayload = Pick<
  GradingScaleLevel,
  | "code"
  | "label"
  | "numeric_value"
  | "min_value"
  | "max_value"
  | "display_order"
  | "color"
  | "is_success_level"
  | "is_active"
> & {
  id?: string;
};

const GRADING_TYPES: GradingType[] = [
  "POINTS",
  "LETTER",
  "LEVEL",
  "DESCRIPTIVE",
  "PERCENTAGE",
  "VALIDATION",
];

class GradingScaleApp {
  public app: Application;
  public router: Router;
  private gradingScale: GradingScaleModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.gradingScale = new GradingScaleModel();
    this.prisma = prisma;
    this.routes();
  }

  public routes(): Router {
    this.router.post("/:id/levels", this.saveLevels.bind(this));
    this.router.put("/levels/:levelId", this.updateLevel.bind(this));
    this.router.delete("/levels/:levelId", this.deleteLevel.bind(this));
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
      throw new Error("Conflit d'etablissement detecte pour l'echelle de notation.");
    }

    return tenantCandidates[0];
  }

  private normalizeBoolean(value: unknown, fallback: boolean) {
    return typeof value === "boolean" ? value : fallback;
  }

  private normalizeNumber(
    value: unknown,
    fieldLabel: string,
    options?: {
      min?: number;
      allowNull?: boolean;
    },
  ) {
    if (value === undefined || value === null || value === "") {
      return options?.allowNull === false ? 0 : null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(`${fieldLabel} est invalide.`);
    }

    if (typeof options?.min === "number" && parsed < options.min) {
      throw new Error(`${fieldLabel} doit etre superieur ou egal a ${options.min}.`);
    }

    return parsed;
  }

  private normalizePayload(
    raw: Partial<GradingScale>,
    tenantId: string,
    activeYearId: string,
  ): GradingScalePayload {
    const normalizedName =
      typeof raw.nom === "string" ? raw.nom.trim().replace(/\s+/g, " ") : "";

    if (!normalizedName) {
      throw new Error("Le nom de l'echelle de notation est requis.");
    }

    const gradingType =
      typeof raw.grading_type === "string"
        ? raw.grading_type.trim().toUpperCase()
        : String(raw.grading_type ?? "").trim().toUpperCase();

    if (!GRADING_TYPES.includes(gradingType as GradingType)) {
      throw new Error("Le type d'echelle de notation est invalide.");
    }

    return {
      etablissement_id: tenantId,
      annee_scolaire_id: activeYearId,
      nom: normalizedName,
      grading_type: gradingType as GradingType,
      base_score: this.normalizeNumber(raw.base_score, "La base de notation", {
        min: 0,
      }),
      use_for_calculation: this.normalizeBoolean(raw.use_for_calculation, true),
      allow_decimal: this.normalizeBoolean(raw.allow_decimal, true),
      is_default: this.normalizeBoolean(raw.is_default, false),
      is_active: this.normalizeBoolean(raw.is_active, true),
    };
  }

  private normalizeLevelPayload(raw: Partial<GradingScaleLevel>): GradingScaleLevelPayload {
    const code =
      typeof raw.code === "string" ? raw.code.trim().replace(/\s+/g, " ").toUpperCase() : "";
    if (!code) {
      throw new Error("Le code du niveau de notation est requis.");
    }

    const label =
      typeof raw.label === "string" ? raw.label.trim().replace(/\s+/g, " ") : "";
    if (!label) {
      throw new Error("Le libelle du niveau de notation est requis.");
    }

    const displayOrderRaw = this.normalizeNumber(
      raw.display_order,
      "L'ordre d'affichage du niveau",
      { min: 0, allowNull: false },
    );

    return {
      id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : undefined,
      code,
      label,
      numeric_value: this.normalizeNumber(raw.numeric_value, "La valeur numerique"),
      min_value: this.normalizeNumber(raw.min_value, "La valeur minimale"),
      max_value: this.normalizeNumber(raw.max_value, "La valeur maximale"),
      display_order: typeof displayOrderRaw === "number" ? Math.floor(displayOrderRaw) : 0,
      color:
        typeof raw.color === "string" && raw.color.trim()
          ? raw.color.trim()
          : null,
      is_success_level: this.normalizeBoolean(raw.is_success_level, false),
      is_active: this.normalizeBoolean(raw.is_active, true),
    };
  }

  private async ensureUniqueScale(
    data: GradingScalePayload,
    excludeId?: string,
  ) {
    const duplicate = await this.prisma.gradingScale.findFirst({
      where: {
        id: excludeId ? { not: excludeId } : undefined,
        annee_scolaire_id: data.annee_scolaire_id,
        nom: data.nom,
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new Error("Une echelle de notation avec ce nom existe deja pour l'annee courante.");
    }
  }

  private async getScopedScale(
    id: string,
    tenantId: string,
    activeYearId: string,
  ) {
    return this.prisma.gradingScale.findFirst({
      where: {
        id,
        etablissement_id: tenantId,
        annee_scolaire_id: activeYearId,
      },
    });
  }

  private buildScopedWhere(
    existingWhere: Record<string, unknown>,
    tenantId: string,
    activeYearId: string,
  ): Record<string, unknown> {
    const scopeWhere = {
      etablissement_id: tenantId,
      annee_scolaire_id: activeYearId,
    };

    if (!existingWhere || Object.keys(existingWhere).length === 0) {
      return scopeWhere;
    }

    return {
      AND: [existingWhere, scopeWhere],
    };
  }

  private async applyDefaultFlag(
    tx: Prisma.TransactionClient,
    scaleId: string,
    activeYearId: string,
    isDefault: boolean,
  ) {
    if (!isDefault) return;

    await tx.gradingScale.updateMany({
      where: {
        annee_scolaire_id: activeYearId,
        id: { not: scaleId },
        is_default: true,
      },
      data: {
        is_default: false,
      },
    });
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);
      const data = this.normalizePayload(req.body, tenantId, activeYear.id);
      await this.ensureUniqueScale(data);

      const result = await this.prisma.$transaction(async (tx) => {
        const created = await tx.gradingScale.create({ data });
        await this.applyDefaultFlag(tx, created.id, activeYear.id, data.is_default);
        return created;
      });

      Response.success(res, "Echelle de notation creee avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la creation de l'echelle de notation",
        400,
        error as Error,
      );
    }
  }

  private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);
      const where = parseJSON<Record<string, unknown>>(req.query.where, {});
      const scopedQuery = {
        ...req.query,
        where: JSON.stringify(this.buildScopedWhere(where, tenantId, activeYear.id)),
        orderBy:
          req.query.orderBy ??
          JSON.stringify([{ is_default: "desc" }, { nom: "asc" }, { created_at: "desc" }]),
      };

      const result = await getAllPaginated(
        scopedQuery as typeof req.query,
        this.gradingScale,
      );
      Response.success(res, "Liste des echelles de notation recuperee.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation des echelles de notation",
        400,
        error as Error,
      );
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);
      const includeSpec = parseJSON<Record<string, unknown>>(req.query.includeSpec, {
        levels: true,
      });

      const result = await this.prisma.gradingScale.findFirst({
        where: {
          id: req.params.id,
          etablissement_id: tenantId,
          annee_scolaire_id: activeYear.id,
        },
        include: includeSpec,
      });

      if (!result) {
        throw new Error("Echelle de notation introuvable pour cet etablissement.");
      }

      Response.success(res, "Detail de l'echelle de notation.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation de l'echelle de notation",
        404,
        error as Error,
      );
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);
      const existing = await this.prisma.gradingScale.findFirst({
        where: {
          id: req.params.id,
          etablissement_id: tenantId,
          annee_scolaire_id: activeYear.id,
        },
        include: {
          _count: {
            select: {
              evaluations: true,
              levels: true,
            },
          },
        },
      });

      if (!existing) {
        throw new Error("Echelle de notation introuvable pour cet etablissement.");
      }

      if (existing._count.evaluations > 0) {
        throw new Error(
          `Suppression impossible: cette echelle est encore utilisee par ${existing._count.evaluations} evaluation(s).`,
        );
      }

      const result = await this.gradingScale.delete(existing.id);
      Response.success(res, "Echelle de notation supprimee avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la suppression de l'echelle de notation",
        400,
        error as Error,
      );
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);
      const existing = await this.getScopedScale(req.params.id, tenantId, activeYear.id);

      if (!existing) {
        throw new Error("Echelle de notation introuvable pour cet etablissement.");
      }

      const data = this.normalizePayload(req.body, tenantId, activeYear.id);
      await this.ensureUniqueScale(data, existing.id);

      const result = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.gradingScale.update({
          where: { id: existing.id },
          data,
        });
        await this.applyDefaultFlag(tx, existing.id, activeYear.id, data.is_default);
        return updated;
      });

      Response.success(res, "Echelle de notation mise a jour avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la mise a jour de l'echelle de notation",
        400,
        error as Error,
      );
    }
  }

  private async saveLevels(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);
      const scale = await this.getScopedScale(req.params.id, tenantId, activeYear.id);

      if (!scale) {
        throw new Error("Echelle de notation introuvable pour cet etablissement.");
      }

      const levelsInput = Array.isArray(req.body?.levels) ? req.body.levels : [];
      if (levelsInput.length === 0) {
        throw new Error("Au moins un niveau de notation est requis.");
      }

      const levels = levelsInput.map((item: unknown) =>
        this.normalizeLevelPayload(item as Partial<GradingScaleLevel>),
      );
      const normalizedCodes = levels.map((item: GradingScaleLevelPayload) => item.code);
      if (new Set(normalizedCodes).size !== normalizedCodes.length) {
        throw new Error("Les codes des niveaux de notation doivent etre uniques.");
      }

      const result = await this.prisma.$transaction(async (tx) => {
        await tx.gradingScaleLevel.deleteMany({
          where: { grading_scale_id: scale.id },
        });

        await tx.gradingScaleLevel.createMany({
          data: levels.map((level: GradingScaleLevelPayload) => ({
            grading_scale_id: scale.id,
            code: level.code,
            label: level.label,
            numeric_value: level.numeric_value,
            min_value: level.min_value,
            max_value: level.max_value,
            display_order: level.display_order,
            color: level.color,
            is_success_level: level.is_success_level,
            is_active: level.is_active,
          })),
        });

        return tx.gradingScale.findUnique({
          where: { id: scale.id },
          include: {
            levels: {
              orderBy: [{ display_order: "asc" }, { code: "asc" }],
            },
          },
        });
      });

      Response.success(res, "Niveaux de notation enregistres avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de l'enregistrement des niveaux de notation",
        400,
        error as Error,
      );
    }
  }

  private async updateLevel(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);
      const existing = await this.prisma.gradingScaleLevel.findFirst({
        where: {
          id: req.params.levelId,
          gradingScale: {
            etablissement_id: tenantId,
            annee_scolaire_id: activeYear.id,
          },
        },
        include: {
          gradingScale: true,
        },
      });

      if (!existing) {
        throw new Error("Niveau de notation introuvable pour cet etablissement.");
      }

      const data = this.normalizeLevelPayload(req.body);
      const duplicate = await this.prisma.gradingScaleLevel.findFirst({
        where: {
          id: { not: existing.id },
          grading_scale_id: existing.grading_scale_id,
          code: data.code,
        },
        select: { id: true },
      });

      if (duplicate) {
        throw new Error("Un niveau avec ce code existe deja dans cette echelle.");
      }

      const result = await this.prisma.gradingScaleLevel.update({
        where: { id: existing.id },
        data: {
          code: data.code,
          label: data.label,
          numeric_value: data.numeric_value,
          min_value: data.min_value,
          max_value: data.max_value,
          display_order: data.display_order,
          color: data.color,
          is_success_level: data.is_success_level,
          is_active: data.is_active,
        },
      });

      Response.success(res, "Niveau de notation mis a jour avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la mise a jour du niveau de notation",
        400,
        error as Error,
      );
    }
  }

  private async deleteLevel(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);
      const existing = await this.prisma.gradingScaleLevel.findFirst({
        where: {
          id: req.params.levelId,
          gradingScale: {
            etablissement_id: tenantId,
            annee_scolaire_id: activeYear.id,
          },
        },
      });

      if (!existing) {
        throw new Error("Niveau de notation introuvable pour cet etablissement.");
      }

      const result = await this.prisma.gradingScaleLevel.delete({
        where: { id: existing.id },
      });
      Response.success(res, "Niveau de notation supprime avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la suppression du niveau de notation",
        400,
        error as Error,
      );
    }
  }
}

export default GradingScaleApp;
