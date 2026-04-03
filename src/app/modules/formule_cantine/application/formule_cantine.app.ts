import { Application, NextFunction, Request, Response as R, Router } from "express";
import { PrismaClient } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import FormuleCantineModel from "../models/formule_cantine.model";

type FormuleCantinePayload = {
  etablissement_id: string;
  nom: string;
  type_formule: "FORFAIT" | "REPAS_UNITAIRE" | "ABONNEMENT" | "AUTRE";
  catalogue_frais_id: string;
  transmettre_consommations_finance: boolean;
  max_repas_par_jour: number;
  regulariser_absence_annulation: boolean;
  mode_regularisation_absence: "AVOIR" | "REPORT" | "REMBOURSEMENT" | "AJUSTEMENT";
};

const ALLOWED_FORMULE_TYPES = ["FORFAIT", "REPAS_UNITAIRE", "ABONNEMENT", "AUTRE"] as const;
const ALLOWED_ABSENCE_REGULARIZATION_MODES = ["AVOIR", "REPORT", "REMBOURSEMENT", "AJUSTEMENT"] as const;

class FormuleCantineApp {
  public app: Application;
  public router: Router;
  private formuleCantine: FormuleCantineModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.formuleCantine = new FormuleCantineModel();
    this.prisma = new PrismaClient();
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
      typeof req.body?.etablissement_id === "string" ? req.body.etablissement_id.trim() : undefined;
    const queryWhere = parseJSON<Record<string, unknown>>(req.query.where, {});
    const queryTenant =
      typeof queryWhere?.etablissement_id === "string" ? queryWhere.etablissement_id.trim() : undefined;
    const candidates = [requestTenant, bodyTenant, queryTenant].filter(
      (value): value is string => Boolean(value),
    );
    if (candidates.length === 0) throw new Error("Aucun etablissement actif n'a ete fourni.");
    if (new Set(candidates).size > 1) throw new Error("Conflit d'etablissement detecte pour les formules de cantine.");
    return candidates[0];
  }

  private buildScopedWhere(existingWhere: Record<string, unknown>, tenantId: string) {
    if (!existingWhere || Object.keys(existingWhere).length === 0) return { etablissement_id: tenantId };
    return { AND: [existingWhere, { etablissement_id: tenantId }] };
  }

  private async normalizePayload(raw: Record<string, unknown>, tenantId: string): Promise<FormuleCantinePayload> {
    const nom = typeof raw.nom === "string" ? raw.nom.trim() : "";
    const type_formule =
      typeof raw.type_formule === "string" && raw.type_formule.trim()
        ? raw.type_formule.trim().toUpperCase()
        : "";
    const catalogue_frais_id =
      typeof raw.catalogue_frais_id === "string" && raw.catalogue_frais_id.trim()
        ? raw.catalogue_frais_id.trim()
        : "";
    const transmettre_consommations_finance =
      typeof raw.transmettre_consommations_finance === "boolean"
        ? raw.transmettre_consommations_finance
        : true;
    const max_repas_par_jour_raw =
      typeof raw.max_repas_par_jour === "number"
        ? raw.max_repas_par_jour
        : typeof raw.max_repas_par_jour === "string" && raw.max_repas_par_jour.trim()
          ? Number(raw.max_repas_par_jour)
          : 1;
    const regulariser_absence_annulation =
      typeof raw.regulariser_absence_annulation === "boolean"
        ? raw.regulariser_absence_annulation
        : false;
    const mode_regularisation_absence =
      typeof raw.mode_regularisation_absence === "string" && raw.mode_regularisation_absence.trim()
        ? raw.mode_regularisation_absence.trim().toUpperCase()
        : "AVOIR";

    if (!nom) {
      throw new Error("Le nom de la formule de cantine est obligatoire.");
    }

    if (!ALLOWED_FORMULE_TYPES.includes(type_formule as (typeof ALLOWED_FORMULE_TYPES)[number])) {
      throw new Error("Le type de formule de cantine est obligatoire.");
    }

    if (
      !ALLOWED_ABSENCE_REGULARIZATION_MODES.includes(
        mode_regularisation_absence as (typeof ALLOWED_ABSENCE_REGULARIZATION_MODES)[number],
      )
    ) {
      throw new Error("Le mode de regularisation des absences cantine est invalide.");
    }

    if (!Number.isInteger(max_repas_par_jour_raw) || max_repas_par_jour_raw <= 0) {
      throw new Error("Le nombre maximal de repas par jour doit etre un entier superieur a zero.");
    }

    if (!catalogue_frais_id) {
      throw new Error("Le frais catalogue de la formule de cantine est obligatoire.");
    }

    const frais = await this.prisma.catalogueFrais.findFirst({
      where: {
        id: catalogue_frais_id,
        etablissement_id: tenantId,
      },
      select: {
        id: true,
        usage_scope: true as never,
      },
    }) as {
      id: string;
      usage_scope: string | null;
    } | null;

    if (!frais) {
      throw new Error("Le frais selectionne n'appartient pas a cet etablissement.");
    }

    const usageScope = (frais.usage_scope ?? "GENERAL").toUpperCase();
    if (!["GENERAL", "CANTINE"].includes(usageScope)) {
      throw new Error("Le frais selectionne n'est pas compatible avec la cantine.");
    }

    return {
      etablissement_id: tenantId,
      nom,
      type_formule: type_formule as FormuleCantinePayload["type_formule"],
      catalogue_frais_id,
      transmettre_consommations_finance,
      max_repas_par_jour: max_repas_par_jour_raw,
      regulariser_absence_annulation,
      mode_regularisation_absence:
        mode_regularisation_absence as FormuleCantinePayload["mode_regularisation_absence"],
    };
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const data = await this.normalizePayload(req.body as Record<string, unknown>, tenantId);
      const result = await this.formuleCantine.create(data);
      Response.success(res, "Formule de cantine creee.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la creation de la formule de cantine",
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
      };
      const result = await getAllPaginated(scopedQuery as typeof req.query, this.formuleCantine);
      Response.success(res, "Formules de cantine.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation des formules de cantine",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const id: string = req.params.id;
      const result = await this.prisma.formuleCantine.findFirst({
        where: { id, etablissement_id: tenantId },
        include: { abonnements: true, frais: true },
      });
      Response.success(res, "Formule de cantine.", result);
    } catch (error) {
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const id: string = req.params.id;
      const existing = await this.prisma.formuleCantine.findFirst({
        where: { id, etablissement_id: tenantId },
        include: { abonnements: true, frais: true },
      });
      if (!existing) throw new Error("Formule de cantine introuvable.");
      if ((existing.abonnements?.length ?? 0) > 0) {
        throw new Error("Cette formule est utilisee par des abonnements cantine.");
      }
      const result = await this.formuleCantine.delete(id);
      Response.success(res, "Formule de cantine supprimee.", result);
    } catch (error) {
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const id: string = req.params.id;
      const existing = await this.prisma.formuleCantine.findFirst({
        where: { id, etablissement_id: tenantId },
        select: { id: true },
      });
      if (!existing) throw new Error("Formule de cantine introuvable.");
      const data = await this.normalizePayload(req.body as Record<string, unknown>, tenantId);
      const result = await this.formuleCantine.update(id, data);
      Response.success(res, "Formule de cantine mise a jour.", result);
    } catch (error) {
      next(error);
    }
  }
}

export default FormuleCantineApp;
