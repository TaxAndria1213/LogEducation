import { Application, Router, Request, Response as R, NextFunction } from "express";
import Response from "../../../common/app/response";
import RolesUserModel from "../models/roles_user.model";
import { UtilisateurRole } from "@prisma/client";


class RoleUserApp {
    public app: Application;
    public router: Router;
    //les model de données
    private rolesUserModel: RolesUserModel

    constructor(app: Application) {
        this.app = app;
        this.router = Router();
        this.rolesUserModel = new RolesUserModel();
        this.routes();
    }

    public routes(): Router {
        this.router.post('/', this.create.bind(this))

        return this.router;
    }

    private async create(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const body: UtilisateurRole = req.body;
            const result = await this.rolesUserModel.create(body);
            if (!result) throw new Error();
            Response.success(res, "Role affected to user successfully.", result);
        } catch (error) {
            console.log("🚀 ~ RoleUserApp ~ create ~ error:", error);
            Response.error(res, "Erreur lors de l'affectation du role au user", 400, error as Error);
            next(error);
        }
    }
};

export default RoleUserApp;