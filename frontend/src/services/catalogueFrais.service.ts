import Service from "../app/api/Service";
import { Http } from "../app/api/Http";
import type { CatalogueFrais } from "../types/models";

type QueryParams = Record<string, unknown>;

export type CatalogueFraisWithRelations = CatalogueFrais & {
  niveau?: {
    id: string;
    nom?: string | null;
  } | null;
  approbateur?: {
    id: string;
    email?: string | null;
  } | null;
  _count?: {
    lignesFacture?: number;
  };
};

type CataloguePaymentPlan = {
  code?: string | null;
  label?: string | null;
  nombre_tranches?: number | null;
  offsets_mois?: number[] | null;
};

function getUsageScopeLabel(scope?: string | null) {
  switch ((scope ?? "GENERAL").toUpperCase()) {
    case "INSCRIPTION":
      return "Inscription";
    case "SCOLARITE":
      return "Scolarite";
    case "TRANSPORT":
      return "Transport";
    case "CANTINE":
      return "Cantine";
    case "OPTION_PEDAGOGIQUE":
      return "Option pedagogique";
    case "ACTIVITE_EXTRASCOLAIRE":
      return "Activite extrascolaire";
    case "FOURNITURE":
      return "Fourniture";
    case "UNIFORME":
      return "Uniforme";
    case "BADGE":
      return "Badge";
    case "EXAMEN":
      return "Examen";
    case "RATTRAPAGE":
      return "Rattrapage";
    case "COMPLEMENTAIRE":
      return "Complementaire";
    default:
      return "General";
  }
}

function getValidationStatusLabel(status?: string | null) {
  switch ((status ?? "").toUpperCase()) {
    case "APPROUVEE":
      return "Approuve";
    case "REJETEE":
      return "Rejete";
    default:
      return "En attente";
  }
}

function getBillingModeLabel(mode?: string | null) {
  switch ((mode ?? "").toUpperCase()) {
    case "ANNUEL":
      return "Annuel";
    case "RECURRENT":
      return "Recurrent";
    default:
      return "Ponctuel";
  }
}

function getDefaultAnnualPlanSummary(record?: Partial<CatalogueFraisWithRelations> | null) {
  const plans = Array.isArray(record?.plans_paiement_autorises_json)
    ? (record?.plans_paiement_autorises_json as CataloguePaymentPlan[])
    : [];
  const defaultCode =
    typeof record?.plan_paiement_defaut_code === "string"
      ? record.plan_paiement_defaut_code.trim().toUpperCase()
      : "";
  const selectedPlan = plans.find(
    (plan) => (plan.code ?? "").trim().toUpperCase() === defaultCode,
  );

  if (!selectedPlan) return null;
  const count = Number(selectedPlan.nombre_tranches ?? 0);
  if (!Number.isFinite(count) || count <= 0) return selectedPlan.label ?? null;
  return `${selectedPlan.label ?? selectedPlan.code ?? "Plan annuel"} - ${count} tranche${count > 1 ? "s" : ""}`;
}

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

export function isApprovedCatalogueFrais(record?: Partial<CatalogueFraisWithRelations> | null) {
  return (record?.statut_validation ?? "").toUpperCase() === "APPROUVEE";
}

export function getCatalogueFraisDisplayLabel(record?: Partial<CatalogueFraisWithRelations> | null) {
  if (!record) return "Frais non renseigne";
  return record.nom?.trim() || "Frais non renseigne";
}

export function getCatalogueFraisSecondaryLabel(record?: Partial<CatalogueFraisWithRelations> | null) {
  if (!record) return "";
  const amount =
    typeof record.montant === "number"
      ? record.montant
      : typeof record.montant === "string"
        ? Number(record.montant)
        : null;
  const amountLabel =
    amount !== null && Number.isFinite(amount)
      ? `${amount.toLocaleString("fr-FR")} ${record.devise ?? "MGA"}`
      : record.devise ?? "MGA";

  return [
    record.niveau?.nom ? `Niveau: ${record.niveau.nom}` : "Global - toutes classes",
    `Usage: ${getUsageScopeLabel(record.usage_scope)}`,
    amountLabel,
    `Validation: ${getValidationStatusLabel(record.statut_validation)}`,
    `Facturation: ${getBillingModeLabel(record.mode_facturation)}`,
    record.mode_facturation?.toUpperCase() === "ANNUEL"
      ? getDefaultAnnualPlanSummary(record)
      : record.est_recurrent
        ? `Recurrent${
            record.periodicite
              ? ` - ${record.periodicite === "semester" ? "semester" : record.periodicite}`
              : ""
          }`
        : "Ponctuel",
    record.prorata_eligible ? "Prorata actif" : null,
  ]
    .filter(Boolean)
    .join(" - ");
}

class CatalogueFraisService extends Service {
  constructor() {
    super("catalogue-frais");
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

  async approve(id: string) {
    return Http.post(`/api/${this.url}/${id}/approve`, {});
  }

  async reject(id: string, motif?: string) {
    return Http.post(`/api/${this.url}/${id}/reject`, { motif: motif ?? null });
  }

  private buildScopedWhere(etablissementId: string, whereParam?: unknown) {
    const parsedWhere = parseObjectParam(whereParam);
    const scope = { etablissement_id: etablissementId };
    if (!parsedWhere || Object.keys(parsedWhere).length === 0) return scope;
    return { AND: [parsedWhere, scope] };
  }
}

export default CatalogueFraisService;
