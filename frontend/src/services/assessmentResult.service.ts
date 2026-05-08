import Service from "../app/api/Service";
import { Http } from "../app/api/Http";
import type { EvaluationWithRelations } from "./evaluation.service";
import type { EleveWithRelations } from "./note.service";

type AssessmentResultStatus =
  | "GRADED"
  | "JUSTIFIED_ABSENCE"
  | "UNJUSTIFIED_ABSENCE"
  | "EXEMPTED"
  | "NOT_SUBMITTED"
  | "NOT_EVALUATED";

export type AssessmentResultInput = {
  assessment_id: string;
  student_id: string;
  raw_score?: number | null;
  scale_level_id?: string | null;
  text_value?: string | null;
  status?: AssessmentResultStatus;
  observation?: string | null;
  is_validated?: boolean;
  validated_at?: Date | null;
};

export type AssessmentResultWithRelations = {
  id: string;
  assessment_id: string;
  student_id: string;
  raw_score?: number | null;
  max_score?: number | null;
  normalized_score?: number | null;
  scale_level_id?: string | null;
  text_value?: string | null;
  display_value?: string | null;
  status: AssessmentResultStatus;
  observation?: string | null;
  is_validated: boolean;
  validated_at?: Date | null;
  validated_by?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  assessment?: EvaluationWithRelations | null;
  student?: EleveWithRelations | null;
  scaleLevel?: {
    id: string;
    code: string;
    label: string;
    numeric_value?: number | null;
    color?: string | null;
  } | null;
  history?: Array<{
    id: string;
    changed_at: Date | string;
    old_display_value?: string | null;
    new_display_value?: string | null;
    old_status?: string | null;
    new_status?: string | null;
    changed_by?: string | null;
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

export function getAssessmentResultDisplayLabel(
  result?: Partial<AssessmentResultWithRelations> | null,
) {
  if (!result) return "Resultat non renseigne";
  if (result.display_value?.trim()) return result.display_value.trim();
  if (result.scaleLevel?.label?.trim()) return result.scaleLevel.label.trim();
  if (result.scaleLevel?.code?.trim()) return result.scaleLevel.code.trim();
  if (
    typeof result.raw_score === "number" &&
    typeof result.max_score === "number" &&
    result.max_score > 0
  ) {
    return `${result.raw_score}/${result.max_score}`;
  }
  return result.status ?? "Resultat";
}

export function getAssessmentResultPercentage(
  result?: Partial<AssessmentResultWithRelations> | null,
) {
  if (!result) return null;

  if (
    typeof result.raw_score === "number" &&
    typeof result.max_score === "number" &&
    result.max_score > 0
  ) {
    return Math.round((result.raw_score / result.max_score) * 1000) / 10;
  }

  if (typeof result.normalized_score === "number") {
    return Math.round((result.normalized_score / 20) * 1000) / 10;
  }

  return null;
}

export function getAssessmentResultStatusLabel(status?: string | null) {
  switch (status) {
    case "JUSTIFIED_ABSENCE":
      return "Absence justifiee";
    case "UNJUSTIFIED_ABSENCE":
      return "Absence non justifiee";
    case "EXEMPTED":
      return "Dispense";
    case "NOT_SUBMITTED":
      return "Non rendu";
    case "NOT_EVALUATED":
      return "Non evalue";
    default:
      return "Note";
  }
}

class AssessmentResultService extends Service {
  constructor() {
    super("assessment-result");
  }

  async getForEtablissement(etablissementId: string, params: Record<string, unknown> = {}) {
    const scopedWhere = this.buildScopedWhere(etablissementId, params.where);

    return this.getAll({
      ...params,
      where: JSON.stringify(scopedWhere),
      orderBy:
        typeof params.orderBy === "string"
          ? params.orderBy
          : JSON.stringify(params.orderBy ?? [{ updated_at: "desc" }, { created_at: "desc" }]),
    } as Record<string, string | number | Date | boolean>);
  }

  async getHistory(id: string) {
    return Http.get(`/api/${this.url}/${id}/history`, {});
  }

  async validate(id: string) {
    return Http.post(`/api/${this.url}/${id}/validate`, {});
  }

  private buildScopedWhere(etablissementId: string, whereParam?: unknown) {
    const parsedWhere = parseObjectParam(whereParam);

    const scope = {
      student: {
        etablissement_id: etablissementId,
      },
    };

    if (!parsedWhere || Object.keys(parsedWhere).length === 0) {
      return scope;
    }

    return {
      AND: [parsedWhere, scope],
    };
  }
}

export default AssessmentResultService;
