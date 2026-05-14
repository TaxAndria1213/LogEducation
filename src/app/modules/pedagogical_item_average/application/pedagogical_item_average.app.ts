import {
  Application,
  NextFunction,
  Request,
  Response as R,
  Router,
} from "express";
import {
  ReportAverageCalculationMode,
  type PedagogicalItemAverage,
  type PrismaClient,
} from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import { prisma } from "../../../service/prisma";
import PedagogicalItemAverageModel from "../models/pedagogical_item_average.model";
import ReportCalculationService from "./report_calculation.service";
import { getRequiredActiveAcademicYear } from "../../pedagogie_shared/utils/academicScope";

type CalculationPayload = {
  classe_id?: string;
  periode_id?: string;
  calculation_mode?: ReportAverageCalculationMode;
  rounding_precision?: number;
  base_score?: number | null;
  include_code_grades_in_general_average?: boolean;
  exclude_non_evaluated_items?: boolean;
  minimum_required_results?: number;
  use_weights?: boolean;
  use_coefficients?: boolean;
};

class PedagogicalItemAverageApp {
  public app: Application;
  public router: Router;
  private pedagogicalItemAverage: PedagogicalItemAverageModel;
  private prisma: PrismaClient;
  private reportCalculationService: ReportCalculationService;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.pedagogicalItemAverage = new PedagogicalItemAverageModel();
    this.prisma = prisma;
    this.reportCalculationService = new ReportCalculationService(this.prisma);
    this.routes();
  }

  public routes(): Router {
    this.router.post("/calculate", this.calculate.bind(this));
    this.router.get("/", this.getAll.bind(this));
    this.router.get(
      "/classes/:classId/periodes/:periodeId",
      this.getForClassPeriod.bind(this),
    );
    return this.router;
  }

  private resolveTenantId(req: Request): string {
    const requestTenant = (req as Request & { tenantId?: string }).tenantId;
    const queryWhere = parseJSON<Record<string, unknown>>(req.query.where, {});
    const queryTenant =
      typeof queryWhere?.classe === "object" &&
      queryWhere.classe !== null &&
      typeof (queryWhere.classe as { etablissement_id?: unknown }).etablissement_id ===
        "string"
        ? ((queryWhere.classe as { etablissement_id: string }).etablissement_id).trim()
        : undefined;

    const bodyTenant =
      typeof req.body?.etablissement_id === "string"
        ? req.body.etablissement_id.trim()
        : undefined;

    const tenantCandidates = [requestTenant, queryTenant, bodyTenant].filter(
      (value): value is string => Boolean(value),
    );

    if (tenantCandidates.length === 0) {
      throw new Error("Aucun etablissement actif n'a ete fourni.");
    }

    if (new Set(tenantCandidates).size > 1) {
      throw new Error("Conflit d'etablissement detecte pour les moyennes pedagogiques.");
    }

    return tenantCandidates[0];
  }

  private normalizeCalculationPayload(raw: CalculationPayload) {
    const classeId =
      typeof raw.classe_id === "string" && raw.classe_id.trim()
        ? raw.classe_id.trim()
        : "";
    const periodeId =
      typeof raw.periode_id === "string" && raw.periode_id.trim()
        ? raw.periode_id.trim()
        : "";

    if (!classeId) {
      throw new Error("La classe est requise pour calculer les moyennes.");
    }

    if (!periodeId) {
      throw new Error("La periode est requise pour calculer les moyennes.");
    }

    const rawCalculationMode =
      typeof raw.calculation_mode === "string"
        ? raw.calculation_mode.trim().toUpperCase()
        : "HIERARCHICAL";
    const calculationMode = Object.values(ReportAverageCalculationMode).includes(
      rawCalculationMode as ReportAverageCalculationMode,
    )
      ? (rawCalculationMode as ReportAverageCalculationMode)
      : ReportAverageCalculationMode.HIERARCHICAL;

    const roundingPrecision =
      raw.rounding_precision === undefined || raw.rounding_precision === null
        ? undefined
        : Number(raw.rounding_precision);
    const baseScore =
      raw.base_score === undefined || raw.base_score === null
        ? null
        : Number(raw.base_score);
    const minimumRequiredResults =
      raw.minimum_required_results === undefined || raw.minimum_required_results === null
        ? undefined
        : Number(raw.minimum_required_results);

    if (
      roundingPrecision !== undefined &&
      (!Number.isFinite(roundingPrecision) || roundingPrecision < 0)
    ) {
      throw new Error("La precision d'arrondi doit etre un entier positif ou nul.");
    }

    if (baseScore !== null && (!Number.isFinite(baseScore) || baseScore <= 0)) {
      throw new Error("Le score de base doit etre un nombre positif.");
    }

    if (
      minimumRequiredResults !== undefined &&
      (!Number.isFinite(minimumRequiredResults) || minimumRequiredResults < 1)
    ) {
      throw new Error("Le nombre minimum de resultats doit etre superieur ou egal a 1.");
    }

    return {
      classeId,
      periodeId,
      calculationMode,
      roundingPrecision,
      baseScore,
      includeCodeGradesInGeneralAverage: Boolean(
        raw.include_code_grades_in_general_average,
      ),
      excludeNonEvaluatedItems:
        raw.exclude_non_evaluated_items === undefined
          ? undefined
          : Boolean(raw.exclude_non_evaluated_items),
      minimumRequiredResults,
      useWeights:
        raw.use_weights === undefined ? undefined : Boolean(raw.use_weights),
      useCoefficients:
        raw.use_coefficients === undefined
          ? undefined
          : Boolean(raw.use_coefficients),
    };
  }

  private buildScopedWhere(
    existingWhere: Record<string, unknown>,
    tenantId: string,
    activeYearId: string,
  ) {
    const scope = {
      etablissement_id: tenantId,
      annee_scolaire_id: activeYearId,
    };

    if (!existingWhere || Object.keys(existingWhere).length === 0) {
      return scope;
    }

    return {
      AND: [existingWhere, scope],
    };
  }

  private getDetailInclude() {
    return {
      annee: true,
      periode: true,
      classe: {
        include: {
          niveau: true,
          site: true,
        },
      },
      eleve: {
        include: {
          utilisateur: {
            include: {
              profil: true,
            },
          },
        },
      },
      pedagogicalItem: {
        include: {
          matiere: true,
          parent: true,
        },
      },
    };
  }

  private async calculate(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const payload = this.normalizeCalculationPayload(req.body ?? {});
      const result = await this.reportCalculationService.calculateAndPersist({
        tenantId,
        classeId: payload.classeId,
        periodeId: payload.periodeId,
        calculationMode: payload.calculationMode,
        roundingPrecision: payload.roundingPrecision,
        baseScore: payload.baseScore,
        includeCodeGradesInGeneralAverage:
          payload.includeCodeGradesInGeneralAverage,
        excludeNonEvaluatedItems: payload.excludeNonEvaluatedItems,
        minimumRequiredResults: payload.minimumRequiredResults,
        useWeights: payload.useWeights,
        useCoefficients: payload.useCoefficients,
      });

      Response.success(res, "Moyennes calculees avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors du calcul des moyennes pedagogiques",
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
          JSON.stringify([
            { periode_id: "desc" },
            { classe_id: "asc" },
            { eleve_id: "asc" },
            { updated_at: "desc" },
          ]),
      };

      const result = await getAllPaginated(
        scopedQuery as typeof req.query,
        this.pedagogicalItemAverage,
      );

      Response.success(res, "Liste des moyennes pedagogiques recuperee.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation des moyennes pedagogiques",
        400,
        error as Error,
      );
    }
  }

  private async getForClassPeriod(
    req: Request,
    res: R,
    next: NextFunction,
  ): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);
      const eleveId =
        typeof req.query.eleve_id === "string" && req.query.eleve_id.trim()
          ? req.query.eleve_id.trim()
          : null;

      const result = await this.prisma.pedagogicalItemAverage.findMany({
        where: {
          etablissement_id: tenantId,
          annee_scolaire_id: activeYear.id,
          classe_id: req.params.classId,
          periode_id: req.params.periodeId,
          ...(eleveId ? { eleve_id: eleveId } : {}),
        },
        include: this.getDetailInclude(),
        orderBy: [
          { classe_id: "asc" },
          { eleve_id: "asc" },
          { pedagogicalItem: { display_order: "asc" } },
          { pedagogicalItem: { nom: "asc" } },
        ],
      });

      Response.success(
        res,
        "Moyennes pedagogiques de la classe et de la periode recuperees.",
        result,
      );
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation des moyennes pedagogiques",
        400,
        error as Error,
      );
    }
  }
}

export default PedagogicalItemAverageApp;
