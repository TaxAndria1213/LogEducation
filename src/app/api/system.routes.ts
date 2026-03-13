import { Application, Router } from "express";

export class SystemApiRoutes {
  public app: Application;
  private router: Router;


  constructor(apiApp: Application) {
    this.app = apiApp;
    this.router = Router();
    this.routes();
  }

  public routes(): Router {

    return this.router;
  }
}