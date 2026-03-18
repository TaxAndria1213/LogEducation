/* eslint-disable @typescript-eslint/no-explicit-any */
import { Application, Router, Request, Response as R, NextFunction } from "express";
import Response from "../../../common/app/response";
import PermissionModel from "../models/permission.model";
import { Permission } from "@prisma/client";
import { getAllPaginated } from "../../../common/utils/functions";
import { isSystemPermissionCode } from "../utils/system_permission_codes";

class PermissionApp {
    public app: Application;
    public router: Router;
    private permissionModel: PermissionModel;

    constructor(app: Application) {
        this.app = app;
        this.router = Router();
        this.permissionModel = new PermissionModel();
        this.routes();
    }

    public routes(): Router {
        this.router.post("/", this.create.bind(this));
        this.router.get("/", this.getAll.bind(this));
        this.router.get("/:id", this.getOne.bind(this));
        this.router.put("/:id", this.update.bind(this));
        this.router.delete("/:id", this.delete.bind(this));

        return this.router;
    }

    private normalizeBody(body: Partial<Permission>) {
        return {
            ...body,
            code: typeof body.code === "string" ? body.code.trim() : body.code,
            description:
                typeof body.description === "string"
                    ? body.description.trim() || null
                    : body.description,
        };
    }

    private async create(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const body = this.normalizeBody(req.body as Permission);
            if (!body.etablissement_id) {
                return Response.error(
                    res,
                    "Une permission personnalisee doit etre rattachee a un etablissement.",
                    400,
                    new Error("missing etablissement_id"),
                );
            }
            if (isSystemPermissionCode(body.code)) {
                return Response.error(
                    res,
                    "Cette permission correspond deja a une permission systeme. Ajoute uniquement des permissions personnalisees.",
                    400,
                    new Error("system permission code cannot be persisted"),
                );
            }
            const result = await this.permissionModel.create(body);
            Response.success(res, "Permission created successfully", result);
        } catch (error) {
            next(error);
        }
    }

    private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const result = await getAllPaginated(req.query, this.permissionModel);
            Response.success(res, "Permission list.", result);
        } catch (error) {
            next(error);
        }
    }

    private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const result = await this.permissionModel.findUnique(req.params.id);
            Response.success(res, "Permission detail.", result);
        } catch (error) {
            next(error);
        }
    }

    private async update(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const body = this.normalizeBody(req.body as Partial<Permission>);
            if (Object.prototype.hasOwnProperty.call(body, "etablissement_id") && !body.etablissement_id) {
                return Response.error(
                    res,
                    "Une permission personnalisee doit rester rattachee a un etablissement.",
                    400,
                    new Error("missing etablissement_id"),
                );
            }
            if (isSystemPermissionCode(body?.code)) {
                return Response.error(
                    res,
                    "Cette permission correspond deja a une permission systeme. Modifie uniquement des permissions personnalisees.",
                    400,
                    new Error("system permission code cannot be persisted"),
                );
            }
            const result = await this.permissionModel.update(req.params.id, body);
            Response.success(res, "Permission updated successfully", result);
        } catch (error) {
            next(error);
        }
    }

    private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const result = await this.permissionModel.delete(req.params.id);
            Response.success(res, "Permission deleted successfully", result);
        } catch (error) {
            next(error);
        }
    }
}

export default PermissionApp;
