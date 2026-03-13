/* eslint-disable @typescript-eslint/no-explicit-any */
import { Http } from "../app/api/Http";
import Service from "../app/api/Service";
import type { Inscription } from "../types/models";

class InscriptionService extends Service {
    constructor() {
        super("inscription");
    }

    async createFull(payload: any) {
        try {
            return await Http.post(["/api", this.url, "full"].join("/"), payload);
        } catch (error) {
            console.log(error);
        }
    }

    async getStudentRegisteredNumberThisYear(annee_scolaire_id: string) {
        try {
            const result = await this.getAll({
                where: JSON.stringify({ annee_scolaire_id: annee_scolaire_id } as Partial<Inscription>),
            })

            if (result?.status.success) {
                return result.data.meta.total;
            }
        } catch (error) {
            console.log(error);
        }
    }
}

export default InscriptionService
