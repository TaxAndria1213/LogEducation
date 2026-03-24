import Service from "../app/api/Service";
import type { Remise } from "../types/models";

type QueryParams = Record<string, unknown>;

export type RemiseWithRelations = Remise;

function parseObjectParam(value: unknown): Record<string, unknown> | undefined {
  if (!value) return undefined;
  if (typeof value === "object") return value as Record<string, unknown>;
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

export function getRemiseTypeLabel(type?: string | null) {
  switch ((type ?? "").toUpperCase()) {
    case "PERCENT":
      return "Pourcentage";
    case "FIXED":
      return "Montant fixe";
    default:
      return type ?? "Type non renseigne";
  }
}

export function getRemiseDisplayLabel(record?: Partial<RemiseWithRelations> | null) {
  if (!record) return "Remise non renseignee";
  return record.nom?.trim() || "Remise non renseignee";
}

export function getRemiseSecondaryLabel(record?: Partial<RemiseWithRelations> | null) {
  if (!record) return "";
  const type = getRemiseTypeLabel(record.type);
  const valeur =
    typeof record.valeur === "number"
      ? record.valeur
      : typeof record.valeur === "string"
        ? Number(record.valeur)
        : null;
  const valueLabel =
    valeur !== null && Number.isFinite(valeur)
      ? record.type?.toUpperCase() === "PERCENT"
        ? `${valeur}%`
        : `${valeur.toLocaleString("fr-FR")}`
      : "";
  return [type, valueLabel].filter(Boolean).join(" • ");
}

class RemiseService extends Service {
  constructor() {
    super("remise");
  }

  async getForEtablissement(etablissementId: string, params: QueryParams = {}) {
    const scopedWhere = this.buildScopedWhere(etablissementId, params.where);
    return this.getAll({
      ...params,
      where: JSON.stringify(scopedWhere),
      orderBy:
        typeof params.orderBy === "string"
          ? params.orderBy
          : JSON.stringify(params.orderBy ?? [{ nom: "asc" }, { created_at: "desc" }]),
    } as Record<string, string | number | Date | boolean>);
  }

  private buildScopedWhere(etablissementId: string, whereParam?: unknown) {
    const parsedWhere = parseObjectParam(whereParam);
    const scope = { etablissement_id: etablissementId };
    if (!parsedWhere || Object.keys(parsedWhere).length === 0) return scope;
    return { AND: [parsedWhere, scope] };
  }
}

export default RemiseService;
