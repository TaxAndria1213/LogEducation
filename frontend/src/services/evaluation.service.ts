import Service from "../app/api/Service";
import type {
  Evaluation,
  Periode,
  TypeEvaluation,
  TypeEvaluationRef,
} from "../types/models";
import type { CoursWithRelations, EnseignantWithRelations } from "./cours.service";
import { getCoursDisplayLabel, getTeacherDisplayLabel } from "./cours.service";

type QueryParams = Record<string, unknown>;

export type EvaluationWithRelations = Evaluation & {
  cours?: CoursWithRelations | null;
  periode?: Pick<Periode, "id" | "nom" | "date_debut" | "date_fin" | "ordre"> | null;
  typeRef?: Pick<TypeEvaluationRef, "id" | "nom" | "poids_defaut"> | null;
  createur?: EnseignantWithRelations | null;
  notes?: Array<{ id: string; score?: number | null }>;
};

function parseObjectParam(value: unknown): Record<string, unknown> | undefined {
  if (!value) return undefined;

  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      return typeof parsed === "object" && parsed !== null ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export function getEvaluationTypeLabel(type?: TypeEvaluation | string | null) {
  switch (type) {
    case "DEVOIR":
      return "Devoir";
    case "EXAMEN":
      return "Examen";
    case "ORAL":
      return "Oral";
    default:
      return "Autre";
  }
}

export function getEvaluationDisplayLabel(
  evaluation?: Partial<EvaluationWithRelations> | null,
) {
  if (!evaluation) return "Evaluation sans titre";

  const titre = evaluation.titre?.trim() ?? "";
  const type = getEvaluationTypeLabel(evaluation.type);

  return titre ? `${titre} (${type})` : `Evaluation ${type.toLowerCase()}`;
}

export function getEvaluationSecondaryLabel(
  evaluation?: Partial<EvaluationWithRelations> | null,
) {
  if (!evaluation) return "";

  const cours = getCoursDisplayLabel(evaluation.cours);
  const periode = evaluation.periode?.nom?.trim() ?? "";
  const createur = getTeacherDisplayLabel(evaluation.createur);

  return [cours, periode, createur].filter(Boolean).join(" • ");
}

class EvaluationService extends Service {
  constructor() {
    super("evaluation");
  }

  async getForEtablissement(
    etablissementId: string,
    params: QueryParams = {},
  ) {
    const scopedWhere = this.buildScopedWhere(etablissementId, params.where);

    return this.getAll({
      ...params,
      where: JSON.stringify(scopedWhere),
      orderBy:
        typeof params.orderBy === "string"
          ? params.orderBy
          : JSON.stringify(params.orderBy ?? [{ date: "desc" }, { created_at: "desc" }]),
    } as Record<string, string | number | Date | boolean>);
  }

  private buildScopedWhere(etablissementId: string, whereParam?: unknown) {
    const parsedWhere = parseObjectParam(whereParam);

    if (!parsedWhere || Object.keys(parsedWhere).length === 0) {
      return {
        cours: {
          etablissement_id: etablissementId,
        },
      };
    }

    return {
      AND: [
        parsedWhere,
        {
          cours: {
            etablissement_id: etablissementId,
          },
        },
      ],
    };
  }
}

export default EvaluationService;
