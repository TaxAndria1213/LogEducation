import { Application, Router, Request, Response as R, NextFunction } from "express";
// import Response from "../../../common/app/response";


class TemplateApp {
    public app: Application;
    public router: Router;
    //les model de données

    constructor(app: Application) {
        this.app = app;
        this.router = Router();
        //initialiser les modèles ex: this.modelName = new ModelNameModel();
        this.routes();
    }

    public routes(): Router {
        //les requettes api rest
        this.router.post('/create', this.createTemplate.bind(this))

        return this.router;
    }

    //méthodes pour les requettes
    //ex:
    private async createTemplate(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            console.log("votre code ici");
            // Response.success(res, "Votre message", null);
        } catch (error) {
            next(error);
        }
    }
};

export default TemplateApp;