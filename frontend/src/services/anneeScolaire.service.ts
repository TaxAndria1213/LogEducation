import Service from "../app/api/Service";

class AnneeScolaireService extends Service {
    constructor() {
        super("annee-scolaire");
    }

    async getCurrent(etablissement_id: string) {
        try {
            const result = await this.getAll({
                where: JSON.stringify({ est_active: true, etablissement_id: etablissement_id })
            });
            if (result?.status.success) {
                return result.data.data[0];
            }
        } catch (error) {
            console.log(error);
        }

    }
}

export default new AnneeScolaireService();