import { Application, NextFunction, Request, Response as R, Router } from "express";
import { FormuleCantine } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import FormuleCantineModel from "../models/formule_cantine.model";

class FormuleCantineApp {
  public app: Application;
  public router: Router;
  private formuleCantine: FormuleCantineModel;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.formuleCantine = new FormuleCantineModel();
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
      const data: FormuleCantine = req.body;
      const result = await this.formuleCantine.create(data);
      Response.success(res, "Formule de cantine creee.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la creation de la formule de cantine",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const result = await getAllPaginated(req.query, this.formuleCantine);
      Response.success(res, "Formules de cantine.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation des formules de cantine",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const id: string = req.params.id;
      const result = await this.formuleCantine.findUnique(id);
      Response.success(res, "Formule de cantine.", result);
    } catch (error) {
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const id: string = req.params.id;
      const result = await this.formuleCantine.delete(id);
      Response.success(res, "Formule de cantine supprimee.", result);
    } catch (error) {
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const id: string = req.params.id;
      const data: FormuleCantine = req.body;
      const result = await this.formuleCantine.update(id, data);
      Response.success(res, "Formule de cantine mise a jour.", result);
    } catch (error) {
      next(error);
    }
  }
}

export default FormuleCantineApp;
