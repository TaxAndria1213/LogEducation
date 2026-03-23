import { Application, NextFunction, Request, Response as R, Router } from "express";
import type { Referenciel } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { prisma } from "../../../service/prisma";
import ReferencielModel from "../models/referenciel.model";
import {
  getReferentialDefinition,
  REFERENTIAL_CATALOG,
  REFERENTIAL_CODES,
} from "../referenciel.catalog";

class ReferencielApp {
  public app: Application;
  public router: Router;
  private referenciel: ReferencielModel;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.referenciel = new ReferencielModel();
    this.routes();
  }

  public routes(): Router {
    this.router.get("/catalog", this.getCatalog.bind(this));
    this.router.get("/values/:code", this.getValues.bind(this));
    this.router.post("/values/:code", this.createValue.bind(this));
    this.router.put("/values/item/:id", this.updateValue.bind(this));
    this.router.delete("/values/item/:id", this.deleteValue.bind(this));

    this.router.post("/", this.create.bind(this));
    this.router.get("/", this.getAll.bind(this));
    this.router.get("/:id", this.getOne.bind(this));
    this.router.delete("/:id", this.delete.bind(this));
    this.router.put("/:id", this.update.bind(this));

    return this.router;
  }

  private resolveTenantId(req: Request): string {
    const tenantId = (req as Request & { tenantId?: string }).tenantId;
    if (!tenantId) {
      throw new Error("Aucun etablissement actif n'a ete fourni.");
    }
    return tenantId;
  }

  private normalizeValue(rawValue: unknown): string {
    if (typeof rawValue !== "string") {
      throw new Error("La valeur du referentiel est requise.");
    }

    const value = rawValue.trim().replace(/\s+/g, " ");
    if (!value) {
      throw new Error("La valeur du referentiel est requise.");
    }

    return value;
  }

  private async ensureCategory(code: string) {
    const definition = getReferentialDefinition(code);
    if (!definition) {
      throw new Error("Code de referentiel inconnu.");
    }

    const existing = await prisma.referenciel.findFirst({
      where: { code: definition.code },
    });

    if (existing) {
      if (existing.titre !== definition.titre) {
        return prisma.referenciel.update({
          where: { id: existing.id },
          data: {
            titre: definition.titre,
            code: definition.code,
          },
        });
      }

      return existing;
    }

    return prisma.referenciel.create({
      data: {
        titre: definition.titre,
        code: definition.code,
      },
    });
  }

  private buildCategoryWhere(categoryId: string) {
    return {
      OR: [{ referenciel_id: categoryId }, { referencielId: categoryId }],
    };
  }

  private async getCatalog(
    req: Request,
    res: R,
    next: NextFunction,
  ): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);

      const categories = await Promise.all(
        REFERENTIAL_CATALOG.map(async (definition) => {
          const category = await this.ensureCategory(definition.code);
          const values = await prisma.etablissementReferenciel.findMany({
            where: {
              etablissement_id: tenantId,
              ...this.buildCategoryWhere(category.id),
            },
            orderBy: [{ valeur: "asc" }],
          });

          return {
            id: category.id,
            code: definition.code,
            titre: definition.titre,
            description: definition.description,
            fieldTargets: definition.fieldTargets,
            defaultValues: definition.defaultValues,
            values,
          };
        }),
      );

      Response.success(res, "Catalogue des referentiels.", categories);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation du catalogue des referentiels",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async getValues(
    req: Request,
    res: R,
    next: NextFunction,
  ): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const code = String(req.params.code ?? "").trim().toUpperCase();
      const definition = getReferentialDefinition(code);

      if (!definition) {
        throw new Error("Code de referentiel inconnu.");
      }

      const category = await this.ensureCategory(code);
      const values = await prisma.etablissementReferenciel.findMany({
        where: {
          etablissement_id: tenantId,
          ...this.buildCategoryWhere(category.id),
        },
        orderBy: [{ valeur: "asc" }],
      });

      Response.success(res, "Valeurs du referentiel.", {
        category: {
          id: category.id,
          code: definition.code,
          titre: definition.titre,
          description: definition.description,
          fieldTargets: definition.fieldTargets,
          defaultValues: definition.defaultValues,
        },
        values,
      });
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation des valeurs du referentiel",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async createValue(
    req: Request,
    res: R,
    next: NextFunction,
  ): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const code = String(req.params.code ?? "").trim().toUpperCase();
      const category = await this.ensureCategory(code);
      const valeur = this.normalizeValue(req.body?.valeur);

      const existing = await prisma.etablissementReferenciel.findFirst({
        where: {
          etablissement_id: tenantId,
          valeur,
          ...this.buildCategoryWhere(category.id),
        },
      });

      if (existing) {
        throw new Error("Cette valeur existe deja pour ce referentiel.");
      }

      const result = await prisma.etablissementReferenciel.create({
        data: {
          etablissement_id: tenantId,
          referenciel_id: category.id,
          referencielId: category.id,
          valeur,
        },
      });

      Response.success(res, "Valeur de referentiel creee.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la creation de la valeur de referentiel",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async updateValue(
    req: Request,
    res: R,
    next: NextFunction,
  ): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await prisma.etablissementReferenciel.findFirst({
        where: {
          id: req.params.id,
          etablissement_id: tenantId,
        },
      });

      if (!existing) {
        throw new Error(
          "Valeur de referentiel introuvable pour cet etablissement.",
        );
      }

      const valeur = this.normalizeValue(req.body?.valeur);
      const categoryId = existing.referencielId ?? existing.referenciel_id;
      const duplicate = await prisma.etablissementReferenciel.findFirst({
        where: {
          id: { not: existing.id },
          etablissement_id: tenantId,
          valeur,
          ...this.buildCategoryWhere(categoryId),
        },
      });

      if (duplicate) {
        throw new Error("Cette valeur existe deja pour ce referentiel.");
      }

      const result = await prisma.etablissementReferenciel.update({
        where: { id: existing.id },
        data: {
          valeur,
          referenciel_id: categoryId,
          referencielId: categoryId,
        },
      });

      Response.success(res, "Valeur de referentiel mise a jour.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la mise a jour de la valeur de referentiel",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async deleteValue(
    req: Request,
    res: R,
    next: NextFunction,
  ): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await prisma.etablissementReferenciel.findFirst({
        where: {
          id: req.params.id,
          etablissement_id: tenantId,
        },
      });

      if (!existing) {
        throw new Error(
          "Valeur de referentiel introuvable pour cet etablissement.",
        );
      }

      const result = await prisma.etablissementReferenciel.delete({
        where: { id: existing.id },
      });

      Response.success(res, "Valeur de referentiel supprimee.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la suppression de la valeur de referentiel",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const data: Referenciel = req.body;
      const result = await this.referenciel.create(data);
      Response.success(res, "Stablisment creation success.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la creation de l'etablissement",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      if (req.query.onlyCatalog === "true") {
        const result = await this.referenciel.findByCondition({
          code: { in: Array.from(REFERENTIAL_CODES) },
        });
        Response.success(res, "Referentiels systeme.", result);
        return;
      }

      const result = await getAllPaginated(req.query, this.referenciel);
      Response.success(res, "Stablisment list.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation des etablissements",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const id: string = req.params.id;
      const result = await this.referenciel.findUnique(id);
      Response.success(res, "Stablisment result.", result);
    } catch (error) {
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const id: string = req.params.id;
      const result = await this.referenciel.delete(id);
      Response.success(res, "Stablisment deleted.", result);
    } catch (error) {
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const id: string = req.params.id;
      const data: Referenciel = req.body;
      const result = await this.referenciel.update(id, data);
      Response.success(res, "Stablisment updated.", result);
    } catch (error) {
      next(error);
    }
  }
}

export default ReferencielApp;
