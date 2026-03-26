import Service from "../app/api/Service";
import type { CatalogueFrais } from "../types/models";

type QueryParams = Record<string, unknown>;

export type CatalogueFraisWithRelations = CatalogueFrais & {
  niveau?: {
    id: string;
    nom?: string | null;
  } | null;
  _count?: {
    lignesFacture?: number;
  };
};

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
    amountLabel,
    record.est_recurrent ? `Recurrent${record.periodicite ? ` - ${record.periodicite}` : ""}` : "Ponctuel",
  ]
    .filter(Boolean)
    .join(" • ");
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

  private buildScopedWhere(etablissementId: string, whereParam?: unknown) {
    const parsedWhere = parseObjectParam(whereParam);
    const scope = { etablissement_id: etablissementId };
    if (!parsedWhere || Object.keys(parsedWhere).length === 0) return scope;
    return { AND: [parsedWhere, scope] };
  }
}

export default CatalogueFraisService;
