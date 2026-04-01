import Service from "../app/api/Service";
import { Http } from "../app/api/Http";

export type FinanceRecoveryPolicy = {
  id: string;
  etablissement_id: string;
  nom?: string | null;
  jours_grace?: number | null;
  relance_jours_json?: number[] | null;
  penalite_active?: boolean | null;
  penalite_mode?: "FIXED" | "PERCENT" | null;
  penalite_valeur?: number | null;
  statut_validation?: string | null;
  approuve_par_utilisateur_id?: string | null;
  approuve_le?: string | Date | null;
  motif_rejet?: string | null;
};

export type FinancePaymentPromise = {
  id: string;
  eleve_id: string;
  annee_scolaire_id: string;
  facture_id?: string | null;
  plan_paiement_id?: string | null;
  echeance_paiement_id?: string | null;
  montant_promis: number;
  date_limite: string | Date;
  canal?: string | null;
  note?: string | null;
  statut?: string | null;
  created_at?: string | Date;
};

export type AdministrativeRestriction = {
  id: string;
  eleve_id: string;
  annee_scolaire_id: string;
  facture_id?: string | null;
  plan_paiement_id?: string | null;
  type: "BULLETIN" | "EXAMEN" | "REINSCRIPTION";
  source?: string | null;
  motif?: string | null;
  statut?: string | null;
  created_at?: string | Date;
  date_levee?: string | Date | null;
};

export type RecoveryCollectionCase = {
  id: string;
  eleve_id: string;
  annee_scolaire_id: string;
  facture_id?: string | null;
  plan_paiement_id?: string | null;
  statut?: string | null;
  motif?: string | null;
  note?: string | null;
  montant_reference?: number | null;
  date_statut?: string | Date | null;
  created_at?: string | Date;
};

export type FinanceRecoveryPolicyPayload = {
  nom?: string | null;
  jours_grace?: number;
  relance_jours_json?: number[];
  penalite_active?: boolean;
  penalite_mode?: "FIXED" | "PERCENT" | null;
  penalite_valeur?: number | null;
};

class FinanceRecouvrementService extends Service {
  constructor() {
    super("finance-recouvrement");
  }

  async getPolicy() {
    return Http.get(`/api/${this.url}/policy`, {});
  }

  async savePolicy(payload: FinanceRecoveryPolicyPayload) {
    return Http.put(`/api/${this.url}/policy`, payload);
  }

  async approvePolicy() {
    return Http.post(`/api/${this.url}/policy/approve`, {});
  }

  async rejectPolicy(motif?: string | null) {
    return Http.post(`/api/${this.url}/policy/reject`, { motif: motif ?? null });
  }

  async createPaymentPromise(payload: Record<string, unknown>) {
    return Http.post(`/api/${this.url}/payment-promises`, payload);
  }

  async getPaymentPromises(params: Record<string, unknown> = {}) {
    return Http.get(`/api/${this.url}/payment-promises`, params);
  }

  async keepPaymentPromise(id: string) {
    return Http.post(`/api/${this.url}/payment-promises/${id}/keep`, {});
  }

  async breakPaymentPromise(id: string) {
    return Http.post(`/api/${this.url}/payment-promises/${id}/break`, {});
  }

  async cancelPaymentPromise(id: string) {
    return Http.post(`/api/${this.url}/payment-promises/${id}/cancel`, {});
  }

  async createAdministrativeRestriction(payload: Record<string, unknown>) {
    return Http.post(`/api/${this.url}/administrative-restrictions`, payload);
  }

  async getAdministrativeRestrictions(params: Record<string, unknown> = {}) {
    return Http.get(`/api/${this.url}/administrative-restrictions`, params);
  }

  async liftAdministrativeRestriction(id: string) {
    return Http.post(`/api/${this.url}/administrative-restrictions/${id}/lift`, {});
  }

  async createCollectionCase(payload: Record<string, unknown>) {
    return Http.post(`/api/${this.url}/collection-cases`, payload);
  }

  async getCollectionCases(params: Record<string, unknown> = {}) {
    return Http.get(`/api/${this.url}/collection-cases`, params);
  }

  async updateCollectionCaseStatus(id: string, payload: Record<string, unknown>) {
    return Http.post(`/api/${this.url}/collection-cases/${id}/status`, payload);
  }
}

export default FinanceRecouvrementService;
