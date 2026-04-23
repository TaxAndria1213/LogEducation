import { Application, NextFunction, Request, Response as R, Router } from "express";
import { PrismaClient, type Matiere } from "@prisma/client";
import Response from "../../../common/app/response";
import MatiereModel from "../models/matiere.model";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import { prisma } from "../../../service/prisma";

type MatierePayload = Pick<
  Matiere,
  "etablissement_id" | "code" | "nom" | "departement_id"
>;

class MatiereApp {
  public app: Application;
  public router: Router;
  private matiere: MatiereModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.matiere = new MatiereModel();
    this.prisma = prisma;
    this.routes();
  }

  public routes(): Router {
    this.router.post("/", this.create.bind(this));
    this.router.get("/", this.getAll.bind(this));
    this.router.get("/:id", this.getOne.bind(this));
    this.router.delete("/:id", this.delete.bind(this));
    this.router.put("/:id", this.update.bind(this));
    return this.router;
  }

  private resolveTenantId(req: Request): string {
    const requestTenant = (req as Request & { tenantId?: string }).tenantId;
    const bodyTenant =
      typeof req.body?.etablissement_id === "string"
        ? req.body.etablissement_id.trim()
        : undefined;
    const queryWhere = parseJSON<Record<string, unknown>>(req.query.where, {});
    const queryTenant =
      typeof queryWhere?.etablissement_id === "string"
        ? queryWhere.etablissement_id.trim()
        : undefined;

    const tenantCandidates = [requestTenant, bodyTenant, queryTenant].filter(
      (value): value is string => Boolean(value),
    );

    if (tenantCandidates.length === 0) {
      throw new Error("Aucun etablissement actif n'a ete fourni.");
    }

    if (new Set(tenantCandidates).size > 1) {
      throw new Error("Conflit d'etablissement detecte pour la matiere.");
    }

    return tenantCandidates[0];
  }

  private normalizePayload(raw: Partial<Matiere>, tenantId: string): MatierePayload {
    const normalizedName =
      typeof raw.nom === "string" ? raw.nom.trim().replace(/\s+/g, " ") : "";

    if (!normalizedName) {
      throw new Error("Le nom de la matiere est requis.");
    }

    const normalizedCode =
      typeof raw.code === "string"
        ? raw.code.trim().replace(/\s+/g, " ").toUpperCase()
        : "";

    const normalizedDepartementId =
      typeof raw.departement_id === "string" && raw.departement_id.trim()
        ? raw.departement_id.trim()
        : null;

    return {
      etablissement_id: tenantId,
      nom: normalizedName,
      code: normalizedCode || null,
      departement_id: normalizedDepartementId,
    };
  }

  private async validateDepartement(
    departementId: string | null,
    tenantId: string,
  ): Promise<void> {
    if (!departementId) return;

    const departement = await this.prisma.departement.findFirst({
      where: {
        id: departementId,
        etablissement_id: tenantId,
      },
      select: { id: true },
    });

    if (!departement) {
      throw new Error(
        "Le departement selectionne n'appartient pas a l'etablissement actif.",
      );
    }
  }

  private async ensureUniqueMatiere(
    data: MatierePayload,
    excludeId?: string,
  ): Promise<void> {
    const baseWhere = excludeId ? { id: { not: excludeId } } : {};

    const duplicateByName = await this.prisma.matiere.findFirst({
      where: {
        ...baseWhere,
        etablissement_id: data.etablissement_id,
        nom: data.nom,
      },
      select: { id: true },
    });

    if (duplicateByName) {
      throw new Error(
        "Une matiere avec ce nom existe deja dans cet etablissement.",
      );
    }

    if (!data.code) return;

    const duplicateByCode = await this.prisma.matiere.findFirst({
      where: {
        ...baseWhere,
        etablissement_id: data.etablissement_id,
        code: data.code,
      },
      select: { id: true },
    });

    if (duplicateByCode) {
      throw new Error(
        "Une matiere avec ce code existe deja dans cet etablissement.",
      );
    }
  }

  private async getScopedMatiere(id: string, tenantId: string) {
    return this.prisma.matiere.findFirst({
      where: {
        id,
        etablissement_id: tenantId,
      },
    });
  }

  private buildScopedWhere(
    existingWhere: Record<string, unknown>,
    tenantId: string,
  ): Record<string, unknown> {
    if (!existingWhere || Object.keys(existingWhere).length === 0) {
      return { etablissement_id: tenantId };
    }

    return {
      AND: [existingWhere, { etablissement_id: tenantId }],
    };
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const data = this.normalizePayload(req.body, tenantId);

      await this.validateDepartement(data.departement_id, tenantId);
      await this.ensureUniqueMatiere(data);

      const result = await this.matiere.create(data);
      Response.success(res, "Matiere creee avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la creation de la matiere",
        400,
        error as Error,
      );
      next(error);
    }
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
          JSON.stringify([{ nom: "asc" }, { created_at: "desc" }]),
      };

      const result = await getAllPaginated(scopedQuery as typeof req.query, this.matiere);
      Response.success(res, "Liste des matieres recuperee.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation des matieres",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const id = req.params.id;
      const includeSpec = parseJSON<Record<string, unknown>>(req.query.includeSpec, {
        departement: true,
      });

      const result = await this.prisma.matiere.findFirst({
        where: {
          id,
          etablissement_id: tenantId,
        },
        include: includeSpec,
      });

      if (!result) {
        throw new Error("Matiere introuvable pour cet etablissement.");
      }

      Response.success(res, "Detail de la matiere.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation de la matiere",
        404,
        error as Error,
      );
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const id = req.params.id;

      const existing = await this.prisma.matiere.findFirst({
        where: {
          id,
          etablissement_id: tenantId,
        },
        include: {
          _count: {
            select: {
              cours: true,
              lignesProgramme: true,
              lignesBulletin: true,
              EmploiDuTemps: true,
            },
          },
        },
      });

      if (!existing) {
        throw new Error("Matiere introuvable pour cet etablissement.");
      }

      const blockingRelations: string[] = [];

      if (existing._count.cours > 0) {
        blockingRelations.push(`${existing._count.cours} cours`);
      }
      if (existing._count.lignesProgramme > 0) {
        blockingRelations.push(`${existing._count.lignesProgramme} ligne(s) de programme`);
      }
      if (existing._count.lignesBulletin > 0) {
        blockingRelations.push(`${existing._count.lignesBulletin} ligne(s) de bulletin`);
      }
      if (existing._count.EmploiDuTemps > 0) {
        blockingRelations.push(
          `${existing._count.EmploiDuTemps} element(s) d'emploi du temps`,
        );
      }

      if (blockingRelations.length > 0) {
        throw new Error(
          `Suppression impossible: cette matiere est encore utilisee dans ${blockingRelations.join(", ")}.`,
        );
      }

      const result = await this.matiere.delete(id);
      Response.success(res, "Matiere supprimee avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la suppression de la matiere",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const id = req.params.id;

      const existing = await this.getScopedMatiere(id, tenantId);
      if (!existing) {
        throw new Error("Matiere introuvable pour cet etablissement.");
      }

      const data = this.normalizePayload(req.body, tenantId);

      await this.validateDepartement(data.departement_id, tenantId);
      await this.ensureUniqueMatiere(data, id);

      const result = await this.matiere.update(id, data);
      Response.success(res, "Matiere mise a jour avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la mise a jour de la matiere",
        400,
        error as Error,
      );
      next(error);
    }
  }
}

export default MatiereApp;


