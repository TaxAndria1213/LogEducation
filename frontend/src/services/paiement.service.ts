import Service from "../app/api/Service";
import { Http } from "../app/api/Http";
import type { Facture, Paiement } from "../types/models";
import {
  getFactureDisplayLabel,
  getFactureSecondaryLabel,
  getFactureStatusLabel,
} from "./facture.service";

type QueryParams = Record<string, unknown>;

export type PaiementWithRelations = Paiement & {
  statut?: string | null;
  facture?: (Facture & {
    etablissement?: {
      id: string;
      nom?: string | null;
      code?: string | null;
    } | null;
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
    operationsFinancieres?: Array<{
      id: string;
      type: string;
      montant?: number | string | null;
      motif?: string | null;
      created_at?: string | Date;
    }> | null;
  }) | null;
  affectations?: Array<{
    id: string;
    montant: number;
    echeance?: {
      id: string;
      plan_paiement_id?: string | null;
      ordre: number;
      libelle?: string | null;
      date_echeance: string | Date;
      statut: string;
    } | null;
  }> | null;
  operationsFinancieres?: Array<{
    id: string;
    type: string;
    montant?: number | string | null;
    motif?: string | null;
    created_at?: string | Date;
    details_json?: Record<string, unknown> | null;
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
  return (
    record.numero_recu?.trim() ||
    record.reference?.trim() ||
    getFactureDisplayLabel(record.facture) ||
    "Paiement"
  );
}

export function getPaiementSecondaryLabel(record?: Partial<PaiementWithRelations> | null) {
  if (!record) return "";
  const factureLabel = record.facture ? getFactureDisplayLabel(record.facture) : "";
  const eleveLabel = record.facture ? getFactureSecondaryLabel(record.facture) : "";
  const statut = record.facture ? getFactureStatusLabel(record.facture.statut) : "";
  return [factureLabel, eleveLabel, statut].filter(Boolean).join(" - ");
}

export function getPaiementStatusLabel(status?: string | null) {
  switch ((status ?? "ENREGISTRE").toUpperCase()) {
    case "ANNULE":
      return "Annule";
    case "REMBOURSE":
      return "Rembourse";
    case "ENREGISTRE":
    default:
      return "Enregistre";
  }
}

export function getPaiementMethodLabel(method?: string | null) {
  switch ((method ?? "").toLowerCase()) {
    case "cash":
      return "Comptant / caisse";
    case "mobile_money":
      return "Mobile money";
    case "virement":
      return "Virement";
    case "cheque":
      return "Cheque";
    case "bank":
      return "Banque";
    case "card":
      return "Carte bancaire";
    case "famille":
      return "Paiement famille";
    default:
      return method ?? "-";
  }
}

function readOperationDetails(
  value?: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value;
}

function toAmount(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function getPaiementReceiptStatusLabel(status?: string | null) {
  switch ((status ?? "ENREGISTRE").toUpperCase()) {
    case "ANNULE":
      return "Recu annule";
    case "REMBOURSE":
      return "Recu rembourse";
    case "ENREGISTRE":
    default:
      return "Recu valide";
  }
}

function getLatestOperation(
  record: Partial<PaiementWithRelations> | null | undefined,
  type: string,
) {
  return (record?.operationsFinancieres ?? []).find(
    (item) => (item.type ?? "").toUpperCase() === type.toUpperCase(),
  );
}

export function getPaiementSupportingDocument(record?: Partial<PaiementWithRelations> | null) {
  const operation = getLatestOperation(record, "ENREGISTREMENT_PAIEMENT");
  const details =
    operation?.details_json && typeof operation.details_json === "object"
      ? (operation.details_json as Record<string, unknown>)
      : null;
  return {
    reference:
      typeof details?.justificatif_reference === "string" ? details.justificatif_reference : null,
    url: typeof details?.justificatif_url === "string" ? details.justificatif_url : null,
    note: typeof details?.justificatif_note === "string" ? details.justificatif_note : null,
    archiveId:
      typeof details?.fichier_archive_id === "string" ? details.fichier_archive_id : null,
    archivePath:
      typeof details?.fichier_archive_chemin === "string" ? details.fichier_archive_chemin : null,
    archiveStorage:
      typeof details?.fichier_archive_stockage === "string"
        ? details.fichier_archive_stockage
        : null,
    archiveTag:
      typeof details?.fichier_archive_tag === "string" ? details.fichier_archive_tag : null,
  };
}

export function getPaiementReconciliationStatusLabel(record?: Partial<PaiementWithRelations> | null) {
  const operation = getLatestOperation(record, "RAPPROCHEMENT_PAIEMENT");
  if (operation) return "Rapproche";
  const registration = getLatestOperation(record, "ENREGISTREMENT_PAIEMENT");
  if (registration) return "En attente";
  return "Non renseigne";
}

export function getPaiementAvailableOverpayment(record?: Partial<PaiementWithRelations> | null) {
  if (!record?.operationsFinancieres?.length) return 0;

  const initial = record.operationsFinancieres.reduce((sum, operation) => {
    if ((operation.type ?? "").toUpperCase() !== "TROP_PERCU") return sum;
    const details = readOperationDetails(operation.details_json);
    const explicit = details ? toAmount(details.montant_disponible) : 0;
    return sum + Math.max(0, explicit || toAmount(operation.montant));
  }, 0);

  const consumed = record.operationsFinancieres.reduce((sum, operation) => {
    const type = (operation.type ?? "").toUpperCase();
    const details = readOperationDetails(operation.details_json);
    if (type === "REPORT_SOLDE_PERIODE") {
      return sum + Math.max(0, toAmount(details?.montant_source_utilise ?? operation.montant));
    }
    if (type === "REMBOURSEMENT_TROP_PERCU") {
      return sum + Math.max(0, toAmount(details?.montant_rembourse ?? operation.montant));
    }
    return sum;
  }, 0);

  return Math.max(0, Number((initial - consumed).toFixed(2)));
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

  async cancel(id: string, payload: { motif?: string | null } = {}) {
    return Http.post(["/api", this.url, id, "cancel"].join("/"), payload);
  }

  async refund(id: string, payload: { motif?: string | null } = {}) {
    return Http.post(["/api", this.url, id, "refund"].join("/"), payload);
  }

  async refundOverpayment(
    id: string,
    payload: { montant: number; motif?: string | null },
  ) {
    return Http.post(["/api", this.url, id, "refund-overpayment"].join("/"), payload);
  }

  async reconcile(id: string, payload: Record<string, unknown>) {
    return Http.post(["/api", this.url, id, "reconcile"].join("/"), payload);
  }

  async createMixed(payload: Record<string, unknown>) {
    return Http.post(["/api", this.url, "mixed"].join("/"), payload);
  }

  async reallocate(id: string, payload: Record<string, unknown>) {
    return Http.post(["/api", this.url, id, "reallocate"].join("/"), payload);
  }

  private buildScopedWhere(etablissementId: string, whereParam?: unknown) {
    const parsedWhere = parseObjectParam(whereParam);
    const scope = { facture: { is: { etablissement_id: etablissementId } } };
    if (!parsedWhere || Object.keys(parsedWhere).length === 0) return scope;
    return { AND: [parsedWhere, scope] };
  }
}

export default PaiementService;
