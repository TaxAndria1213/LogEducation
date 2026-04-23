import { Application, Router, Request, Response as R, NextFunction } from "express";
import { Prisma, PrismaClient, UtilisateurRole } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import {
  mergeScopedWhere,
  resolveTenantContext,
  type TenantScopedRequest,
} from "../../../common/utils/requestTenantScope";
import { prisma } from "../../../service/prisma";
import { sanitizeUserResponse } from "../../user/application/user.sanitizer";
import RolesUserModel from "../models/roles_user.model";

class RoleUserApp {
  public app: Application;
  public router: Router;
  private rolesUserModel: RolesUserModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.rolesUserModel = new RolesUserModel();
    this.prisma = prisma;
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

  private resolveTenant(req: TenantScopedRequest) {
    return resolveTenantContext(req, {
      missingMessage: "Aucun etablissement actif n'a ete fourni pour les affectations.",
      conflictMessage: "Conflit d'etablissement detecte pour les affectations.",
    });
  }

  private async ensureScopedUserAndRole(utilisateurId: string, roleId: string, tenantId: string) {
    const [user, role] = await Promise.all([
      this.prisma.utilisateur.findFirst({
        where: {
          id: utilisateurId,
          etablissement_id: tenantId,
        },
        select: { id: true },
      }),
      this.prisma.role.findFirst({
        where: {
          id: roleId,
          etablissement_id: tenantId,
        },
        select: { id: true },
      }),
    ]);

    if (!user) {
      throw new Error("Utilisateur introuvable dans cet etablissement.");
    }

    if (!role) {
      throw new Error("Role introuvable dans cet etablissement.");
    }
  }

  private async getScopedAssignment(utilisateurId: string, roleId: string, tenantId: string) {
    return this.prisma.utilisateurRole.findFirst({
      where: {
        utilisateur_id: utilisateurId,
        role_id: roleId,
        utilisateur: {
          is: {
            etablissement_id: tenantId,
          },
        },
        role: {
          is: {
            etablissement_id: tenantId,
          },
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
  }

  private async create(req: Request, res: R): Promise<void> {
    try {
      const tenant = this.resolveTenant(req as TenantScopedRequest);
      if (!tenant.ok) {
        Response.error(res, tenant.message, tenant.statusCode, new Error("tenant scope error"));
        return;
      }

      const body: UtilisateurRole = req.body;
      await this.ensureScopedUserAndRole(body.utilisateur_id, body.role_id, tenant.tenantId);
      const result = await this.rolesUserModel.create(body);

      if (!result) {
        throw new Error("Affectation role-utilisateur introuvable apres creation.");
      }

      Response.success(res, "Role affected to user successfully.", sanitizeUserResponse(result));
    } catch (error) {
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
      const tenant = this.resolveTenant(req as TenantScopedRequest);
      if (!tenant.ok) {
        Response.error(res, tenant.message, tenant.statusCode, new Error("tenant scope error"));
        return;
      }

      req.query.where = JSON.stringify(
        mergeScopedWhere(tenant.queryWhere, {
          utilisateur: {
            is: {
              etablissement_id: tenant.tenantId,
            },
          },
          role: {
            is: {
              etablissement_id: tenant.tenantId,
            },
          },
        }),
      );

      const result = await getAllPaginated(req.query, this.rolesUserModel);
      Response.success(
        res,
        "Liste des affectations role-utilisateur.",
        sanitizeUserResponse(result),
      );
    } catch (error) {
      next(error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenant = this.resolveTenant(req as TenantScopedRequest);
      if (!tenant.ok) {
        Response.error(res, tenant.message, tenant.statusCode, new Error("tenant scope error"));
        return;
      }

      const result = await this.getScopedAssignment(
        req.params.utilisateurId,
        req.params.roleId,
        tenant.tenantId,
      );

      if (!result) {
        Response.error(
          res,
          "Affectation role-utilisateur introuvable dans cet etablissement.",
          404,
          new Error("assignment not found"),
        );
        return;
      }

      Response.success(
        res,
        "Detail de l'affectation role-utilisateur.",
        sanitizeUserResponse(result),
      );
    } catch (error) {
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenant = this.resolveTenant(req as TenantScopedRequest);
      if (!tenant.ok) {
        Response.error(res, tenant.message, tenant.statusCode, new Error("tenant scope error"));
        return;
      }

      const existing = await this.getScopedAssignment(
        req.params.utilisateurId,
        req.params.roleId,
        tenant.tenantId,
      );

      if (!existing) {
        Response.error(
          res,
          "Affectation role-utilisateur introuvable dans cet etablissement.",
          404,
          new Error("assignment not found"),
        );
        return;
      }

      const body = req.body as Partial<UtilisateurRole>;
      const result = await this.prisma.utilisateurRole.update({
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

      Response.success(
        res,
        "Affectation role-utilisateur mise a jour.",
        sanitizeUserResponse(result),
      );
    } catch (error) {
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenant = this.resolveTenant(req as TenantScopedRequest);
      if (!tenant.ok) {
        Response.error(res, tenant.message, tenant.statusCode, new Error("tenant scope error"));
        return;
      }

      const existing = await this.getScopedAssignment(
        req.params.utilisateurId,
        req.params.roleId,
        tenant.tenantId,
      );

      if (!existing) {
        Response.error(
          res,
          "Affectation role-utilisateur introuvable dans cet etablissement.",
          404,
          new Error("assignment not found"),
        );
        return;
      }

      const result = await this.prisma.utilisateurRole.delete({
        where: {
          utilisateur_id_role_id: {
            utilisateur_id: req.params.utilisateurId,
            role_id: req.params.roleId,
          },
        },
      });

      Response.success(res, "Role retire a l'utilisateur.", sanitizeUserResponse(result));
    } catch (error) {
      next(error);
    }
  }
}

export default RoleUserApp;
