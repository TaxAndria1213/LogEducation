import Service from "../app/api/Service";
import { Http } from "../app/api/Http";

export type EnrollmentFinancePolicySettings = {
    etablissement_id: string;
    mode: "NONE" | "PERCENT" | "AMOUNT" | "INSCRIPTION_FEE" | "INSCRIPTION_AND_FIRST_SCOLARITE_TRANCHE";
    value: number;
    due_soon_days: number;
};

class EtablissementService  extends Service {
    constructor() {
        super("etablissement");
    }

    async getEnrollmentFinancePolicy() {
        return Http.get(`/api/${this.url}/current/enrollment-finance-policy`, {});
    }

    async saveEnrollmentFinancePolicy(payload: {
        mode: "NONE" | "PERCENT" | "AMOUNT" | "INSCRIPTION_FEE" | "INSCRIPTION_AND_FIRST_SCOLARITE_TRANCHE";
        value: number;
        due_soon_days: number;
    }) {
        return Http.put(`/api/${this.url}/current/enrollment-finance-policy`, payload);
    }
}

export default EtablissementService;
