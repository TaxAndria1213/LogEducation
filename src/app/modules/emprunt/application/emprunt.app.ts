import { Application, NextFunction, Request, Response as R, Router } from "express";
import { PrismaClient, type Emprunt } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import EmpruntModel from "../models/emprunt.model";

type EmpruntPayload = {
  ressource_bibliotheque_id: string;
  eleve_id: string | null;
  personnel_id: string | null;
  emprunte_le: Date;
  du_le: Date | null;
  retourne_le: Date | null;
  statut: string;
};

class EmpruntApp {
  public app: Application;
  public router: Router;
  private prisma: PrismaClient;
  private emprunt: EmpruntModel;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.prisma = new PrismaClient();
    this.emprunt = new EmpruntModel();
    this.routes();
  }

  public routes(): Router {
    this.router.post("/", this.create.bind(this));
    this.router.get("/", this.getAll.bind(this));
    this.router.get("/:id", this.getOne.bind(this));
    this.router.put("/:id", this.update.bind(this));
    this.router.delete("/:id", this.delete.bind(this));
    this.router.post("/:id/return", this.markAsReturned.bind(this));
    return this.router;
  }

  private resolveTenantId(req: Request): string {
    const requestTenant = (req as Request & { tenantId?: string }).tenantId;
    const queryWhere = parseJSON<Record<string, unknown>>(req.query.where, {});
    const queryTenant =
      typeof (queryWhere?.ressource as { is?: { etablissement_id?: unknown } } | undefined)?.is
        ?.etablissement_id === "string"
        ? (
            (queryWhere?.ressource as { is?: { etablissement_id?: string } } | undefined)?.is
              ?.etablissement_id ?? ""
          ).trim()
        : undefined;
    const bodyTenant =
      typeof req.body?.etablissement_id === "string" ? req.body.etablissement_id.trim() : undefined;

    const candidates = [requestTenant, bodyTenant, queryTenant].filter(
      (value): value is string => Boolean(value),
    );

    if (candidates.length === 0) {
      throw new Error("Aucun etablissement actif n'a ete fourni.");
    }

    if (new Set(candidates).size > 1) {
      throw new Error("Conflit d'etablissement detecte pour les emprunts.");
    }

    return candidates[0];
  }

  private toDate(value: unknown, field: string) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      throw new Error(`La date ${field} n'est pas valide.`);
    }
    return date;
  }

  private normalizePayload(raw: Partial<Emprunt>): EmpruntPayload {
    const ressource_bibliotheque_id =
      typeof raw.ressource_bibliotheque_id === "string" ? raw.ressource_bibliotheque_id.trim() : "";
    const eleve_id = typeof raw.eleve_id === "string" && raw.eleve_id.trim() ? raw.eleve_id.trim() : null;
    const personnel_id =
      typeof raw.personnel_id === "string" && raw.personnel_id.trim() ? raw.personnel_id.trim() : null;
    const emprunte_le = this.toDate(raw.emprunte_le ?? new Date(), "d'emprunt") ?? new Date();
    const du_le = this.toDate(raw.du_le, "de retour prevu");
    const retourne_le = this.toDate(raw.retourne_le, "de retour effectif");
    const statut =
      retourne_le != null
        ? "RETOURNE"
        : typeof raw.statut === "string" && raw.statut.trim()
          ? raw.statut.trim().toUpperCase()
          : "EMPRUNTE";

    if (!ressource_bibliotheque_id) {
      throw new Error("La ressource est obligatoire.");
    }

    if ((eleve_id ? 1 : 0) + (personnel_id ? 1 : 0) !== 1) {
      throw new Error("Il faut selectionner exactement un eleve ou un membre du personnel.");
    }

    if (du_le && du_le.getTime() < emprunte_le.getTime()) {
      throw new Error("La date de retour prevue doit etre posterieure a la date d'emprunt.");
    }

    if (retourne_le && retourne_le.getTime() < emprunte_le.getTime()) {
      throw new Error("La date de retour ne peut pas etre anterieure a la date d'emprunt.");
    }

    return {
      ressource_bibliotheque_id,
      eleve_id,
      personnel_id,
      emprunte_le,
      du_le,
      retourne_le,
      statut,
    };
  }

  private buildScopedWhere(existingWhere: Record<string, unknown>, tenantId: string) {
    const scope = { ressource: { is: { etablissement_id: tenantId } } };
    if (!existingWhere || Object.keys(existingWhere).length === 0) return scope;
    return { AND: [existingWhere, scope] };
  }

  private async ensureScopedRessource(ressourceId: string, tenantId: string) {
    const ressource = await this.prisma.ressourceBibliotheque.findFirst({
      where: { id: ressourceId, etablissement_id: tenantId },
      select: { id: true, stock: true },
    });

    if (!ressource) {
      throw new Error("La ressource selectionnee n'appartient pas a cet etablissement.");
    }

    return ressource;
  }

  private async ensureScopedBorrower(payload: EmpruntPayload, tenantId: string) {
    if (payload.eleve_id) {
      const eleve = await this.prisma.eleve.findFirst({
        where: { id: payload.eleve_id, etablissement_id: tenantId },
        select: { id: true },
      });
      if (!eleve) {
        throw new Error("L'eleve selectionne n'appartient pas a cet etablissement.");
      }
    }

    if (payload.personnel_id) {
      const personnel = await this.prisma.personnel.findFirst({
        where: { id: payload.personnel_id, etablissement_id: tenantId },
        select: { id: true },
      });
      if (!personnel) {
        throw new Error("Le membre du personnel selectionne n'appartient pas a cet etablissement.");
      }
    }
  }

  private async ensureStockAvailable(
    ressourceId: string,
    stock: number | null | undefined,
    excludeId?: string,
  ) {
    const activeCount = await this.prisma.emprunt.count({
      where: {
        ressource_bibliotheque_id: ressourceId,
        retourne_le: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    const allowedStock = Number(stock ?? 0);
    if (activeCount >= allowedStock) {
      throw new Error("Aucun exemplaire disponible pour cette ressource.");
    }
  }

  private async getScopedEmprunt(id: string, tenantId: string) {
    return this.prisma.emprunt.findFirst({
      where: {
        id,
        ressource: { is: { etablissement_id: tenantId } },
      },
      include: {
        ressource: true,
        eleve: { include: { utilisateur: { include: { profil: true } } } },
        personnel: { include: { utilisateur: { include: { profil: true } } } },
      },
    });
  }

  private async create(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const data = this.normalizePayload(req.body);
      const ressource = await this.ensureScopedRessource(data.ressource_bibliotheque_id, tenantId);
      await this.ensureScopedBorrower(data, tenantId);
      if (!data.retourne_le) {
        await this.ensureStockAvailable(data.ressource_bibliotheque_id, ressource.stock);
      }

      const result = await this.emprunt.create(data);
      Response.success(res, "Emprunt cree avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la creation de l'emprunt", 400, error as Error);
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
        orderBy: req.query.orderBy ?? JSON.stringify([{ emprunte_le: "desc" }, { created_at: "desc" }]),
      };

      const result = await getAllPaginated(scopedQuery as typeof req.query, this.emprunt);
      Response.success(res, "Liste des emprunts recuperee.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des emprunts", 400, error as Error);
      next(error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const includeSpec = parseJSON<Record<string, unknown>>(req.query.includeSpec, {});
      const result = await this.prisma.emprunt.findFirst({
        where: {
          id: req.params.id,
          ressource: { is: { etablissement_id: tenantId } },
        },
        include:
          (Object.keys(includeSpec).length > 0
            ? includeSpec
            : {
                ressource: true,
                eleve: { include: { utilisateur: { include: { profil: true } } } },
                personnel: { include: { utilisateur: { include: { profil: true } } } },
              }) as never,
      });

      if (!result) {
        throw new Error("Emprunt introuvable pour cet etablissement.");
      }

      Response.success(res, "Detail de l'emprunt.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation de l'emprunt", 404, error as Error);
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedEmprunt(req.params.id, tenantId);
      if (!existing) {
        throw new Error("Emprunt introuvable pour cet etablissement.");
      }

      const data = this.normalizePayload({ ...existing, ...req.body });
      const ressource = await this.ensureScopedRessource(data.ressource_bibliotheque_id, tenantId);
      await this.ensureScopedBorrower(data, tenantId);

      if (!data.retourne_le) {
        await this.ensureStockAvailable(data.ressource_bibliotheque_id, ressource.stock, req.params.id);
      }

      const result = await this.emprunt.update(req.params.id, data);
      Response.success(res, "Emprunt mis a jour avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la mise a jour de l'emprunt", 400, error as Error);
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedEmprunt(req.params.id, tenantId);
      if (!existing) {
        throw new Error("Emprunt introuvable pour cet etablissement.");
      }

      if (!existing.retourne_le) {
        throw new Error("Un emprunt actif doit etre retourne avant suppression.");
      }

      const result = await this.emprunt.delete(req.params.id);
      Response.success(res, "Emprunt supprime avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la suppression de l'emprunt", 400, error as Error);
      next(error);
    }
  }

  private async markAsReturned(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedEmprunt(req.params.id, tenantId);
      if (!existing) {
        throw new Error("Emprunt introuvable pour cet etablissement.");
      }

      if (existing.retourne_le) {
        throw new Error("Cet emprunt est deja retourne.");
      }

      const retourne_le = this.toDate(req.body?.retourne_le ?? new Date(), "de retour") ?? new Date();
      const result = await this.emprunt.update(req.params.id, {
        retourne_le,
        statut: "RETOURNE",
      });
      Response.success(res, "Emprunt retourne avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors du retour de l'emprunt", 400, error as Error);
      next(error);
    }
  }
}

export default EmpruntApp;
