/* eslint-disable @typescript-eslint/no-explicit-any */
import { Application, Router, Request, Response as R, NextFunction } from "express";
import Response from "../../../common/app/response";
import RolesModel from "../models/roles.model";
import { Role } from "@prisma/client";
import { getAllPaginated } from "../../../common/utils/functions";


class RolesApp {
    public app: Application;
    public router: Router;
    //les model de données
    private rolesModel: RolesModel;

    constructor(app: Application) {
        this.app = app;
        this.router = Router();
        this.rolesModel = new RolesModel();
        this.routes();
    }

    public routes(): Router {
        //les requettes api rest
        this.router.post('/', this.create.bind(this))
        this.router.get('/', this.getAll.bind(this));

        return this.router;
    }

    //méthodes pour les requettes
    //ex:
    private async create(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const body: Role = req.body;
            console.log("🚀 ~ RolesApp ~ create ~ body:", body)
            const result = await this.rolesModel.create(body);
            Response.success(res, "Role created successfully", result);
        } catch (error) {
            next(error);
        }
    }

    private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
      const result = await getAllPaginated(req.query, this.rolesModel);
      Response.success(res, "Data user.", result)
    } catch (error) {
      next(error);
    }
    }
    
    public async getRolesList(options: Record<string, any> ): Promise<Role[] | null> {
        const result = await this.rolesModel.findMany(options) as Role[];
        return result
    }
};


export default RolesApp;