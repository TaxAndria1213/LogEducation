import { Application, Router, Request, Response as R, NextFunction } from "express";
import Response from "../../../common/app/response";
import RolesUserModel from "../models/roles_user.model";
import { Prisma, PrismaClient, UtilisateurRole } from "@prisma/client";
import { getAllPaginated } from "../../../common/utils/functions";

const prisma = new PrismaClient();

class RoleUserApp {
    public app: Application;
    public router: Router;
    private rolesUserModel: RolesUserModel;

    constructor(app: Application) {
        this.app = app;
        this.router = Router();
        this.rolesUserModel = new RolesUserModel();
        this.routes();
    }

    public routes(): Router {
        this.router.post("/", this.create.bind(this));
        this.router.get("/", this.getAll.bind(this));
        this.router.get("/:utilisateurId/:roleId", this.getOne.bind(this));
        this.router.put("/:utilisateurId/:roleId", this.update.bind(this));
        this.router.delete("/:utilisateurId/:roleId", this.delete.bind(this));

        return this.router;
    }

    private async create(req: Request, res: R): Promise<void> {
        try {
            const body: UtilisateurRole = req.body;
            const result = await this.rolesUserModel.create(body);

            if (!result) {
                throw new Error("Affectation role-utilisateur introuvable apres creation.");
            }

            Response.success(res, "Role affected to user successfully.", result);
        } catch (error) {
            console.log("RoleUserApp create error:", error);
            Response.error(
                res,
                "Erreur lors de l'affectation du role au user",
                400,
                error as Error,
            );
        }
    }

    private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const result = await getAllPaginated(req.query, this.rolesUserModel);
            Response.success(res, "Liste des affectations role-utilisateur.", result);
        } catch (error) {
            next(error);
        }
    }

    private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const result = await prisma.utilisateurRole.findUnique({
                where: {
                    utilisateur_id_role_id: {
                        utilisateur_id: req.params.utilisateurId,
                        role_id: req.params.roleId,
                    },
                },
                include: {
                    role: true,
                    utilisateur: {
                        include: {
                            profil: true,
                        },
                    },
                },
            });

            Response.success(res, "Detail de l'affectation role-utilisateur.", result);
        } catch (error) {
            next(error);
        }
    }

    private async update(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const body = req.body as Partial<UtilisateurRole>;
            const result = await prisma.utilisateurRole.update({
                where: {
                    utilisateur_id_role_id: {
                        utilisateur_id: req.params.utilisateurId,
                        role_id: req.params.roleId,
                    },
                },
                data: {
                    scope_json:
                        body.scope_json == null
                            ? Prisma.JsonNull
                            : (body.scope_json as Prisma.InputJsonValue),
                },
            });

            Response.success(res, "Affectation role-utilisateur mise a jour.", result);
        } catch (error) {
            next(error);
        }
    }

    private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
        try {
            const result = await prisma.utilisateurRole.delete({
                where: {
                    utilisateur_id_role_id: {
                        utilisateur_id: req.params.utilisateurId,
                        role_id: req.params.roleId,
                    },
                },
            });

            Response.success(res, "Role retire a l'utilisateur.", result);
        } catch (error) {
            next(error);
        }
    }
}

export default RoleUserApp;
