import { Http } from "../app/api/Http";
import Service from "../app/api/Service";
import type {
  InitialisationSetupDraft,
  NouvelleAnneeDraft,
} from "../pages/etablissement/initialisation/types";
import { notifyStartupChecklistChanged } from "../components/startup/startupChecklistEvents";

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
    const response = await Http.post(["/api", this.url, "commit-initial-setup"].join("/"), {
      ...payload,
      custom_levels: payload.custom_levels,
    });
    notifyStartupChecklistChanged();
    return response;
  }

  async previewNewSchoolYear(payload: NouvelleAnneeDraft) {
    return Http.post(["/api", this.url, "preview-new-school-year"].join("/"), payload);
  }

  async commitNewSchoolYear(payload: NouvelleAnneeDraft) {
    const response = await Http.post(["/api", this.url, "commit-new-school-year"].join("/"), payload);
    notifyStartupChecklistChanged();
    return response;
  }
}

export default new InitialisationEtablissementService();
