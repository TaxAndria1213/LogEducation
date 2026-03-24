import Service from "../app/api/Service";
import type { Facture, Paiement } from "../types/models";
import {
  getFactureDisplayLabel,
  getFactureSecondaryLabel,
  getFactureStatusLabel,
} from "./facture.service";

type QueryParams = Record<string, unknown>;

export type PaiementWithRelations = Paiement & {
  facture?: (Facture & {
    eleve?: {
      id: string;
      code_eleve?: string | null;
      utilisateur?: {
        profil?: {
          prenom?: string | null;
          nom?: string | null;
        } | null;
      } | null;
    } | null;
    annee?: {
      id: string;
      nom?: string | null;
    } | null;
    echeances?: Array<{
      id: string;
      ordre: number;
      libelle?: string | null;
      date_echeance: string | Date;
      montant_prevu: number;
      montant_regle: number;
      montant_restant: number;
      statut: string;
      devise?: string | null;
    }> | null;
  }) | null;
  affectations?: Array<{
    id: string;
    montant: number;
    echeance?: {
      id: string;
      ordre: number;
      libelle?: string | null;
      date_echeance: string | Date;
      statut: string;
    } | null;
  }> | null;
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

export function getPaiementDisplayLabel(record?: Partial<PaiementWithRelations> | null) {
  if (!record) return "Paiement non renseigne";
  return record.reference?.trim() || getFactureDisplayLabel(record.facture) || "Paiement";
}

export function getPaiementSecondaryLabel(record?: Partial<PaiementWithRelations> | null) {
  if (!record) return "";
  const factureLabel = record.facture ? getFactureDisplayLabel(record.facture) : "";
  const eleveLabel = record.facture ? getFactureSecondaryLabel(record.facture) : "";
  const statut = record.facture ? getFactureStatusLabel(record.facture.statut) : "";
  return [factureLabel, eleveLabel, statut].filter(Boolean).join(" - ");
}

class PaiementService extends Service {
  constructor() {
    super("paiement");
  }

  async getForEtablissement(etablissementId: string, params: QueryParams = {}) {
    const scopedWhere = this.buildScopedWhere(etablissementId, params.where);
    return this.getAll({
      ...params,
      where: JSON.stringify(scopedWhere),
      orderBy:
        typeof params.orderBy === "string"
          ? params.orderBy
          : JSON.stringify(params.orderBy ?? [{ paye_le: "desc" }, { created_at: "desc" }]),
    } as Record<string, string | number | Date | boolean>);
  }

  private buildScopedWhere(etablissementId: string, whereParam?: unknown) {
    const parsedWhere = parseObjectParam(whereParam);
    const scope = { facture: { is: { etablissement_id: etablissementId } } };
    if (!parsedWhere || Object.keys(parsedWhere).length === 0) return scope;
    return { AND: [parsedWhere, scope] };
  }
}

export default PaiementService;
