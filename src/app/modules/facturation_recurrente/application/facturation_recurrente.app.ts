import { Application, NextFunction, Request, Response as R, Router } from "express";
import Response from "../../../common/app/response";
import FacturationRecurrenteService from "./facturation_recurrente.service";

type RequestWithAuth = Request & {
  tenantId?: string;
  user?: {
    sub?: string;
  };
};

class FacturationRecurrenteApp {
  public app: Application;
  public router: Router;
  private service: FacturationRecurrenteService;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.service = new FacturationRecurrenteService();
    this.routes();
  }

  public routes(): Router {
    this.router.post("/generate", this.generate.bind(this));
    this.router.get("/readiness", this.getReadiness.bind(this));
    this.router.get("/history", this.getHistory.bind(this));
    return this.router;
  }

  private resolveTenantId(req: RequestWithAuth) {
    const tenantId = req.tenantId?.trim();
    if (!tenantId) {
      throw new Error("Aucun etablissement actif n'a ete fourni.");
    }
    return tenantId;
  }

  private resolveSenderId(req: RequestWithAuth) {
    return req.user?.sub?.trim() ?? null;
  }

  private async generate(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const request = req as RequestWithAuth;
      const tenantId = this.resolveTenantId(request);
      const senderId = this.resolveSenderId(request);
      const payload = this.service.normalizePayload(req.body as Record<string, unknown>);
      const result = await this.service.generateForTenant(tenantId, senderId, payload);
      Response.success(res, "Facturation recurrente generee.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la generation de la facturation recurrente", 400, error as Error);
      next(error);
    }
  }

  private async getHistory(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const request = req as RequestWithAuth;
      const tenantId = this.resolveTenantId(request);
      const result = await this.service.getHistory(tenantId, {
        take: typeof req.query.take === "string" ? Number(req.query.take) : 50,
        catalogue_frais_id:
          typeof req.query.catalogue_frais_id === "string" && req.query.catalogue_frais_id.trim()
            ? req.query.catalogue_frais_id.trim()
            : null,
        annee_scolaire_id:
          typeof req.query.annee_scolaire_id === "string" && req.query.annee_scolaire_id.trim()
            ? req.query.annee_scolaire_id.trim()
            : null,
      });
      Response.success(res, "Historique de la facturation recurrente.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation de l'historique de facturation recurrente", 400, error as Error);
      next(error);
    }
  }

  private async getReadiness(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const request = req as RequestWithAuth;
      const tenantId = this.resolveTenantId(request);
      const result = await this.service.getReadiness(tenantId, {
        annee_scolaire_id:
          typeof req.query.annee_scolaire_id === "string" && req.query.annee_scolaire_id.trim()
            ? req.query.annee_scolaire_id.trim()
            : null,
        date_reference:
          typeof req.query.date_reference === "string" && req.query.date_reference.trim()
            ? new Date(req.query.date_reference)
            : null,
      });
      Response.success(res, "Preparation de la facturation recurrente.", result);
    } catch (error) {
      Response.error(res, "Erreur lors du controle de preparation de la facturation recurrente", 400, error as Error);
      next(error);
    }
  }
}

export default FacturationRecurrenteApp;
