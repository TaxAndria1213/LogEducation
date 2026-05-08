import Service from "../app/api/Service";
import { Http } from "../app/api/Http";
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
  gradingScale?: {
    id: string;
    nom: string;
    grading_type: string;
    base_score?: number | null;
    levels?: Array<{
      id: string;
      code: string;
      label: string;
      color?: string | null;
      numeric_value?: number | null;
    }>;
  } | null;
  createur?: EnseignantWithRelations | null;
  notes?: Array<{ id: string; score?: number | null }>;
  assessmentResults?: Array<{
    id: string;
    student_id?: string | null;
    is_validated?: boolean;
  }>;
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

export function getEvaluationWorkflowStatusLabel(status?: string | null) {
  switch (status) {
    case "VALIDATED":
      return "Validee";
    case "LOCKED":
      return "Verrouillee";
    case "ARCHIVED":
      return "Archivee";
    case "RESULTS_ENTERED":
      return "Resultats saisis";
    case "PUBLISHED":
      return "Publiee";
    default:
      return "Brouillon";
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

  async updateDisplaySettings(
    id: string,
    payload: {
      include_in_average?: boolean;
      show_in_report_card?: boolean;
      is_final_exam?: boolean;
    },
  ) {
    return Http.put(["/api", this.url, id, "display-settings"].join("/"), payload);
  }

  async validateResults(id: string) {
    return Http.post(["/api", this.url, id, "results", "validate"].join("/"), {});
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
