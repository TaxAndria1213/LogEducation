import { Application, Request, Response as R, Router } from "express";
import Response from "../../../common/app/response";
import InitialisationPedagogiqueService from "./initialisation_pedagogique.service";

type ScopedRequest = Request & {
  tenantId?: string;
  user?: {
    etablissement_id?: string | null;
  };
};

type AppError = Error & {
  statusCode?: number;
};

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

class InitialisationPedagogiqueApp {
  public app: Application;
  public router: Router;
  private service: InitialisationPedagogiqueService;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.service = new InitialisationPedagogiqueService();
    this.routes();
  }

  public routes(): Router {
    this.router.get("/config", this.getConfig.bind(this));
    this.router.put("/config", this.saveConfig.bind(this));
    return this.router;
  }

  private buildError(message: string, statusCode: number) {
    const error = new Error(message) as AppError;
    error.statusCode = statusCode;
    return error;
  }

  private getRequestBody(req: Request): Record<string, unknown> {
    return req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? { ...(req.body as Record<string, unknown>) }
      : {};
  }

  private getEtablissementId(req: ScopedRequest): string {
    const requestBody = this.getRequestBody(req);
    const scopedTenantId =
      readString(req.tenantId) ?? readString(req.user?.etablissement_id);
    const requestedEtablissementId =
      readString(req.query.etablissement_id) ??
      readString(requestBody.etablissement_id);

    if (
      scopedTenantId &&
      requestedEtablissementId &&
      requestedEtablissementId !== scopedTenantId
    ) {
      throw this.buildError(
        "Conflit de contexte sur l'etablissement pedagogique.",
        403,
      );
    }

    const etablissementId = scopedTenantId ?? requestedEtablissementId;

    if (!etablissementId) {
      throw this.buildError("L'etablissement cible est obligatoire.", 400);
    }

    return etablissementId;
  }

  private async getConfig(req: Request, res: R) {
    try {
      const scopedReq = req as ScopedRequest;
      const etablissementId = this.getEtablissementId(scopedReq);
      const anneeScolaireId = readString(req.query.annee_scolaire_id);

      const result = await this.service.getConfig(
        etablissementId,
        anneeScolaireId,
      );
      Response.success(
        res,
        "Configuration d'initialisation pedagogique recuperee.",
        result,
      );
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la lecture de la configuration pedagogique",
        (error as AppError).statusCode ?? 400,
        error as Error,
      );
      return;
    }
  }

  private async saveConfig(req: Request, res: R) {
    try {
      const scopedReq = req as ScopedRequest;
      const requestBody = this.getRequestBody(scopedReq);
      const etablissementId = this.getEtablissementId(scopedReq);

      const result = await this.service.saveConfig({
        etablissement_id: etablissementId,
        annee_scolaire_id: readString(requestBody.annee_scolaire_id) ?? null,
        mode_initialisation:
          requestBody.mode_initialisation === "AVANCE" ? "AVANCE" : "RAPIDE",
        default_teacher_id:
          readString(requestBody.default_teacher_id) ?? null,
        teacher_assignments: requestBody.teacher_assignments,
        evaluation_types: Array.isArray(requestBody.evaluation_types)
          ? requestBody.evaluation_types
          : [],
        note_rules:
          requestBody.note_rules && typeof requestBody.note_rules === "object"
            ? (requestBody.note_rules as Record<string, unknown>)
            : {},
        bulletin_config:
          requestBody.bulletin_config &&
          typeof requestBody.bulletin_config === "object"
            ? (requestBody.bulletin_config as Record<string, unknown>)
            : {},
      });

      Response.success(
        res,
        "Configuration d'initialisation pedagogique enregistree.",
        result,
      );
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de l'enregistrement de la configuration pedagogique",
        (error as AppError).statusCode ?? 400,
        error as Error,
      );
      return;
    }
  }
}

export default InitialisationPedagogiqueApp;
