import { Application, NextFunction, Request, Response as R, Router } from "express";
import { LigneTransport } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import LigneTransportModel from "../models/ligne_transport.model";

class LigneTransportApp {
  public app: Application;
  public router: Router;
  private ligneTransport: LigneTransportModel;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.ligneTransport = new LigneTransportModel();
    this.routes();
  }

  public routes(): Router {
    this.router.post("/", this.create.bind(this));
    this.router.get("/", this.getAll.bind(this));
    this.router.get("/:id", this.getOne.bind(this));
    this.router.delete("/:id", this.delete.bind(this));
    this.router.put("/:id", this.update.bind(this));

    return this.router;
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const data: LigneTransport = req.body;
      const result = await this.ligneTransport.create(data);
      Response.success(res, "Ligne de transport creee.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la creation de la ligne de transport",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const result = await getAllPaginated(req.query, this.ligneTransport);
      Response.success(res, "Lignes de transport.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation des lignes de transport",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const id: string = req.params.id;
      const result = await this.ligneTransport.findUnique(id);
      Response.success(res, "Ligne de transport.", result);
    } catch (error) {
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const id: string = req.params.id;
      const result = await this.ligneTransport.delete(id);
      Response.success(res, "Ligne de transport supprimee.", result);
    } catch (error) {
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const id: string = req.params.id;
      const data: LigneTransport = req.body;
      const result = await this.ligneTransport.update(id, data);
      Response.success(res, "Ligne de transport mise a jour.", result);
    } catch (error) {
      next(error);
    }
  }
}

export default LigneTransportApp;
