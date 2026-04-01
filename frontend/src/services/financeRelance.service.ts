import Service from "../app/api/Service";

type QueryParams = Record<string, unknown>;

export type FinanceRelanceRecipient = {
  utilisateur_id: string;
  nom: string;
  statut?: string | null;
  lu_le?: string | Date | null;
};

export type FinanceRelanceHistoryItem = {
  id: string;
  batch_id: string;
  objet: string;
  corps: string;
  envoye_le: string | Date;
  facture_id?: string | null;
  plan_paiement_id?: string | null;
  eleve_id?: string | null;
  stage_days?: number | null;
  suggested_penalty?: number | null;
  echeance_ids: string[];
  destinataires: FinanceRelanceRecipient[];
  expediteur?: {
    id: string;
    nom: string;
  } | null;
};

export type FinanceRelanceSendPayload = {
  echeance_ids?: string[];
  facture_id?: string | null;
  plan_paiement_id?: string | null;
  objet_personnalise?: string | null;
  message_personnalise?: string | null;
};

class FinanceRelanceService extends Service {
  constructor() {
    super("finance-relance");
  }

  async getHistory(params: QueryParams = {}) {
    return this.getAll(params as Record<string, string | number | Date | boolean>);
  }

  async sendRelance(payload: FinanceRelanceSendPayload) {
    return this.create(payload);
  }

  async runCalendar(payload: { date_reference?: string | Date | null } = {}) {
    return this.customRequest.post("/run-calendar", payload);
  }
}

export default FinanceRelanceService;
