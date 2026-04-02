import Service from "../app/api/Service";
import { Http } from "../app/api/Http";
import type { AbonnementCantine, FormuleCantine } from "../types/models";

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
  finance_status?: string | null;
  access_status?: string | null;
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
      montant: number;
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
