import { Application, NextFunction, Request, Response as R, Router } from "express";
import Response from "../../../common/app/response";
import RegleNoteModel from "../models/regle_note.model";
import { RegleNote } from "@prisma/client";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import { prisma } from "../../../service/prisma";

class RegleNoteApp {
  public app: Application;
  public router: Router;
  private regleNote: RegleNoteModel;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.regleNote = new RegleNoteModel();
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
      throw new Error("Conflit d'etablissement detecte pour la regle de note.");
    }

    return tenantCandidates[0];
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
      const data: RegleNote = {
        ...req.body,
        etablissement_id: tenantId,
      };
      const result = await this.regleNote.create(data);
      Response.success(res, "RegleNote created.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la creation de la regle de note",
        400,
        error as Error,
      );
    }
  }

  private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const where = parseJSON<Record<string, unknown>>(req.query.where, {});
      const scopedQuery = {
        ...req.query,
        where: JSON.stringify(this.buildScopedWhere(where, tenantId)),
      };
      const result = await getAllPaginated(scopedQuery as typeof req.query, this.regleNote);
      Response.success(res, "Regles de note list.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation des regles de notes",
        400,
        error as Error,
      );
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const id: string = req.params.id;
      const result = await prisma.regleNote.findFirst({
        where: {
          id,
          etablissement_id: tenantId,
        },
      });

      if (!result) {
        throw new Error("Regle de note introuvable pour cet etablissement.");
      }

      Response.success(res, "RegleNote detail.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation de la regle de note",
        404,
        error as Error,
      );
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const id: string = req.params.id;
      const existing = await prisma.regleNote.findFirst({
        where: {
          id,
          etablissement_id: tenantId,
        },
      });

      if (!existing) {
        throw new Error("Regle de note introuvable pour cet etablissement.");
      }

      const result = await this.regleNote.delete(id);
      Response.success(res, "RegleNote deleted.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la suppression de la regle de note",
        400,
        error as Error,
      );
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const id: string = req.params.id;
      const existing = await prisma.regleNote.findFirst({
        where: {
          id,
          etablissement_id: tenantId,
        },
      });

      if (!existing) {
        throw new Error("Regle de note introuvable pour cet etablissement.");
      }

      const data: RegleNote = {
        ...req.body,
        etablissement_id: tenantId,
      };
      const result = await this.regleNote.update(id, data);
      Response.success(res, "RegleNote updated.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la mise a jour de la regle de note",
        400,
        error as Error,
      );
    }
  }
}

export default RegleNoteApp;
