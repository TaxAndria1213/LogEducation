import { Application, NextFunction, Request, Response as R, Router } from "express";
import { PrismaClient, TypeEvaluation, type TypeEvaluationRef } from "@prisma/client";
import Response from "../../../common/app/response";
import TypeEvaluationRefModel from "../models/type_evaluation_ref.model";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import { prisma } from "../../../service/prisma";

type TypeEvaluationRefPayload = Pick<
  TypeEvaluationRef,
  | "etablissement_id"
  | "code"
  | "nom"
  | "poids_defaut"
  | "default_max_score"
  | "include_in_average"
  | "show_in_report_card"
  | "is_final_exam"
  | "is_active"
>;

const TYPE_EVALUATION_VALUES: TypeEvaluation[] = ["DEVOIR", "EXAMEN", "ORAL", "AUTRE"];

class TypeEvaluationRefApp {
  public app: Application;
  public router: Router;
  private typeEvaluationRef: TypeEvaluationRefModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.typeEvaluationRef = new TypeEvaluationRefModel();
    this.prisma = prisma;
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
      throw new Error("Conflit d'etablissement detecte pour le type d'evaluation.");
    }

    return tenantCandidates[0];
  }

  private normalizeNumber(value: unknown, fieldLabel: string): number | null {
    if (value === undefined || value === null || value === "") {
      return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`${fieldLabel} doit etre superieur a 0.`);
    }

    return parsed;
  }

  private normalizePayload(
    raw: Partial<TypeEvaluationRef>,
    tenantId: string,
  ): TypeEvaluationRefPayload {
    const normalizedName =
      typeof raw.nom === "string" ? raw.nom.trim().replace(/\s+/g, " ") : "";

    if (!normalizedName) {
      throw new Error("Le nom du type d'evaluation est requis.");
    }

    const normalizedCode =
      typeof raw.code === "string" ? raw.code.trim().toUpperCase() : String(raw.code ?? "").trim().toUpperCase();

    if (!TYPE_EVALUATION_VALUES.includes(normalizedCode as TypeEvaluation)) {
      throw new Error("Le code du type d'evaluation est invalide.");
    }

    return {
      etablissement_id: tenantId,
      code: normalizedCode as TypeEvaluation,
      nom: normalizedName,
      poids_defaut: this.normalizeNumber(raw.poids_defaut, "Le poids par defaut"),
      default_max_score: this.normalizeNumber(
        raw.default_max_score,
        "La note maximale par defaut",
      ),
      include_in_average:
        typeof raw.include_in_average === "boolean" ? raw.include_in_average : true,
      show_in_report_card:
        typeof raw.show_in_report_card === "boolean" ? raw.show_in_report_card : false,
      is_final_exam: typeof raw.is_final_exam === "boolean" ? raw.is_final_exam : false,
      is_active: typeof raw.is_active === "boolean" ? raw.is_active : true,
    };
  }

  private async ensureUniqueType(
    data: TypeEvaluationRefPayload,
    excludeId?: string,
  ): Promise<void> {
    const baseWhere = excludeId ? { id: { not: excludeId } } : {};

    const duplicateByCode = await this.prisma.typeEvaluationRef.findFirst({
      where: {
        ...baseWhere,
        etablissement_id: data.etablissement_id,
        code: data.code,
      },
      select: { id: true },
    });

    if (duplicateByCode) {
      throw new Error("Un type d'evaluation avec ce code existe deja.");
    }

    const duplicateByName = await this.prisma.typeEvaluationRef.findFirst({
      where: {
        ...baseWhere,
        etablissement_id: data.etablissement_id,
        nom: data.nom,
      },
      select: { id: true },
    });

    if (duplicateByName) {
      throw new Error("Un type d'evaluation avec ce nom existe deja.");
    }
  }

  private async getScopedType(id: string, tenantId: string) {
    return this.prisma.typeEvaluationRef.findFirst({
      where: {
        id,
        etablissement_id: tenantId,
      },
    });
  }

  private buildScopedWhere(
    existingWhere: Record<string, unknown>,
    tenantId: string,
  ): Record<string, unknown> {
    if (!existingWhere || Object.keys(existingWhere).length === 0) {
      return { etablissement_id: tenantId };
    }

    return {
      AND: [existingWhere, { etablissement_id: tenantId }],
    };
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const data = this.normalizePayload(req.body, tenantId);

      await this.ensureUniqueType(data);

      const result = await this.typeEvaluationRef.create(data);
      Response.success(res, "Type d'evaluation cree avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la creation du type d'evaluation",
        400,
        error as Error,
      );
    }
  }

  private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const where = parseJSON<Record<string, unknown>>(req.query.where, {});
      const scopedQuery = {
        ...req.query,
        where: JSON.stringify(this.buildScopedWhere(where, tenantId)),
        orderBy:
          req.query.orderBy ??
          JSON.stringify([{ is_active: "desc" }, { code: "asc" }, { nom: "asc" }]),
      };

      const result = await getAllPaginated(
        scopedQuery as typeof req.query,
        this.typeEvaluationRef,
      );
      Response.success(res, "Liste des types d'evaluation recuperee.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation des types d'evaluation",
        400,
        error as Error,
      );
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const id = req.params.id;
      const includeSpec = parseJSON<Record<string, unknown>>(req.query.includeSpec, {
        evaluations: true,
      });

      const result = await this.prisma.typeEvaluationRef.findFirst({
        where: {
          id,
          etablissement_id: tenantId,
        },
        include: includeSpec,
      });

      if (!result) {
        throw new Error("Type d'evaluation introuvable pour cet etablissement.");
      }

      Response.success(res, "Detail du type d'evaluation.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation du type d'evaluation",
        404,
        error as Error,
      );
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const id = req.params.id;

      const existing = await this.prisma.typeEvaluationRef.findFirst({
        where: {
          id,
          etablissement_id: tenantId,
        },
        include: {
          _count: {
            select: {
              evaluations: true,
            },
          },
        },
      });

      if (!existing) {
        throw new Error("Type d'evaluation introuvable pour cet etablissement.");
      }

      if (existing._count.evaluations > 0) {
        throw new Error(
          `Suppression impossible: ce type est encore utilise par ${existing._count.evaluations} evaluation(s).`,
        );
      }

      const result = await this.typeEvaluationRef.delete(id);
      Response.success(res, "Type d'evaluation supprime avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la suppression du type d'evaluation",
        400,
        error as Error,
      );
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const id = req.params.id;

      const existing = await this.getScopedType(id, tenantId);
      if (!existing) {
        throw new Error("Type d'evaluation introuvable pour cet etablissement.");
      }

      const data = this.normalizePayload(req.body, tenantId);
      await this.ensureUniqueType(data, id);

      const result = await this.typeEvaluationRef.update(id, data);
      Response.success(res, "Type d'evaluation mis a jour avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la mise a jour du type d'evaluation",
        400,
        error as Error,
      );
    }
  }
}

export default TypeEvaluationRefApp;
