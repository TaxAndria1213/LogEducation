import Service from "../app/api/Service";
import type { FormuleCantine } from "../types/models";

type QueryParams = Record<string, unknown>;

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

export function getFormuleCantineDisplayLabel(record?: Partial<FormuleCantine> | null) {
  if (!record) return "Formule non renseignee";
  return record.nom?.trim() || "Formule non renseignee";
}

export function getFormuleCantineTypeLabel(type?: string | null) {
  switch ((type ?? "AUTRE").toUpperCase()) {
    case "FORFAIT":
      return "Forfait";
    case "REPAS_UNITAIRE":
      return "Repas unitaire";
    case "ABONNEMENT":
      return "Abonnement";
    default:
      return "Autre";
  }
}

export function getCantineAbsenceRegularizationModeLabel(mode?: string | null) {
  switch ((mode ?? "AVOIR").toUpperCase()) {
    case "REPORT":
      return "Report";
    case "REMBOURSEMENT":
      return "Remboursement";
    case "AJUSTEMENT":
      return "Ajustement";
    case "REFUS_REGULARISATION":
      return "Refus de regularisation";
    default:
      return "Avoir";
  }
}

export function getCantineDailyMealLimitLabel(limit?: number | null) {
  const normalized = Number(limit ?? 0);
  if (!Number.isFinite(normalized) || normalized <= 1) return "1 repas par jour";
  return `${normalized.toLocaleString("fr-FR")} repas par jour`;
}

class FormuleCantineService extends Service {
  constructor() {
    super("formule-cantine");
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

export default FormuleCantineService;
