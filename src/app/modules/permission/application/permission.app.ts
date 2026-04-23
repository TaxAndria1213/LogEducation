/* eslint-disable @typescript-eslint/no-explicit-any */
import { Application, Router, Request, Response as R, NextFunction } from "express";
import { Permission, PrismaClient } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import {
  mergeScopedWhere,
  resolveTenantContext,
  type TenantScopedRequest,
} from "../../../common/utils/requestTenantScope";
import { prisma } from "../../../service/prisma";
import PermissionModel from "../models/permission.model";
import { isSystemPermissionCode } from "../utils/system_permission_codes";

class PermissionApp {
  public app: Application;
  public router: Router;
  private permissionModel: PermissionModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.permissionModel = new PermissionModel();
    this.prisma = prisma;
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

  private resolveTenant(req: TenantScopedRequest) {
    return resolveTenantContext(req, {
      allowBodyTenant: true,
      missingMessage: "Aucun etablissement actif n'a ete fourni pour les permissions.",
      conflictMessage: "Conflit d'etablissement detecte pour les permissions.",
    });
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

  private async getScopedPermission(id: string, tenantId: string) {
    return this.prisma.permission.findFirst({
      where: {
        id,
        etablissement_id: tenantId,
      },
    });
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenant = this.resolveTenant(req as TenantScopedRequest);
      if (!tenant.ok) {
        Response.error(res, tenant.message, tenant.statusCode, new Error("tenant scope error"));
        return;
      }

      const body = this.normalizeBody({
        ...(req.body as Permission),
        etablissement_id: tenant.tenantId,
      });

      if (isSystemPermissionCode(body.code)) {
        Response.error(
          res,
          "Cette permission correspond deja a une permission systeme. Ajoute uniquement des permissions personnalisees.",
          400,
          new Error("system permission code cannot be persisted"),
        );
        return;
      }

      const result = await this.permissionModel.create(body);
      Response.success(res, "Permission created successfully", result);
    } catch (error) {
      next(error);
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
        mergeScopedWhere(tenant.queryWhere, { etablissement_id: tenant.tenantId }),
      );

      const result = await getAllPaginated(req.query, this.permissionModel);
      Response.success(res, "Permission list.", result);
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

      const result = await this.getScopedPermission(req.params.id, tenant.tenantId);
      if (!result) {
        Response.error(
          res,
          "Permission introuvable dans cet etablissement.",
          404,
          new Error("permission not found"),
        );
        return;
      }

      Response.success(res, "Permission detail.", result);
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

      const existing = await this.getScopedPermission(req.params.id, tenant.tenantId);
      if (!existing) {
        Response.error(
          res,
          "Permission introuvable dans cet etablissement.",
          404,
          new Error("permission not found"),
        );
        return;
      }

      const body = this.normalizeBody({
        ...(req.body as Partial<Permission>),
        etablissement_id: tenant.tenantId,
      });

      if (isSystemPermissionCode(body?.code)) {
        Response.error(
          res,
          "Cette permission correspond deja a une permission systeme. Modifie uniquement des permissions personnalisees.",
          400,
          new Error("system permission code cannot be persisted"),
        );
        return;
      }

      const result = await this.permissionModel.update(req.params.id, body);
      Response.success(res, "Permission updated successfully", result);
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

      const existing = await this.getScopedPermission(req.params.id, tenant.tenantId);
      if (!existing) {
        Response.error(
          res,
          "Permission introuvable dans cet etablissement.",
          404,
          new Error("permission not found"),
        );
        return;
      }

      const result = await this.permissionModel.delete(req.params.id);
      Response.success(res, "Permission deleted successfully", result);
    } catch (error) {
      next(error);
    }
  }
}

export default PermissionApp;
