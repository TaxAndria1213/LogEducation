import Service from "../app/api/Service";

type QueryParams = Record<string, unknown>;

export type FacturationRecurrenteHistoryItem = {
  run_id: string;
  periodicite: string;
  cycle_key: string;
  cycle_label: string;
  date_reference: string | Date;
  annee_scolaire_id: string;
  annee_label: string;
  created_at: string | Date;
  created_by?: string | null;
  created_count: number;
  catalogues: Array<{
    id: string;
    nom: string;
    count: number;
  }>;
};

export type FacturationRecurrenteGeneratePayload = {
  annee_scolaire_id?: string | null;
  catalogue_frais_id?: string | null;
  periodicite?: string | null;
  niveau_scolaire_id?: string | null;
  date_reference?: string | Date;
  date_echeance?: string | Date | null;
};

export type FacturationRecurrenteReadiness = {
  ready: boolean;
  annee_scolaire_id: string;
  annee_label: string;
  approved_recurring_count: number;
  active_inscriptions_count: number;
  periodes_count: number;
  issues: Array<{
    code: string;
    message: string;
    severity: "error" | "warning";
  }>;
};

class FacturationRecurrenteService extends Service {
  constructor() {
    super("facturation-recurrente");
  }

  async generate(payload: FacturationRecurrenteGeneratePayload) {
    return this.createWithCustomPath("generate", payload);
  }

  async getHistory(params: QueryParams = {}) {
    return this.getAllWithCustomPath("history", params as Record<string, string | number | Date | boolean>);
  }

  async getReadiness(params: QueryParams = {}) {
    return this.getAllWithCustomPath("readiness", params as Record<string, string | number | Date | boolean>);
  }

  private async createWithCustomPath(path: string, payload: FacturationRecurrenteGeneratePayload) {
    return this.createAtPath(path, payload);
  }

  private async getAllWithCustomPath(path: string, params: Record<string, string | number | Date | boolean>) {
    return this.getAtPath(path, params);
  }

  private async createAtPath(path: string, payload: FacturationRecurrenteGeneratePayload) {
    return this.createUsingUrl(`${this.url}/${path}`, payload);
  }

  private async getAtPath(path: string, params: Record<string, string | number | Date | boolean>) {
    return this.getAllUsingUrl(`${this.url}/${path}`, params);
  }

  private async createUsingUrl(url: string, params: FacturationRecurrenteGeneratePayload) {
    const service = new Service(url);
    return service.create(params);
  }

  private async getAllUsingUrl(url: string, params: Record<string, string | number | Date | boolean>) {
    const service = new Service(url);
    return service.getAll(params);
  }
}

export default FacturationRecurrenteService;
