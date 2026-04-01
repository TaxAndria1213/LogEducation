import Service from "../app/api/Service";
import { Http } from "../app/api/Http";
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

function readRules(record?: Partial<RemiseWithRelations> | null) {
  if (!record?.regles_json || typeof record.regles_json !== "object" || Array.isArray(record.regles_json)) {
    return null;
  }
  return record.regles_json as Record<string, unknown>;
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

export function getRemiseCategoryLabel(record?: Partial<RemiseWithRelations> | null) {
  const category = readRules(record)?.nature_financiere;
  switch (typeof category === "string" ? category.trim().toUpperCase() : "") {
    case "EXONERATION_PARTIELLE":
      return "Exoneration partielle";
    case "EXONERATION_TOTALE":
      return "Exoneration totale";
    case "BOURSE":
      return "Bourse";
    case "PRISE_EN_CHARGE":
      return "Prise en charge";
    case "REMISE_EXCEPTIONNELLE":
      return "Remise exceptionnelle";
    default:
      return "Remise standard";
  }
}

export function getRemiseValidationStatusLabel(record?: Partial<RemiseWithRelations> | null) {
  const rules = readRules(record);
  const required = Boolean(rules?.validation_requise);
  const status = typeof rules?.statut_validation === "string" ? rules.statut_validation.trim().toUpperCase() : "";
  if (!required) return "Aucune validation";
  switch (status) {
    case "APPROUVEE":
      return "Approuvee";
    case "REFUSEE":
      return "Refusee";
    case "EN_ATTENTE":
    default:
      return "En attente";
  }
}

export function getRemiseDisplayLabel(record?: Partial<RemiseWithRelations> | null) {
  if (!record) return "Remise non renseignee";
  return record.nom?.trim() || "Remise non renseignee";
}

export function getRemiseSecondaryLabel(record?: Partial<RemiseWithRelations> | null) {
  if (!record) return "";
  const type = getRemiseTypeLabel(record.type);
  const category = getRemiseCategoryLabel(record);
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
  return [category, type, valueLabel].filter(Boolean).join(" - ");
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

  async approve(id: string, payload: { motif?: string | null } = {}) {
    return Http.post(["/api", this.url, id, "approve"].join("/"), payload);
  }

  async reject(id: string, payload: { motif?: string | null } = {}) {
    return Http.post(["/api", this.url, id, "reject"].join("/"), payload);
  }

  private buildScopedWhere(etablissementId: string, whereParam?: unknown) {
    const parsedWhere = parseObjectParam(whereParam);
    const scope = { etablissement_id: etablissementId };
    if (!parsedWhere || Object.keys(parsedWhere).length === 0) return scope;
    return { AND: [parsedWhere, scope] };
  }
}

export default RemiseService;
