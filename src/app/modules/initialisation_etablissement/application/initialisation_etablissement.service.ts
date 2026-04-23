import InitialisationEtablissementModel from "../models/initialisation_etablissement.model";
import InitialisationCommitService from "./initialisation_commit.service";
import InitialisationPreviewService from "./initialisation_preview.service";
import { defaultPermissionTemplates } from "./templates/default-permissions.template";
import { defaultPeriodTemplates } from "./templates/default-periods.template";
import { defaultRoleTemplates } from "./templates/default-roles.template";
import { standardLevelTemplates } from "./templates/standard-levels.template";

class InitialisationEtablissementService {
  private model: InitialisationEtablissementModel;
  private previewService: InitialisationPreviewService;
  private commitService: InitialisationCommitService;

  constructor() {
    this.model = new InitialisationEtablissementModel();
    this.previewService = new InitialisationPreviewService();
    this.commitService = new InitialisationCommitService();
  }

  public async getStatus(etablissementId: string) {
    return this.model.getStatus(etablissementId);
  }

  public async getSessions(etablissementId: string) {
    return this.model.getVirtualSessions(etablissementId);
  }

  public async getSessionById(etablissementId: string, sessionId: string) {
    const sessions = await this.getSessions(etablissementId);
    const session = sessions.find((entry) => entry.id === sessionId);
    if (!session) {
      throw new Error("Session d'initialisation introuvable.");
    }
    return session;
  }

  public getTemplates() {
    return {
      niveaux_standards: standardLevelTemplates,
      periodes_standards: defaultPeriodTemplates,
      roles_standards: defaultRoleTemplates,
      permissions_standards: defaultPermissionTemplates,
    };
  }

  public async previewInitialSetup(body: unknown) {
    return this.previewService.previewInitialSetup(body);
  }

  public async previewNewSchoolYear(body: unknown) {
    return this.previewService.previewNewSchoolYear(body);
  }

  public async commitInitialSetup(body: unknown) {
    return this.commitService.commitInitialSetup(body);
  }

  public async commitNewSchoolYear(body: unknown) {
    return this.commitService.commitNewSchoolYear(body);
  }
}

export default InitialisationEtablissementService;
