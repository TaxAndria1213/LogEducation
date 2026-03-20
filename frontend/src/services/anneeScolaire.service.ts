import { Http } from "../app/api/Http";
import Service from "../app/api/Service";

type StartNewYearPayload = {
  etablissement_id: string;
  nom: string;
  date_debut: string;
  date_fin: string;
  source_annee_id?: string;
  copy_periodes?: boolean;
  close_current_year?: boolean;
  est_active?: boolean;
};

class AnneeScolaireService extends Service {
  constructor() {
    super("annee-scolaire");
  }

  async getCurrent(etablissementId: string) {
    try {
      const result = await this.getAll({
        where: JSON.stringify({
          est_active: true,
          etablissement_id: etablissementId,
        }),
        orderBy: JSON.stringify([{ date_debut: "desc" }]),
      });
      if (result?.status.success) {
        return result.data.data[0];
      }
    } catch (error) {
      console.log(error);
    }
  }

  async closeActive(etablissementId: string) {
    return Http.post(["/api", this.url, "close-active"].join("/"), {
      etablissement_id: etablissementId,
    });
  }

  async startNewYear(payload: StartNewYearPayload) {
    return Http.post(["/api", this.url, "start-new"].join("/"), payload);
  }
}

export default new AnneeScolaireService();
