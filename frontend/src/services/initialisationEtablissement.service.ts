import { Http } from "../app/api/Http";
import Service from "../app/api/Service";
import type {
  InitialisationSetupDraft,
  NouvelleAnneeDraft,
} from "../pages/etablissement/initialisation/types";

class InitialisationEtablissementService extends Service {
  constructor() {
    super("initialisation-etablissement");
  }

  async getStatus(etablissementId: string) {
    return Http.get(["/api", this.url, "status"].join("/"), {
      etablissement_id: etablissementId,
    });
  }

  async getTemplates() {
    return Http.get(["/api", this.url, "templates"].join("/"), {});
  }

  async getSessions(etablissementId: string) {
    return Http.get(["/api", this.url].join("/"), {
      etablissement_id: etablissementId,
    });
  }

  async previewInitialSetup(payload: InitialisationSetupDraft) {
    return Http.post(["/api", this.url, "preview-initial-setup"].join("/"), {
      ...payload,
      custom_levels: payload.custom_levels,
    });
  }

  async commitInitialSetup(payload: InitialisationSetupDraft) {
    return Http.post(["/api", this.url, "commit-initial-setup"].join("/"), {
      ...payload,
      custom_levels: payload.custom_levels,
    });
  }

  async previewNewSchoolYear(payload: NouvelleAnneeDraft) {
    return Http.post(["/api", this.url, "preview-new-school-year"].join("/"), payload);
  }

  async commitNewSchoolYear(payload: NouvelleAnneeDraft) {
    return Http.post(["/api", this.url, "commit-new-school-year"].join("/"), payload);
  }
}

export default new InitialisationEtablissementService();
