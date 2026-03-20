import { Application, NextFunction, Request, Response as R, Router } from "express";
import { ArretTransport } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import ArretTransportModel from "../models/arret_transport.model";

class ArretTransportApp {
  public app: Application;
  public router: Router;
  private arretTransport: ArretTransportModel;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.arretTransport = new ArretTransportModel();
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
      const data: ArretTransport = req.body;
      const result = await this.arretTransport.create(data);
      Response.success(res, "Arret de transport cree.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la creation de l'arret de transport",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const result = await getAllPaginated(req.query, this.arretTransport);
      Response.success(res, "Arrets de transport.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation des arrets de transport",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const id: string = req.params.id;
      const result = await this.arretTransport.findUnique(id);
      Response.success(res, "Arret de transport.", result);
    } catch (error) {
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const id: string = req.params.id;
      const result = await this.arretTransport.delete(id);
      Response.success(res, "Arret de transport supprime.", result);
    } catch (error) {
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const id: string = req.params.id;
      const data: ArretTransport = req.body;
      const result = await this.arretTransport.update(id, data);
      Response.success(res, "Arret de transport mis a jour.", result);
    } catch (error) {
      next(error);
    }
  }
}

export default ArretTransportApp;
