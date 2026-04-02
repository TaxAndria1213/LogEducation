import Service from "../app/api/Service";
import { Http } from "../app/api/Http";
import type {
  AbonnementTransport,
  ArretTransport,
  HistoriqueAffectationTransport,
  LigneTransport,
} from "../types/models";

type QueryParams = Record<string, unknown>;

export type AbonnementTransportWithRelations = AbonnementTransport & {
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
  ligne?: LigneTransport | null;
  arret?: ArretTransport | null;
  facture?: {
    id: string;
    numero_facture?: string | null;
    statut?: string | null;
  } | null;
  historiquesAffectation?: HistoriqueAffectationTransport[];
};

export type OperationalTransportRow = AbonnementTransportWithRelations & {
  operational_status: "ACTIF" | "SUSPENDU" | "EN_ATTENTE" | "RADIE";
  access_for_date: "AUTORISE" | "SUSPENDU" | "EN_ATTENTE" | "EXPIRE";
  finance_authorized: boolean;
  evaluation_date?: string | Date | null;
  latest_usage_at?: string | Date | null;
  usage_count_in_window?: number;
  used_in_window?: boolean;
};

export type TransportControlAnomalyRow = {
  anomaly_id: string;
  code:
    | "TRANSPORTE_SANS_DROIT_FINANCIER"
    | "PAYE_SANS_AFFECTATION_TRANSPORT"
    | "SUSPENDU_AVEC_USAGE_REEL";
  gravite: "HIGH" | "MEDIUM";
  abonnement_transport_id?: string | null;
  eleve_id?: string | null;
  eleve_label: string;
  code_eleve?: string | null;
  annee_scolaire_id?: string | null;
  annee_label?: string | null;
  ligne_transport_id?: string | null;
  ligne_label?: string | null;
  arret_label?: string | null;
  zone_transport?: string | null;
  finance_status?: string | null;
  service_status?: string | null;
  operational_status?: string | null;
  facture_id?: string | null;
  facture_numero?: string | null;
  motif: string;
  evaluation_date?: string | Date | null;
  tracking_status: "OUVERTE" | "RESOLUE" | "IGNOREE";
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

export function getAbonnementTransportDisplayLabel(record?: Partial<AbonnementTransportWithRelations> | null) {
  if (!record) return "Abonnement transport";
  const fullName = [record.eleve?.utilisateur?.profil?.prenom, record.eleve?.utilisateur?.profil?.nom]
    .filter(Boolean)
    .join(" ")
    .trim();
  return fullName || record.eleve?.code_eleve || "Abonnement transport";
}

export function getAbonnementTransportProrataLabel(record?: Partial<AbonnementTransportWithRelations> | null) {
  const ratio =
    typeof record?.prorata_ratio === "number"
      ? record.prorata_ratio
      : Number(record?.prorata_ratio ?? 0);
  if (!Number.isFinite(ratio) || ratio <= 0 || ratio >= 1) return "Plein tarif";
  return `Prorata ${(ratio * 100).toFixed(0)}%`;
}

class AbonnementTransportService extends Service {
  constructor() {
    super("abonnement-transport");
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

  async changeLine(
    id: string,
    payload: {
      ligne_transport_id: string;
      arret_transport_id?: string | null;
      zone_transport: string;
      date_effet: string | Date;
    },
  ) {
    return Http.post(["/api", this.url, id, "change-line"].join("/"), payload);
  }

  async approveRequest(id: string) {
    return Http.post(["/api", this.url, id, "approve-request"].join("/"), {});
  }

  async signalFinanceSuspension(
    id: string,
    payload?: {
      motif?: string;
      source?: string;
    },
  ) {
    return Http.post(["/api", this.url, id, "finance-suspension-signal"].join("/"), payload ?? {});
  }

  async approveFinanceSuspension(
    id: string,
    payload?: {
      motif?: string;
    },
  ) {
    return Http.post(["/api", this.url, id, "approve-finance-suspension"].join("/"), payload ?? {});
  }

  async rejectFinanceSuspension(
    id: string,
    payload?: {
      motif?: string;
    },
  ) {
    return Http.post(["/api", this.url, id, "reject-finance-suspension"].join("/"), payload ?? {});
  }

  async getPendingFinanceBilling(etablissementId: string) {
    return Http.get(
      ["/api", this.url, "pending-finance-billing"].join("/"),
      {
        where: JSON.stringify({ eleve: { is: { etablissement_id: etablissementId } } }),
      },
    );
  }

  async linkFinanceFacture(id: string, facture_id: string) {
    return Http.post(["/api", this.url, id, "link-finance-facture"].join("/"), {
      facture_id,
    });
  }

  async processFinanceRegularization(id: string) {
    return Http.post(["/api", this.url, id, "process-finance-regularization"].join("/"), {});
  }

  async processFinanceBilling(id: string) {
    return Http.post(["/api", this.url, id, "process-finance-billing"].join("/"), {});
  }

  async updatePeriod(
    id: string,
    payload: {
      date_debut_service?: string | Date | null;
      date_fin_service?: string | Date | null;
    },
  ) {
    return Http.post(["/api", this.url, id, "update-period"].join("/"), payload);
  }

  async getOperationalList(
    etablissementId: string,
    params: {
      reference_date?: string;
      period_start?: string;
      period_end?: string;
      ligne_transport_id?: string;
      operational_status?: string;
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

  async recordUsage(
    id: string,
    payload?: {
      usage_date?: string | Date;
      note?: string;
    },
  ) {
    return Http.post(["/api", this.url, id, "record-usage"].join("/"), payload ?? {});
  }

  async getControlAnomalies(
    etablissementId: string,
    params: {
      reference_date?: string;
      period_start?: string;
      period_end?: string;
      ligne_transport_id?: string;
      operational_status?: string;
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

  private buildScopedWhere(etablissementId: string, whereParam?: unknown) {
    const parsedWhere = parseObjectParam(whereParam);
    const scope = { eleve: { is: { etablissement_id: etablissementId } } };
    if (!parsedWhere || Object.keys(parsedWhere).length === 0) return scope;
    return { AND: [parsedWhere, scope] };
  }
}

export default AbonnementTransportService;
