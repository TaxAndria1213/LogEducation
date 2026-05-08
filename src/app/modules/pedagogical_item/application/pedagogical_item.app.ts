import { Application, NextFunction, Request, Response as R, Router } from "express";
import {
  PedagogicalCalculationMode,
  PedagogicalItemType,
  PrismaClient,
  type PedagogicalItem,
} from "@prisma/client";
import Response from "../../../common/app/response";
import PedagogicalItemModel from "../models/pedagogical_item.model";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import { prisma } from "../../../service/prisma";
import { getRequiredActiveAcademicYear } from "../../pedagogie_shared/utils/academicScope";

type PedagogicalItemPayload = Pick<
  PedagogicalItem,
  | "etablissement_id"
  | "annee_scolaire_id"
  | "niveau_scolaire_id"
  | "parent_id"
  | "matiere_id"
  | "item_type"
  | "code"
  | "nom"
  | "description"
  | "display_order"
  | "coefficient"
  | "weight"
  | "is_evaluable"
  | "is_visible_on_report"
  | "is_required"
  | "calculation_mode"
  | "is_active"
>;

const ITEM_TYPES: PedagogicalItemType[] = [
  "SUBJECT",
  "GROUP",
  "DOMAIN",
  "SUBDOMAIN",
  "COMPETENCY",
  "OBJECTIVE",
];

const CALCULATION_MODES: PedagogicalCalculationMode[] = [
  "NONE",
  "SIMPLE_AVERAGE",
  "WEIGHTED_AVERAGE",
  "SUM",
  "MANUAL",
];

type PedagogicalTreeNode = Record<string, unknown> & {
  id: string;
  parent_id?: string | null;
  display_order?: number | null;
  enfants?: PedagogicalTreeNode[];
};

class PedagogicalItemApp {
  public app: Application;
  public router: Router;
  private pedagogicalItem: PedagogicalItemModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.pedagogicalItem = new PedagogicalItemModel();
    this.prisma = prisma;
    this.routes();
  }

  public routes(): Router {
    this.router.get("/tree", this.getTree.bind(this));
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
      throw new Error("Conflit d'etablissement detecte pour la structure pedagogique.");
    }

    return tenantCandidates[0];
  }

  private normalizeBoolean(value: unknown, fallback: boolean) {
    return typeof value === "boolean" ? value : fallback;
  }

  private normalizePositiveNumber(
    value: unknown,
    fieldLabel: string,
  ): number | null {
    if (value === undefined || value === null || value === "") {
      return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`${fieldLabel} doit etre superieur a 0.`);
    }

    return parsed;
  }

  private normalizeDisplayOrder(value: unknown) {
    if (value === undefined || value === null || value === "") {
      return 0;
    }

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new Error("L'ordre d'affichage doit etre un entier positif ou nul.");
    }

    return parsed;
  }

  private normalizePayload(
    raw: Partial<PedagogicalItem>,
    tenantId: string,
    activeYearId: string,
  ): PedagogicalItemPayload {
    const niveauId =
      typeof raw.niveau_scolaire_id === "string" && raw.niveau_scolaire_id.trim()
        ? raw.niveau_scolaire_id.trim()
        : "";

    if (!niveauId) {
      throw new Error("Le niveau scolaire de l'element pedagogique est requis.");
    }

    const itemType =
      typeof raw.item_type === "string"
        ? raw.item_type.trim().toUpperCase()
        : String(raw.item_type ?? "").trim().toUpperCase();

    if (!ITEM_TYPES.includes(itemType as PedagogicalItemType)) {
      throw new Error("Le type d'element pedagogique est invalide.");
    }

    const calculationMode =
      typeof raw.calculation_mode === "string"
        ? raw.calculation_mode.trim().toUpperCase()
        : String(raw.calculation_mode ?? "WEIGHTED_AVERAGE").trim().toUpperCase();

    if (!CALCULATION_MODES.includes(calculationMode as PedagogicalCalculationMode)) {
      throw new Error("Le mode de calcul de l'element pedagogique est invalide.");
    }

    const normalizedName =
      typeof raw.nom === "string" ? raw.nom.trim().replace(/\s+/g, " ") : "";

    if (!normalizedName) {
      throw new Error("Le nom de l'element pedagogique est requis.");
    }

    const parentId =
      typeof raw.parent_id === "string" && raw.parent_id.trim()
        ? raw.parent_id.trim()
        : null;
    const matiereId =
      typeof raw.matiere_id === "string" && raw.matiere_id.trim()
        ? raw.matiere_id.trim()
        : null;

    return {
      etablissement_id: tenantId,
      annee_scolaire_id: activeYearId,
      niveau_scolaire_id: niveauId,
      parent_id: parentId,
      matiere_id: matiereId,
      item_type: itemType as PedagogicalItemType,
      code:
        typeof raw.code === "string" && raw.code.trim()
          ? raw.code.trim().replace(/\s+/g, " ").toUpperCase()
          : null,
      nom: normalizedName,
      description:
        typeof raw.description === "string" && raw.description.trim()
          ? raw.description.trim()
          : null,
      display_order: this.normalizeDisplayOrder(raw.display_order),
      coefficient: this.normalizePositiveNumber(raw.coefficient, "Le coefficient"),
      weight: this.normalizePositiveNumber(raw.weight, "Le poids"),
      is_evaluable: this.normalizeBoolean(raw.is_evaluable, false),
      is_visible_on_report: this.normalizeBoolean(raw.is_visible_on_report, true),
      is_required: this.normalizeBoolean(raw.is_required, false),
      calculation_mode: calculationMode as PedagogicalCalculationMode,
      is_active: this.normalizeBoolean(raw.is_active, true),
    };
  }

  private async validateNiveau(
    niveauId: string,
    tenantId: string,
  ): Promise<void> {
    const niveau = await this.prisma.niveauScolaire.findFirst({
      where: { id: niveauId, etablissement_id: tenantId },
      select: { id: true },
    });

    if (!niveau) {
      throw new Error(
        "Le niveau scolaire selectionne n'appartient pas a l'etablissement actif.",
      );
    }
  }

  private async validateMatiere(
    matiereId: string | null,
    tenantId: string,
  ): Promise<void> {
    if (!matiereId) return;

    const matiere = await this.prisma.matiere.findFirst({
      where: { id: matiereId, etablissement_id: tenantId },
      select: { id: true },
    });

    if (!matiere) {
      throw new Error(
        "La matiere selectionnee n'appartient pas a l'etablissement actif.",
      );
    }
  }

  private async validateParent(
    parentId: string | null,
    data: Pick<
      PedagogicalItemPayload,
      "etablissement_id" | "annee_scolaire_id" | "niveau_scolaire_id"
    >,
    excludeId?: string,
  ): Promise<void> {
    if (!parentId) return;

    if (excludeId && parentId === excludeId) {
      throw new Error("Un element pedagogique ne peut pas etre son propre parent.");
    }

    const parent = await this.prisma.pedagogicalItem.findFirst({
      where: {
        id: parentId,
        etablissement_id: data.etablissement_id,
        annee_scolaire_id: data.annee_scolaire_id,
        niveau_scolaire_id: data.niveau_scolaire_id,
      },
      select: { id: true },
    });

    if (!parent) {
      throw new Error(
        "Le parent selectionne n'appartient pas au meme niveau ou a l'annee scolaire courante.",
      );
    }
  }

  private async ensureUniqueItem(
    data: PedagogicalItemPayload,
    excludeId?: string,
  ) {
    const duplicate = await this.prisma.pedagogicalItem.findFirst({
      where: {
        id: excludeId ? { not: excludeId } : undefined,
        annee_scolaire_id: data.annee_scolaire_id,
        niveau_scolaire_id: data.niveau_scolaire_id,
        parent_id: data.parent_id,
        nom: data.nom,
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new Error("Cet element pedagogique existe deja dans ce parent.");
    }
  }

  private buildScopedWhere(
    existingWhere: Record<string, unknown>,
    tenantId: string,
    activeYearId: string,
  ): Record<string, unknown> {
    const scopeWhere = {
      etablissement_id: tenantId,
      annee_scolaire_id: activeYearId,
    };

    if (!existingWhere || Object.keys(existingWhere).length === 0) {
      return scopeWhere;
    }

    return {
      AND: [existingWhere, scopeWhere],
    };
  }

  private async getScopedItem(
    id: string,
    tenantId: string,
    activeYearId: string,
  ) {
    return this.prisma.pedagogicalItem.findFirst({
      where: {
        id,
        etablissement_id: tenantId,
        annee_scolaire_id: activeYearId,
      },
    });
  }

  private buildTree(rows: PedagogicalTreeNode[]) {
    const nodes = rows.map((row) => ({
      ...row,
      enfants: [] as PedagogicalTreeNode[],
    }));
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const roots: PedagogicalTreeNode[] = [];

    nodes.forEach((node) => {
      const parentId =
        typeof node.parent_id === "string" && node.parent_id.trim()
          ? node.parent_id
          : null;
      if (parentId && byId.has(parentId)) {
        byId.get(parentId)?.enfants?.push(node);
      } else {
        roots.push(node);
      }
    });

    const sortNodes = (items: PedagogicalTreeNode[]) => {
      items.sort((a, b) => {
        const orderA =
          typeof a.display_order === "number" ? a.display_order : Number.MAX_SAFE_INTEGER;
        const orderB =
          typeof b.display_order === "number" ? b.display_order : Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return String(a.id).localeCompare(String(b.id));
      });
      items.forEach((item) => sortNodes(item.enfants ?? []));
    };

    sortNodes(roots);
    return roots;
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);
      const data = this.normalizePayload(req.body, tenantId, activeYear.id);

      await this.validateNiveau(data.niveau_scolaire_id, tenantId);
      await this.validateMatiere(data.matiere_id, tenantId);
      await this.validateParent(data.parent_id, data);
      await this.ensureUniqueItem(data);

      const result = await this.pedagogicalItem.create(data);
      Response.success(res, "Element pedagogique cree avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la creation de l'element pedagogique",
        400,
        error as Error,
      );
    }
  }

  private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);
      const where = parseJSON<Record<string, unknown>>(req.query.where, {});
      const scopedQuery = {
        ...req.query,
        where: JSON.stringify(this.buildScopedWhere(where, tenantId, activeYear.id)),
        orderBy:
          req.query.orderBy ??
          JSON.stringify([{ display_order: "asc" }, { nom: "asc" }, { created_at: "desc" }]),
      };

      const result = await getAllPaginated(
        scopedQuery as typeof req.query,
        this.pedagogicalItem,
      );
      Response.success(res, "Liste des elements pedagogiques recuperee.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation des elements pedagogiques",
        400,
        error as Error,
      );
    }
  }

  private async getTree(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);
      const niveauId =
        typeof req.query.niveau_scolaire_id === "string" && req.query.niveau_scolaire_id.trim()
          ? req.query.niveau_scolaire_id.trim()
          : null;

      const rows = await this.prisma.pedagogicalItem.findMany({
        where: {
          etablissement_id: tenantId,
          annee_scolaire_id: activeYear.id,
          ...(niveauId ? { niveau_scolaire_id: niveauId } : {}),
        },
        include: {
          matiere: true,
        },
        orderBy: [{ display_order: "asc" }, { nom: "asc" }],
      });

      Response.success(
        res,
        "Arbre des elements pedagogiques recupere.",
        this.buildTree(rows as unknown as PedagogicalTreeNode[]),
      );
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation de l'arbre pedagogique",
        400,
        error as Error,
      );
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);
      const includeSpec = parseJSON<Record<string, unknown>>(req.query.includeSpec, {
        matiere: true,
        niveau: true,
        parent: true,
        enfants: true,
      });

      const result = await this.prisma.pedagogicalItem.findFirst({
        where: {
          id: req.params.id,
          etablissement_id: tenantId,
          annee_scolaire_id: activeYear.id,
        },
        include: includeSpec,
      });

      if (!result) {
        throw new Error("Element pedagogique introuvable pour cet etablissement.");
      }

      Response.success(res, "Detail de l'element pedagogique.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation de l'element pedagogique",
        404,
        error as Error,
      );
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);
      const existing = await this.prisma.pedagogicalItem.findFirst({
        where: {
          id: req.params.id,
          etablissement_id: tenantId,
          annee_scolaire_id: activeYear.id,
        },
        include: {
          _count: {
            select: {
              enfants: true,
              evaluations: true,
            },
          },
        },
      });

      if (!existing) {
        throw new Error("Element pedagogique introuvable pour cet etablissement.");
      }

      if (existing._count.enfants > 0) {
        throw new Error(
          `Suppression impossible: cet element contient encore ${existing._count.enfants} sous-element(s).`,
        );
      }

      if (existing._count.evaluations > 0) {
        throw new Error(
          `Suppression impossible: cet element est encore utilise par ${existing._count.evaluations} evaluation(s).`,
        );
      }

      const result = await this.pedagogicalItem.delete(existing.id);
      Response.success(res, "Element pedagogique supprime avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la suppression de l'element pedagogique",
        400,
        error as Error,
      );
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);
      const existing = await this.getScopedItem(req.params.id, tenantId, activeYear.id);

      if (!existing) {
        throw new Error("Element pedagogique introuvable pour cet etablissement.");
      }

      const data = this.normalizePayload(req.body, tenantId, activeYear.id);
      await this.validateNiveau(data.niveau_scolaire_id, tenantId);
      await this.validateMatiere(data.matiere_id, tenantId);
      await this.validateParent(data.parent_id, data, existing.id);
      await this.ensureUniqueItem(data, existing.id);

      const result = await this.pedagogicalItem.update(existing.id, data);
      Response.success(res, "Element pedagogique mis a jour avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la mise a jour de l'element pedagogique",
        400,
        error as Error,
      );
    }
  }
}

export default PedagogicalItemApp;
