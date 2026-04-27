import {
  Application,
  Request,
  Response as R,
  Router,
} from "express";
import Response from "../../../common/app/response";
import InitialisationEtablissementService from "./initialisation_etablissement.service";

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

type ScopedRequest = Request & {
  tenantId?: string;
  user?: {
    etablissement_id?: string | null;
  };
};

type AppError = Error & {
  statusCode?: number;
};

class InitialisationEtablissementApp {
  public app: Application;
  public router: Router;
  private service: InitialisationEtablissementService;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.service = new InitialisationEtablissementService();
    this.routes();
  }

  public routes(): Router {
    this.router.get("/status", this.getStatus.bind(this));
    this.router.get("/templates", this.getTemplates.bind(this));
    this.router.get("/", this.getSessions.bind(this));
    this.router.get("/:id", this.getSessionById.bind(this));
    this.router.post(
      "/preview-initial-setup",
      this.previewInitialSetup.bind(this),
    );
    this.router.post(
      "/commit-initial-setup",
      this.commitInitialSetup.bind(this),
    );
    this.router.post(
      "/preview-new-school-year",
      this.previewNewSchoolYear.bind(this),
    );
    this.router.post(
      "/commit-new-school-year",
      this.commitNewSchoolYear.bind(this),
    );
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
        "Conflit de contexte sur l'etablissement d'initialisation.",
        403,
      );
    }

    const etablissementId = scopedTenantId ?? requestedEtablissementId;

    if (!etablissementId) {
      throw this.buildError("L'etablissement cible est obligatoire.", 400);
    }

    return etablissementId;
  }

  private getScopedBody(req: ScopedRequest) {
    return {
      ...this.getRequestBody(req),
      etablissement_id: this.getEtablissementId(req),
    };
  }

  private async getStatus(req: Request, res: R) {
    try {
      const result = await this.service.getStatus(this.getEtablissementId(req as ScopedRequest));
      Response.success(res, "Etat d'initialisation recupere.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la lecture de l'etat d'initialisation",
        (error as AppError).statusCode ?? 400,
        error as Error,
      );
      return;
    }
  }

  private async getTemplates(_req: Request, res: R) {
    try {
      const result = this.service.getTemplates();
      Response.success(res, "Modeles d'initialisation recuperes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la lecture des modeles d'initialisation",
        400,
        error as Error,
      );
      return;
    }
  }

  private async getSessions(req: Request, res: R) {
    try {
      const result = await this.service.getSessions(
        this.getEtablissementId(req as ScopedRequest),
      );
      Response.success(res, "Sessions d'initialisation recuperees.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la lecture des sessions d'initialisation",
        (error as AppError).statusCode ?? 400,
        error as Error,
      );
      return;
    }
  }

  private async getSessionById(req: Request, res: R) {
    try {
      const result = await this.service.getSessionById(
        this.getEtablissementId(req as ScopedRequest),
        req.params.id,
      );
      Response.success(res, "Session d'initialisation recuperee.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la lecture de la session d'initialisation",
        (error as AppError).statusCode ?? 404,
        error as Error,
      );
      return;
    }
  }

  private async previewInitialSetup(req: Request, res: R) {
    try {
      const result = await this.service.previewInitialSetup(
        this.getScopedBody(req as ScopedRequest),
      );
      Response.success(res, "Previsualisation initiale generee.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la previsualisation de l'initialisation",
        (error as AppError).statusCode ?? 400,
        error as Error,
      );
      return;
    }
  }

  private async commitInitialSetup(req: Request, res: R) {
    try {
      const result = await this.service.commitInitialSetup(
        this.getScopedBody(req as ScopedRequest),
      );
      Response.success(res, "Initialisation de base executee.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors du commit de l'initialisation",
        (error as AppError).statusCode ?? 400,
        error as Error,
      );
      return;
    }
  }

  private async previewNewSchoolYear(req: Request, res: R) {
    try {
      const result = await this.service.previewNewSchoolYear(
        this.getScopedBody(req as ScopedRequest),
      );
      Response.success(res, "Previsualisation de la nouvelle annee generee.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la previsualisation de la nouvelle annee",
        (error as AppError).statusCode ?? 400,
        error as Error,
      );
      return;
    }
  }

  private async commitNewSchoolYear(req: Request, res: R) {
    try {
      const result = await this.service.commitNewSchoolYear(
        this.getScopedBody(req as ScopedRequest),
      );
      Response.success(res, "Nouvelle annee scolaire creee.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la creation de la nouvelle annee scolaire",
        (error as AppError).statusCode ?? 400,
        error as Error,
      );
      return;
    }
  }
}

export default InitialisationEtablissementApp;
