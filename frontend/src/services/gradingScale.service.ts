import Service from "../app/api/Service";
import type { GradingScale, GradingType } from "../types/models";

type QueryParams = Record<string, unknown>;

export type GradingScaleWithRelations = GradingScale & {
  levels?: Array<{
    id: string;
    code: string;
    label: string;
    numeric_value?: number | null;
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

export function getGradingTypeLabel(type?: GradingType | string | null) {
  switch (type) {
    case "LETTER":
      return "Lettres";
    case "LEVEL":
      return "Niveaux";
    case "DESCRIPTIVE":
      return "Descriptif";
    case "PERCENTAGE":
      return "Pourcentage";
    case "VALIDATION":
      return "Validation";
    default:
      return "Points";
  }
}

export function getGradingScaleDisplayLabel(scale?: Partial<GradingScaleWithRelations> | null) {
  if (!scale) return "Echelle de notation";
  const nom = scale.nom?.trim() ?? "";
  const type = getGradingTypeLabel(scale.grading_type);
  const base =
    typeof scale.base_score === "number" && Number.isFinite(scale.base_score)
      ? `/ ${scale.base_score}`
      : "";

  if (nom) return `${nom} (${type}${base ? ` ${base}` : ""})`;
  return `${type}${base ? ` ${base}` : ""}`;
}

class GradingScaleService extends Service {
  constructor() {
    super("grading-scale");
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
              params.orderBy ?? [{ is_default: "desc" }, { nom: "asc" }],
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

export default GradingScaleService;
