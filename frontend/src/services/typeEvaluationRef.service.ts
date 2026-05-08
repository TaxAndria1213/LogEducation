import Service from "../app/api/Service";
import type { TypeEvaluation, TypeEvaluationRef } from "../types/models";

type QueryParams = Record<string, unknown>;

export type TypeEvaluationRefWithRelations = TypeEvaluationRef & {
  evaluations?: Array<{ id: string }>;
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

export function getTypeEvaluationCodeLabel(type?: TypeEvaluation | string | null) {
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

class TypeEvaluationRefService extends Service {
  constructor() {
    super("type-evaluation-ref");
  }

  async getForEtablissement(etablissementId: string, params: QueryParams = {}) {
    const scopedWhere = this.buildScopedWhere(etablissementId, params.where);

    return this.getAll({
      ...params,
      where: JSON.stringify(scopedWhere),
      orderBy:
        typeof params.orderBy === "string"
          ? params.orderBy
          : JSON.stringify(
              params.orderBy ?? [{ is_active: "desc" }, { code: "asc" }, { nom: "asc" }],
            ),
    } as Record<string, string | number | Date | boolean>);
  }

  private buildScopedWhere(etablissementId: string, whereParam?: unknown) {
    const parsedWhere = parseObjectParam(whereParam);

    if (!parsedWhere || Object.keys(parsedWhere).length === 0) {
      return { etablissement_id: etablissementId };
    }

    return {
      AND: [parsedWhere, { etablissement_id: etablissementId }],
    };
  }
}

export default TypeEvaluationRefService;
