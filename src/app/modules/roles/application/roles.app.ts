/* eslint-disable @typescript-eslint/no-explicit-any */
import { Application, Router, Request, Response as R, NextFunction } from "express";
import { PrismaClient, Role } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import {
  mergeScopedWhere,
  resolveTenantContext,
  type TenantScopedRequest,
} from "../../../common/utils/requestTenantScope";
import { prisma } from "../../../service/prisma";
import RolesModel from "../models/roles.model";

function normalizeRoleGuardToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, " ");
}

function isForbiddenAdminRoleName(value: unknown) {
  if (typeof value !== "string") return false;
  return ["ADMIN", "ADMINISTRATEUR", "ADMINISTRATOR", "SUPER ADMIN", "SUPERADMIN"].includes(
    normalizeRoleGuardToken(value),
  );
}

function parseScopeJson(value: unknown): Record<string, unknown> | null {
  if (!value) return null;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  return typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readScopePermissions(scope: Record<string, unknown> | null) {
  const rawPermissions = scope?.permissions;
  if (!Array.isArray(rawPermissions)) return [];

  return rawPermissions.filter((permission): permission is string => typeof permission === "string");
}

function isForbiddenAdminPermission(value: string) {
  const normalized = value.trim().toUpperCase();
  return normalized === "ADM" || normalized === "ADM.*" || normalized.startsWith("ADM.");
}

function assertEstablishmentRoleIsAllowed(payload: { nom?: unknown; scope_json?: unknown }) {
  if (isForbiddenAdminRoleName(payload.nom)) {
    throw new Error(
      "Le role administrateur est reserve a la plateforme et ne peut pas etre cree dans un etablissement.",
    );
  }

  const scope = parseScopeJson(payload.scope_json);
  if (
    isForbiddenAdminRoleName(scope?.role_template) ||
    isForbiddenAdminRoleName(scope?.role_template_label)
  ) {
    throw new Error(
      "Le modele administrateur est reserve a la plateforme et ne peut pas etre attribue a un etablissement.",
    );
  }

  if (readScopePermissions(scope).some(isForbiddenAdminPermission)) {
    throw new Error(
      "Les permissions d'administration globale sont reservees a la plateforme.",
    );
  }
}

class RolesApp {
  public app: Application;
  public router: Router;
  private rolesModel: RolesModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.rolesModel = new RolesModel();
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
      missingMessage: "Aucun etablissement actif n'a ete fourni pour les roles.",
      conflictMessage: "Conflit d'etablissement detecte pour les roles.",
    });
  }

  private async getScopedRole(id: string, tenantId: string) {
    return this.prisma.role.findFirst({
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

      const body: Role = {
        ...(req.body as Role),
        etablissement_id: tenant.tenantId,
      };

      assertEstablishmentRoleIsAllowed(body);
      const result = await this.rolesModel.create(body);
      Response.success(res, "Role created successfully", result);
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

      const result = await getAllPaginated(req.query, this.rolesModel);
      Response.success(res, "Data user.", result);
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

      const result = await this.getScopedRole(req.params.id, tenant.tenantId);
      if (!result) {
        Response.error(res, "Role introuvable dans cet etablissement.", 404, new Error("role not found"));
        return;
      }

      Response.success(res, "Role detail.", result);
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

      const existing = await this.getScopedRole(req.params.id, tenant.tenantId);
      if (!existing) {
        Response.error(res, "Role introuvable dans cet etablissement.", 404, new Error("role not found"));
        return;
      }

      const body = {
        ...(req.body as Partial<Role>),
        etablissement_id: tenant.tenantId,
      };

      assertEstablishmentRoleIsAllowed(body);
      const result = await this.rolesModel.update(req.params.id, body);
      Response.success(res, "Role updated successfully", result);
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

      const existing = await this.getScopedRole(req.params.id, tenant.tenantId);
      if (!existing) {
        Response.error(res, "Role introuvable dans cet etablissement.", 404, new Error("role not found"));
        return;
      }

      const result = await this.rolesModel.delete(req.params.id);
      Response.success(res, "Role deleted successfully", result);
    } catch (error) {
      next(error);
    }
  }

  public async getRolesList(options: Record<string, any>): Promise<Role[] | null> {
    const result = (await this.rolesModel.findMany(options)) as Role[];
    return result;
  }
}

export default RolesApp;
