import Service from "../app/api/Service";
import { Http } from "../app/api/Http";

class ParentTuteurService extends Service {
    constructor() {
        super("parent-tuteur");
    }

    async getFamilyFinanceList(params?: Record<string, string | number | boolean>) {
        return await Http.get("/api/parent-tuteur/family-finance", params ?? {});
    }

    async getFamilyFinance(id: string, params?: Record<string, string | number | boolean>) {
        return await Http.get(`/api/parent-tuteur/family-finance/${id}`, params ?? {});
    }

    async createFamilyPayment(id: string, payload: Record<string, unknown>) {
        return await Http.post(`/api/parent-tuteur/family-finance/${id}/pay`, payload);
    }

    async sendFamilyRelance(id: string, payload: Record<string, unknown>) {
        return await Http.post(`/api/parent-tuteur/family-finance/${id}/relance`, payload);
    }
}

export default ParentTuteurService;
