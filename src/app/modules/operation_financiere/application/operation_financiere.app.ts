import { Application, NextFunction, Request, Response as R, Router } from "express";
import { PrismaClient } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import OperationFinanciereModel from "../models/operation_financiere.model";
import { prisma } from "../../../service/prisma";

class OperationFinanciereApp {
  public app: Application;
  public router: Router;
  private operationFinanciere: OperationFinanciereModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.operationFinanciere = new OperationFinanciereModel();
    this.prisma = prisma;
    this.routes();
  }

  public routes(): Router {
    this.router.get("/", this.getAll.bind(this));
    this.router.get("/:id", this.getOne.bind(this));
    return this.router;
  }

  private resolveTenantId(req: Request): string {
    const requestTenant = (req as Request & { tenantId?: string }).tenantId;
    const queryWhere = parseJSON<Record<string, unknown>>(req.query.where, {});
    const queryTenant =
      typeof queryWhere?.etablissement_id === "string"
        ? queryWhere.etablissement_id.trim()
        : undefined;

    const tenantCandidates = [requestTenant, queryTenant].filter(
      (value): value is string => Boolean(value),
    );

    if (tenantCandidates.length === 0) {
      throw new Error("Aucun etablissement actif n'a ete fourni.");
    }

    if (new Set(tenantCandidates).size > 1) {
      throw new Error("Conflit d'etablissement detecte pour le journal financier.");
    }

    return tenantCandidates[0];
  }

  private buildScopedWhere(existingWhere: Record<string, unknown>, tenantId: string) {
    if (!existingWhere || Object.keys(existingWhere).length === 0) {
      return { etablissement_id: tenantId };
    }

    return {
      AND: [existingWhere, { etablissement_id: tenantId }],
    };
  }

  private getInclude() {
    return {
      facture: {
        include: {
          eleve: {
            include: {
              utilisateur: {
                include: {
                  profil: true,
                },
              },
            },
          },
        },
      },
      paiement: true,
      abonnementCantine: {
        include: {
          eleve: {
            include: {
              utilisateur: {
                include: {
                  profil: true,
                },
              },
            },
          },
          formule: true,
        },
      },
      createur: {
        include: {
          profil: true,
        },
      },
    };
  }

  private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const where = parseJSON<Record<string, unknown>>(req.query.where, {});
      const scopedQuery = {
        ...req.query,
        where: JSON.stringify(this.buildScopedWhere(where, tenantId)),
        orderBy:
          req.query.orderBy ??
          JSON.stringify([{ created_at: "desc" }, { updated_at: "desc" }]),
        includeSpec: req.query.includeSpec ?? JSON.stringify(this.getInclude()),
      };
      const result = await getAllPaginated(
        scopedQuery as typeof req.query,
        this.operationFinanciere,
      );
      Response.success(res, "Journal financier recupere.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation du journal financier",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const includeSpec = parseJSON<Record<string, unknown>>(
        req.query.includeSpec,
        this.getInclude(),
      );
      const result = await this.prisma.operationFinanciere.findFirst({
        where: { id: req.params.id, etablissement_id: tenantId },
        include: includeSpec,
      });

      if (!result) {
        throw new Error("Operation financiere introuvable pour cet etablissement.");
      }

      Response.success(res, "Detail de l'operation financiere.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation de l'operation financiere",
        404,
        error as Error,
      );
      next(error);
    }
  }
}

export default OperationFinanciereApp;

