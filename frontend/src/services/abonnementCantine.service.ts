import Service from "../app/api/Service";
import { Http } from "../app/api/Http";
import type {
  AbonnementCantine,
  AbsenceCantine,
  ConsommationCantine,
  FormuleCantine,
  HistoriqueFormuleCantine,
} from "../types/models";

type QueryParams = Record<string, unknown>;

export type AbonnementCantineWithRelations = AbonnementCantine & {
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
  formule?: FormuleCantine | null;
  facture?: {
    id: string;
    numero_facture?: string | null;
    statut?: string | null;
  } | null;
  operationsFinancieres?: Array<{
    id: string;
    type: string;
    montant?: number | string | null;
    motif?: string | null;
    details_json?: Record<string, unknown> | null;
    created_at?: string | Date;
    updated_at?: string | Date;
  }> | null;
  historiquesFormule?: HistoriqueFormuleCantine[] | null;
  consommations?: ConsommationCantine[] | null;
  finance_status?: string | null;
  access_status?: string | null;
  access_reason?: string | null;
  validity_start?: string | Date | null;
  validity_end?: string | Date | null;
};

export type CantineOperationalRow = AbonnementCantineWithRelations & {
  operational_status: "AUTORISE" | "SUSPENDU" | "EN_ATTENTE" | "INSUFFISANT" | "EXPIRE";
  evaluation_date?: string | Date | null;
};

export type CantineOperationalSummary = {
  autorises: number;
  suspendus: number;
  en_attente: number;
  insuffisants: number;
  expires: number;
};

export type ConsommationCantineWithRelations = ConsommationCantine & {
  abonnement?: AbonnementCantineWithRelations | null;
};

export type AbsenceCantineWithRelations = AbsenceCantine & {
  abonnement?: AbonnementCantineWithRelations | null;
};

export type CantineControlAnomalyRow = {
  anomaly_id: string;
  code:
    | "REPAS_SANS_AUTORISATION_ACTIVE"
    | "PAYE_SANS_CONSOMMATION"
    | "CONSOMMATION_SUPERIEURE_AUX_DROITS";
  gravite: "HIGH" | "MEDIUM";
  abonnement_cantine_id?: string | null;
  consommation_cantine_id?: string | null;
  eleve_id?: string | null;
  eleve_label: string;
  code_eleve?: string | null;
  annee_scolaire_id?: string | null;
  annee_label?: string | null;
  formule_cantine_id?: string | null;
  formule_label?: string | null;
  formule_type?: string | null;
  finance_status?: string | null;
  service_status?: string | null;
  access_status?: string | null;
  motif: string;
  evaluation_date?: string | Date | null;
  period_start?: string | Date | null;
  period_end?: string | Date | null;
  consommation_le?: string | Date | null;
  consommation_count?: number;
  allowed_count?: number | null;
  tracking_status: "OUVERTE" | "RESOLUE" | "IGNOREE";
};

export type CantineControlAnomalySummary = {
  total: number;
  repas_sans_autorisation_active: number;
  payes_sans_consommation: number;
  consommations_superieures_aux_droits: number;
};

export type AbonnementCantineWalletResponse = {
  abonnement: AbonnementCantineWithRelations;
  wallet: {
    solde_prepaye: number | string;
    solde_min_alerte: number | string;
    dernier_rechargement_le?: string | Date | null;
    history: Array<{
      id: string;
      type: string;
      montant?: number | string | null;
      motif?: string | null;
      details_json?: Record<string, unknown> | null;
      created_at?: string | Date;
      updated_at?: string | Date;
    }>;
  };
};

export type AbonnementCantineAccessCheckResponse = {
  abonnement: AbonnementCantineWithRelations;
  trace_id: string;
  checked_at: string | Date;
};

export type AbonnementCantineConsumeResponse = {
  abonnement: AbonnementCantineWithRelations | null;
  consommation: ConsommationCantineWithRelations;
  trace_id: string;
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

export function getAbonnementCantineDisplayLabel(record?: Partial<AbonnementCantineWithRelations> | null) {
  if (!record) return "Abonnement cantine";
  const fullName = [record.eleve?.utilisateur?.profil?.prenom, record.eleve?.utilisateur?.profil?.nom]
    .filter(Boolean)
    .join(" ")
    .trim();
  return fullName || record.eleve?.code_eleve || "Abonnement cantine";
}

export function getAbonnementCantineBalance(record?: Partial<AbonnementCantineWithRelations> | null) {
  const value =
    typeof record?.solde_prepaye === "number"
      ? record.solde_prepaye
      : Number(record?.solde_prepaye ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export function getAbonnementCantineFinanceStatusLabel(status?: string | null) {
  switch ((status ?? "").toUpperCase()) {
    case "REGLE":
      return "Regle";
    case "REGULARISE":
      return "Regularise";
    case "ACTIF":
      return "Actif";
    case "EN_ATTENTE_VALIDATION_FINANCIERE":
      return "En attente de validation financiere";
    case "EN_ATTENTE_REGLEMENT":
      return "En attente de reglement";
    case "PARTIELLEMENT_REGLE":
      return "Partiellement regle";
    case "IMPAYE":
      return "Impaye";
    case "IMPAYE_SIGNALE":
      return "Impaye signale";
    case "SUSPENDU":
      return "Suspendu";
    case "AUTORISATION_REFUSEE":
      return "Autorisation refusee";
    default:
      return status ?? "N/A";
  }
}

export function getCantineAbsenceEventLabel(type?: string | null) {
  switch ((type ?? "ABSENCE").toUpperCase()) {
    case "ANNULATION":
      return "Annulation";
    default:
      return "Absence";
  }
}

export function getCantineControlAnomalyLabel(code?: string | null) {
  switch ((code ?? "").toUpperCase()) {
    case "REPAS_SANS_AUTORISATION_ACTIVE":
      return "Repas sans autorisation";
    case "PAYE_SANS_CONSOMMATION":
      return "Paye sans consommation";
    case "CONSOMMATION_SUPERIEURE_AUX_DROITS":
      return "Surconsommation";
    default:
      return "Anomalie cantine";
  }
}

export function getCantineControlTrackingLabel(status?: string | null) {
  switch ((status ?? "").toUpperCase()) {
    case "RESOLUE":
      return "Resolue";
    case "IGNOREE":
      return "Ignoree";
    default:
      return "Ouverte";
  }
}

class AbonnementCantineService extends Service {
  constructor() {
    super("abonnement-cantine");
  }

  async getForEtablissement(etablissementId: string, params: QueryParams = {}) {
    const scopedWhere = this.buildScopedWhere(etablissementId, params.where);
    return this.getAll({
      ...params,
      where: JSON.stringify(scopedWhere),
      orderBy:
        typeof params.orderBy === "string"
          ? params.orderBy
          : JSON.stringify(params.orderBy ?? [{ created_at: "desc" }]),
    } as Record<string, string | number | Date | boolean>);
  }

  async getWallet(id: string) {
    return this.get(`${id}/wallet`);
  }

  async getPendingFinanceBilling(etablissementId: string) {
    return Http.get(
      ["/api", this.url, "pending-finance-billing"].join("/"),
      {
        where: JSON.stringify({ eleve: { is: { etablissement_id: etablissementId } } }),
      },
    );
  }

  async processFinanceBilling(id: string) {
    return Http.post(["/api", this.url, id, "process-finance-billing"].join("/"), {});
  }

  async getPendingFinanceRegularization(etablissementId: string) {
    return Http.get(
      ["/api", this.url, "pending-finance-regularization"].join("/"),
      {
        where: JSON.stringify({ eleve: { is: { etablissement_id: etablissementId } } }),
      },
    );
  }

  async processFinanceRegularization(id: string) {
    return Http.post(["/api", this.url, id, "process-finance-regularization"].join("/"), {});
  }

  async getPendingFinanceSuspension(etablissementId: string) {
    return Http.get(
      ["/api", this.url, "pending-finance-suspension"].join("/"),
      {
        where: JSON.stringify({ eleve: { is: { etablissement_id: etablissementId } } }),
      },
    );
  }

  async getOperationalList(
    etablissementId: string,
    params: {
      reference_date?: string;
      period_start?: string;
      period_end?: string;
      access_status?: string;
      search?: string;
    } = {},
  ) {
    return Http.get(
      ["/api", this.url, "operational-list"].join("/"),
      {
        etablissement_id: etablissementId,
        ...params,
      },
    );
  }

  async signalFinanceSuspension(
    id: string,
    payload: {
      source?: string;
      motif?: string | null;
      finance_status?: string | null;
    },
  ) {
    return Http.post(["/api", this.url, id, "signal-finance-suspension"].join("/"), payload);
  }

  async reportAbsence(
    id: string,
    payload: {
      type_evenement?: "ABSENCE" | "ANNULATION";
      note?: string | null;
      date_repas?: string | Date;
    },
  ) {
    return Http.post(["/api", this.url, id, "report-absence"].join("/"), payload);
  }

  async getPendingFinanceAbsenceRegularization(etablissementId: string) {
    return Http.get(
      ["/api", this.url, "pending-finance-absence-regularization"].join("/"),
      {
        where: JSON.stringify({ eleve: { is: { etablissement_id: etablissementId } } }),
      },
    );
  }

  async processFinanceAbsenceRegularization(
    absenceId: string,
    payload: {
      decision_finance:
        | "AVOIR"
        | "REPORT"
        | "REMBOURSEMENT"
        | "AJUSTEMENT"
        | "REFUS_REGULARISATION";
      note?: string | null;
    },
  ) {
    return Http.post(
      ["/api", this.url, "absences", absenceId, "process-finance-regularization"].join("/"),
      payload,
    );
  }

  async getPendingFinanceConsumptionControl(etablissementId: string) {
    return Http.get(
      ["/api", this.url, "pending-finance-consumption-control"].join("/"),
      {
        where: JSON.stringify({ eleve: { is: { etablissement_id: etablissementId } } }),
      },
    );
  }

  async processFinanceConsumptionControl(consommationId: string) {
    return Http.post(
      ["/api", this.url, "consommations", consommationId, "process-finance-control"].join("/"),
      {},
    );
  }

  async getControlAnomalies(
    etablissementId: string,
    params: {
      reference_date?: string;
      period_start?: string;
      period_end?: string;
      search?: string;
    } = {},
  ) {
    return Http.get(
      ["/api", this.url, "control-anomalies"].join("/"),
      {
        etablissement_id: etablissementId,
        ...params,
      },
    );
  }

  async markControlAnomaly(
    etablissementId: string,
    payload: {
      anomaly_id: string;
      decision: "RESOLVED" | "IGNORED";
      note?: string;
    },
  ) {
    return Http.post(
      ["/api", this.url, "control-anomalies", "mark"].join("/"),
      {
        etablissement_id: etablissementId,
        ...payload,
      },
    );
  }

  async changeFormula(
    id: string,
    payload: {
      formule_cantine_id: string;
      date_effet: string | Date;
    },
  ) {
    return Http.post(["/api", this.url, id, "change-formula"].join("/"), payload);
  }

  async checkAccess(payload: {
    abonnement_cantine_id?: string;
    lookup?: string;
    reference_date?: string | Date | null;
  }) {
    return Http.post(["/api", this.url, "access-check"].join("/"), payload);
  }

  async recharge(
    id: string,
    payload: {
      montant: number;
      methode?: string;
      reference?: string | null;
      note?: string | null;
      rechargement_le?: string | Date | null;
    },
  ) {
    return Http.post(["/api", this.url, id, "recharge"].join("/"), payload);
  }

  async consume(
    id: string,
    payload: {
      type_repas?: string;
      note?: string | null;
      consommation_le?: string | Date | null;
    },
  ) {
    return Http.post(["/api", this.url, id, "consume"].join("/"), payload);
  }

  private buildScopedWhere(etablissementId: string, whereParam?: unknown) {
    const parsedWhere = parseObjectParam(whereParam);
    const scope = { eleve: { is: { etablissement_id: etablissementId } } };
    if (!parsedWhere || Object.keys(parsedWhere).length === 0) return scope;
    return { AND: [parsedWhere, scope] };
  }
}

export default AbonnementCantineService;
