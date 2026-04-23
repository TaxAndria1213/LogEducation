import { Application, NextFunction, Request, Response as R, Router } from "express";
import { PrismaClient, type RessourceBibliotheque } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import RessourceBibliothequeModel from "../models/ressource_bibliotheque.model";
import { prisma } from "../../../service/prisma";

type RessourceBibliothequePayload = {
  etablissement_id: string;
  type: string;
  titre: string;
  code: string | null;
  auteur: string | null;
  editeur: string | null;
  annee: number | null;
  stock: number;
};

const ALLOWED_RESOURCE_TYPES = new Set(["livre", "materiel"]);

class RessourceBibliothequeApp {
  public app: Application;
  public router: Router;
  private prisma: PrismaClient;
  private ressourceBibliotheque: RessourceBibliothequeModel;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.prisma = prisma;
    this.ressourceBibliotheque = new RessourceBibliothequeModel();
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

  private resolveTenantId(req: Request): string {
    const requestTenant = (req as Request & { tenantId?: string }).tenantId;
    const bodyTenant =
      typeof req.body?.etablissement_id === "string" ? req.body.etablissement_id.trim() : undefined;
    const queryWhere = parseJSON<Record<string, unknown>>(req.query.where, {});
    const queryTenant =
      typeof queryWhere?.etablissement_id === "string" ? queryWhere.etablissement_id.trim() : undefined;

    const candidates = [requestTenant, bodyTenant, queryTenant].filter(
      (value): value is string => Boolean(value),
    );

    if (candidates.length === 0) {
      throw new Error("Aucun etablissement actif n'a ete fourni.");
    }

    if (new Set(candidates).size > 1) {
      throw new Error("Conflit d'etablissement detecte pour les ressources de bibliotheque.");
    }

    return candidates[0];
  }

  private normalizePayload(
    raw: Partial<RessourceBibliotheque>,
    tenantId: string,
  ): RessourceBibliothequePayload {
    const type = typeof raw.type === "string" ? raw.type.trim().toLowerCase() : "";
    const titre = typeof raw.titre === "string" ? raw.titre.trim().replace(/\s+/g, " ") : "";
    const code = typeof raw.code === "string" && raw.code.trim() ? raw.code.trim().toUpperCase() : null;
    const auteur = typeof raw.auteur === "string" && raw.auteur.trim() ? raw.auteur.trim() : null;
    const editeur = typeof raw.editeur === "string" && raw.editeur.trim() ? raw.editeur.trim() : null;
    const annee =
      raw.annee == null || raw.annee === ("" as never) ? null : Number(raw.annee);
    const stock = Number(raw.stock ?? 1);

    if (!ALLOWED_RESOURCE_TYPES.has(type)) {
      throw new Error("Le type de ressource doit etre 'livre' ou 'materiel'.");
    }

    if (!titre) {
      throw new Error("Le titre de la ressource est requis.");
    }

    if (!Number.isFinite(stock) || stock < 0) {
      throw new Error("Le stock doit etre un nombre positif ou nul.");
    }

    if (annee !== null && (!Number.isFinite(annee) || annee < 0)) {
      throw new Error("L'annee doit etre un nombre valide.");
    }

    return {
      etablissement_id: tenantId,
      type,
      titre,
      code,
      auteur,
      editeur,
      annee,
      stock,
    };
  }

  private buildScopedWhere(existingWhere: Record<string, unknown>, tenantId: string) {
    if (!existingWhere || Object.keys(existingWhere).length === 0) {
      return { etablissement_id: tenantId };
    }

    return { AND: [existingWhere, { etablissement_id: tenantId }] };
  }

  private async ensureUniqueCode(data: RessourceBibliothequePayload, excludeId?: string) {
    if (!data.code) return;

    const duplicate = await this.prisma.ressourceBibliotheque.findFirst({
      where: {
        etablissement_id: data.etablissement_id,
        code: data.code,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new Error("Une ressource avec ce code existe deja dans cet etablissement.");
    }
  }

  private async getScopedRessource(id: string, tenantId: string) {
    return this.prisma.ressourceBibliotheque.findFirst({
      where: { id, etablissement_id: tenantId },
      include: {
        emprunts: {
          where: { retourne_le: null },
        },
      },
    });
  }

  private async create(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const data = this.normalizePayload(req.body, tenantId);
      await this.ensureUniqueCode(data);
      const result = await this.ressourceBibliotheque.create(data);
      Response.success(res, "Ressource de bibliotheque creee avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la creation de la ressource", 400, error as Error);
      next(error);
    }
  }

  private async getAll(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const where = parseJSON<Record<string, unknown>>(req.query.where, {});
      const scopedQuery = {
        ...req.query,
        where: JSON.stringify(this.buildScopedWhere(where, tenantId)),
        orderBy: req.query.orderBy ?? JSON.stringify([{ titre: "asc" }, { created_at: "desc" }]),
      };

      const result = await getAllPaginated(scopedQuery as typeof req.query, this.ressourceBibliotheque);
      Response.success(res, "Liste des ressources recuperee.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des ressources", 400, error as Error);
      next(error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const includeSpec = parseJSON<Record<string, unknown>>(req.query.includeSpec, {});
      const result = await this.prisma.ressourceBibliotheque.findFirst({
        where: { id: req.params.id, etablissement_id: tenantId },
        include:
          (Object.keys(includeSpec).length > 0
            ? includeSpec
            : {
                emprunts: {
                  include: {
                    eleve: { include: { utilisateur: { include: { profil: true } } } },
                    personnel: { include: { utilisateur: { include: { profil: true } } } },
                  },
                  orderBy: [{ emprunte_le: "desc" }],
                },
              }) as never,
      });

      if (!result) {
        throw new Error("Ressource introuvable pour cet etablissement.");
      }

      Response.success(res, "Detail de la ressource.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation de la ressource", 404, error as Error);
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedRessource(req.params.id, tenantId);

      if (!existing) {
        throw new Error("Ressource introuvable pour cet etablissement.");
      }

      const data = this.normalizePayload({ ...existing, ...req.body }, tenantId);
      const activeLoans = existing.emprunts?.length ?? 0;
      if (data.stock < activeLoans) {
        throw new Error("Le stock ne peut pas etre inferieur au nombre d'emprunts actifs.");
      }

      await this.ensureUniqueCode(data, req.params.id);
      const result = await this.ressourceBibliotheque.update(req.params.id, data);
      Response.success(res, "Ressource mise a jour avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la mise a jour de la ressource", 400, error as Error);
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedRessource(req.params.id, tenantId);

      if (!existing) {
        throw new Error("Ressource introuvable pour cet etablissement.");
      }

      if ((existing.emprunts?.length ?? 0) > 0) {
        throw new Error("Cette ressource a des emprunts actifs et ne peut pas etre supprimee.");
      }

      const result = await this.ressourceBibliotheque.delete(req.params.id);
      Response.success(res, "Ressource supprimee avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la suppression de la ressource", 400, error as Error);
      next(error);
    }
  }
}

export default RessourceBibliothequeApp;

