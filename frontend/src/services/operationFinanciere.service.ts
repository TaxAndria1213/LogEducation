import Service from "../app/api/Service";
import type { Facture, Paiement, Utilisateur } from "../types/models";

type QueryParams = Record<string, unknown>;

export type OperationFinanciereWithRelations = {
  id: string;
  etablissement_id: string;
  facture_id?: string | null;
  paiement_id?: string | null;
  cree_par_utilisateur_id?: string | null;
  type: string;
  montant?: number | string | null;
  motif?: string | null;
  details_json?: Record<string, unknown> | null;
  created_at?: string | Date;
  updated_at?: string | Date;
  facture?: (Facture & {
    eleve?: {
      code_eleve?: string | null;
      utilisateur?: {
        profil?: {
          prenom?: string | null;
          nom?: string | null;
        } | null;
      } | null;
    } | null;
  }) | null;
  paiement?: Pick<Paiement, "id" | "reference" | "methode" | "montant" | "paye_le"> | null;
  createur?: (Utilisateur & {
    profil?: {
      prenom?: string | null;
      nom?: string | null;
    } | null;
  }) | null;
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

export function getOperationFinanciereTypeLabel(type?: string | null) {
  switch ((type ?? "").toUpperCase()) {
    case "ANNULATION_FACTURE":
      return "Annulation facture";
    case "AVOIR_FACTURE":
      return "Creation avoir";
    case "ANNULATION_PAIEMENT":
      return "Annulation paiement";
    case "REMBOURSEMENT_PAIEMENT":
      return "Remboursement paiement";
    case "SUPPRESSION_PAIEMENT":
      return "Suppression paiement";
    default:
      return type?.replace(/_/g, " ") ?? "Operation";
  }
}

export function getOperationFinanciereActorLabel(
  record?: Partial<OperationFinanciereWithRelations> | null,
) {
  const prenom = record?.createur?.profil?.prenom?.trim() ?? "";
  const nom = record?.createur?.profil?.nom?.trim() ?? "";
  return [prenom, nom].filter(Boolean).join(" ").trim() || record?.createur?.email?.trim() || "Systeme";
}

export function getOperationFinanciereTargetLabel(
  record?: Partial<OperationFinanciereWithRelations> | null,
) {
  const facture = record?.facture?.numero_facture?.trim();
  const paiement = record?.paiement?.reference?.trim();
  if (facture && paiement) return `${facture} / ${paiement}`;
  if (facture) return facture;
  if (paiement) return paiement;
  return "Sans cible";
}

class OperationFinanciereService extends Service {
  constructor() {
    super("operation-financiere");
  }

  async getForEtablissement(etablissementId: string, params: QueryParams = {}) {
    const scopedWhere = this.buildScopedWhere(etablissementId, params.where);
    return this.getAll({
      ...params,
      where: JSON.stringify(scopedWhere),
      orderBy:
        typeof params.orderBy === "string"
          ? params.orderBy
          : JSON.stringify(params.orderBy ?? [{ created_at: "desc" }, { updated_at: "desc" }]),
    } as Record<string, string | number | Date | boolean>);
  }

  private buildScopedWhere(etablissementId: string, whereParam?: unknown) {
    const parsedWhere = parseObjectParam(whereParam);
    const scope = { etablissement_id: etablissementId };
    if (!parsedWhere || Object.keys(parsedWhere).length === 0) return scope;
    return { AND: [parsedWhere, scope] };
  }
}

export default OperationFinanciereService;
