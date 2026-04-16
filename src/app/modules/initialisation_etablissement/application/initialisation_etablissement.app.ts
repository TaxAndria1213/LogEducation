import {
  Application,
  NextFunction,
  Request,
  Response as R,
  Router,
} from "express";
import Response from "../../../common/app/response";
import InitialisationEtablissementService from "./initialisation_etablissement.service";

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

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

  private getEtablissementId(req: Request): string {
    const requestBody =
      req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : {};

    const etablissementId =
      readString(req.query.etablissement_id) ??
      readString(requestBody.etablissement_id);

    if (!etablissementId) {
      throw new Error("L'etablissement cible est obligatoire.");
    }

    return etablissementId;
  }

  private async getStatus(req: Request, res: R, next: NextFunction) {
    try {
      const result = await this.service.getStatus(this.getEtablissementId(req));
      Response.success(res, "Etat d'initialisation recupere.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la lecture de l'etat d'initialisation",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async getTemplates(_req: Request, res: R, next: NextFunction) {
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
      next(error);
    }
  }

  private async getSessions(req: Request, res: R, next: NextFunction) {
    try {
      const result = await this.service.getSessions(this.getEtablissementId(req));
      Response.success(res, "Sessions d'initialisation recuperees.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la lecture des sessions d'initialisation",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async getSessionById(req: Request, res: R, next: NextFunction) {
    try {
      const result = await this.service.getSessionById(
        this.getEtablissementId(req),
        req.params.id,
      );
      Response.success(res, "Session d'initialisation recuperee.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la lecture de la session d'initialisation",
        404,
        error as Error,
      );
      next(error);
    }
  }

  private async previewInitialSetup(req: Request, res: R, next: NextFunction) {
    try {
      const result = await this.service.previewInitialSetup(req.body);
      Response.success(res, "Previsualisation initiale generee.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la previsualisation de l'initialisation",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async commitInitialSetup(req: Request, res: R, next: NextFunction) {
    try {
      const result = await this.service.commitInitialSetup(req.body);
      Response.success(res, "Initialisation de base executee.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors du commit de l'initialisation",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async previewNewSchoolYear(req: Request, res: R, next: NextFunction) {
    try {
      const result = await this.service.previewNewSchoolYear(req.body);
      Response.success(res, "Previsualisation de la nouvelle annee generee.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la previsualisation de la nouvelle annee",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async commitNewSchoolYear(req: Request, res: R, next: NextFunction) {
    try {
      const result = await this.service.commitNewSchoolYear(req.body);
      Response.success(res, "Nouvelle annee scolaire creee.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la creation de la nouvelle annee scolaire",
        400,
        error as Error,
      );
      next(error);
    }
  }
}

export default InitialisationEtablissementApp;
