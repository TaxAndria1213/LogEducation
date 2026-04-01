import { Application, NextFunction, Request, Response as R, Router } from "express";
import { Prisma, PrismaClient, type Remise } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import { archiveLinkedDocument } from "../../finance_shared/utils/document_archive";
import RemiseModel from "../models/remise.model";

type RemisePayload = {
  etablissement_id: string;
  nom: string;
  type: string;
  valeur: number;
  regles_json: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined;
};

const ALLOWED_TYPES = new Set(["PERCENT", "FIXED"]);
const ALLOWED_CATEGORIES = new Set([
  "REMISE_EXCEPTIONNELLE",
  "EXONERATION_PARTIELLE",
  "EXONERATION_TOTALE",
  "BOURSE",
  "PRISE_EN_CHARGE",
]);
const SENSITIVE_CATEGORIES = new Set([
  "EXONERATION_PARTIELLE",
  "EXONERATION_TOTALE",
  "BOURSE",
  "PRISE_EN_CHARGE",
]);

class RemiseApp {
  public app: Application;
  public router: Router;
  private remise: RemiseModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.remise = new RemiseModel();
    this.prisma = new PrismaClient();
    this.routes();
  }

  public routes(): Router {
    this.router.post("/", this.create.bind(this));
    this.router.post("/:id/approve", this.approve.bind(this));
    this.router.post("/:id/reject", this.reject.bind(this));
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
      throw new Error("Conflit d'etablissement detecte pour la remise.");
    }

    return tenantCandidates[0];
  }

  private normalizeRules(value: unknown, existingRules?: Prisma.JsonValue | null): Prisma.JsonValue | null {
    if (value == null || value === "") return null;
    let parsed: Prisma.JsonValue;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      try {
        parsed = JSON.parse(trimmed) as Prisma.JsonValue;
      } catch {
        throw new Error("Les regles de remise doivent etre un JSON valide.");
      }
    } else {
      parsed = value as Prisma.JsonValue;
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return parsed;
    }

    const rules = parsed as Record<string, unknown>;
    const category =
      typeof rules.nature_financiere === "string" ? rules.nature_financiere.trim().toUpperCase() : null;

    if (category && !ALLOWED_CATEGORIES.has(category)) {
      throw new Error("La categorie metier de la remise est invalide.");
    }

    if (category === "EXONERATION_TOTALE") {
      rules.plafond_exoneration = "TOTAL";
    }

    if ((category === "BOURSE" || category === "PRISE_EN_CHARGE")) {
      const tiers = Array.isArray(rules.tiers) ? rules.tiers : [];
      if (tiers.length === 0) {
        throw new Error("Une bourse ou prise en charge doit preciser au moins un organisme ou tiers.");
      }
    }

    const validationRequired =
      Boolean(rules.validation_requise) ||
      Boolean(rules.justificatif_obligatoire) ||
      Boolean(category && SENSITIVE_CATEGORIES.has(category));
    const existing =
      existingRules && typeof existingRules === "object" && !Array.isArray(existingRules)
        ? (existingRules as Record<string, unknown>)
        : null;
    const justificatifReference =
      typeof rules.justificatif_reference === "string" ? rules.justificatif_reference.trim() : "";
    const justificatifUrl =
      typeof rules.justificatif_url === "string" ? rules.justificatif_url.trim() : "";

    if (Boolean(rules.justificatif_obligatoire) && !justificatifReference && !justificatifUrl) {
      throw new Error("Un justificatif reference ou URL est requis pour cette remise.");
    }

    rules.validation_requise = validationRequired;

    if (typeof rules.statut_validation !== "string" || !rules.statut_validation.trim()) {
      rules.statut_validation =
        validationRequired
          ? (typeof existing?.statut_validation === "string" ? existing.statut_validation : "EN_ATTENTE")
          : "APPROUVEE";
    }

    if (!validationRequired) {
      rules.statut_validation = "APPROUVEE";
    }

    return rules as Prisma.JsonValue;
  }

  private toPrismaJson(value: Prisma.JsonValue | null) {
    if (value === null) return Prisma.JsonNull;
    return value as Prisma.InputJsonValue;
  }

  private normalizePayload(raw: Partial<Remise>, tenantId: string): RemisePayload {
    const nom = typeof raw.nom === "string" ? raw.nom.trim().replace(/\s+/g, " ") : "";
    const type = typeof raw.type === "string" ? raw.type.trim().toUpperCase() : "";
    const valeur = Number(raw.valeur ?? 0);

    if (!nom) {
      throw new Error("Le nom de la remise est requis.");
    }

    if (!ALLOWED_TYPES.has(type)) {
      throw new Error("Le type de remise doit etre `PERCENT` ou `FIXED`.");
    }

    if (!Number.isFinite(valeur) || valeur < 0) {
      throw new Error("La valeur de remise doit etre positive ou nulle.");
    }

    if (type === "PERCENT" && valeur > 100) {
      throw new Error("Une remise en pourcentage ne peut pas depasser 100.");
    }

    const normalizedRules = this.normalizeRules(
      raw.regles_json,
      (raw as Record<string, unknown>).regles_json as Prisma.JsonValue | null,
    );
    const category =
      normalizedRules &&
      typeof normalizedRules === "object" &&
      !Array.isArray(normalizedRules) &&
      typeof (normalizedRules as Record<string, unknown>).nature_financiere === "string"
        ? ((normalizedRules as Record<string, unknown>).nature_financiere as string).trim().toUpperCase()
        : null;

    if (category === "EXONERATION_TOTALE" && (type !== "PERCENT" || valeur !== 100)) {
      throw new Error("Une exoneration totale doit etre definie comme une remise de 100%.");
    }

    return {
      etablissement_id: tenantId,
      nom,
      type,
      valeur,
      regles_json: this.toPrismaJson(normalizedRules),
    };
  }

  private buildScopedWhere(existingWhere: Record<string, unknown>, tenantId: string) {
    if (!existingWhere || Object.keys(existingWhere).length === 0) {
      return { etablissement_id: tenantId };
    }

    return {
      AND: [existingWhere, { etablissement_id: tenantId }],
    };
  }

  private async ensureUniqueNom(data: RemisePayload, excludeId?: string) {
    const duplicate = await this.prisma.remise.findFirst({
      where: {
        etablissement_id: data.etablissement_id,
        nom: data.nom,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new Error("Une remise avec ce nom existe deja dans cet etablissement.");
    }
  }

  private async getScopedRemise(id: string, tenantId: string) {
    return this.prisma.remise.findFirst({
      where: { id, etablissement_id: tenantId },
    });
  }

  private async syncSupportingDocument(
    db: Prisma.TransactionClient | PrismaClient,
    args: {
      remiseId: string;
      tenantId: string;
      userId?: string | null;
      reglesJson: Prisma.JsonValue | null;
    },
  ) {
    if (!args.reglesJson || typeof args.reglesJson !== "object" || Array.isArray(args.reglesJson)) {
      return args.reglesJson;
    }

    const rules = { ...(args.reglesJson as Record<string, unknown>) };
    const archived = await archiveLinkedDocument(db, {
      tenantId: args.tenantId,
      ownerUserId: args.userId ?? null,
      entityType: "remises",
      entityId: args.remiseId,
      tag: "JUSTIFICATIF_REMISE",
      documentPath:
        typeof rules.justificatif_url === "string" ? rules.justificatif_url : null,
      documentReference:
        typeof rules.justificatif_reference === "string" ? rules.justificatif_reference : null,
    });

    if (!archived) {
      return rules as Prisma.JsonValue;
    }

    rules.fichier_archive_id = archived.id;
    rules.fichier_archive_chemin = archived.chemin;
    rules.fichier_archive_stockage = archived.fournisseur_stockage;
    rules.fichier_archive_tag = archived.tag;

    return rules as Prisma.JsonValue;
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const data = this.normalizePayload(req.body, tenantId);
      await this.ensureUniqueNom(data);
      const userId = (req as Request & { user?: { sub?: string } }).user?.sub ?? null;
      const result = await this.prisma.$transaction(async (tx) => {
        const created = await tx.remise.create({ data });
        const reglesJson = await this.syncSupportingDocument(tx, {
          remiseId: created.id,
          tenantId,
          userId,
          reglesJson: created.regles_json,
        });

        if (JSON.stringify(reglesJson ?? null) === JSON.stringify(created.regles_json ?? null)) {
          return created;
        }

        return tx.remise.update({
          where: { id: created.id },
          data: {
            regles_json: this.toPrismaJson(reglesJson),
          },
        });
      });
      Response.success(res, "Remise creee avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la creation de la remise", 400, error as Error);
      next(error);
    }
  }

  private async updateValidationStatus(
    id: string,
    tenantId: string,
    status: "APPROUVEE" | "REFUSEE",
    userId: string | null,
    motif?: string | null,
  ) {
    const existing = await this.prisma.remise.findFirst({
      where: { id, etablissement_id: tenantId },
      select: { id: true, regles_json: true },
    });

    if (!existing) {
      throw new Error("Remise introuvable pour cet etablissement.");
    }

    const rules =
      existing.regles_json && typeof existing.regles_json === "object" && !Array.isArray(existing.regles_json)
        ? { ...(existing.regles_json as Record<string, unknown>) }
        : {};

    rules.validation_requise = true;
    rules.statut_validation = status;
    if (status === "APPROUVEE") {
      rules.approuve_par = userId;
      rules.approuve_le = new Date().toISOString();
      if (motif) rules.validation_note = motif;
      delete rules.refus_motif;
    } else {
      rules.refuse_par = userId;
      rules.refuse_le = new Date().toISOString();
      rules.refus_motif = motif ?? null;
    }

    return this.remise.update(id, {
      regles_json: rules,
    });
  }

  private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const where = parseJSON<Record<string, unknown>>(req.query.where, {});
      const scopedQuery = {
        ...req.query,
        where: JSON.stringify(this.buildScopedWhere(where, tenantId)),
        orderBy: req.query.orderBy ?? JSON.stringify([{ nom: "asc" }, { created_at: "desc" }]),
      };
      const result = await getAllPaginated(scopedQuery as typeof req.query, this.remise);
      Response.success(res, "Liste des remises recuperee.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des remises", 400, error as Error);
      next(error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const includeSpec = parseJSON<Record<string, unknown>>(req.query.includeSpec, {});
      const result = await this.prisma.remise.findFirst({
        where: { id: req.params.id, etablissement_id: tenantId },
        include: includeSpec,
      });

      if (!result) {
        throw new Error("Remise introuvable pour cet etablissement.");
      }

      Response.success(res, "Detail de la remise.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation de la remise", 404, error as Error);
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedRemise(req.params.id, tenantId);

      if (!existing) {
        throw new Error("Remise introuvable pour cet etablissement.");
      }

      const result = await this.remise.delete(req.params.id);
      Response.success(res, "Remise supprimee avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la suppression de la remise", 400, error as Error);
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.prisma.remise.findFirst({
        where: { id: req.params.id, etablissement_id: tenantId },
      });

      if (!existing) {
        throw new Error("Remise introuvable pour cet etablissement.");
      }

      const data = this.normalizePayload(
        { ...existing, ...(req.body as Partial<Remise>) },
        tenantId,
      );

      await this.ensureUniqueNom(data, req.params.id);
      const userId = (req as Request & { user?: { sub?: string } }).user?.sub ?? null;
      const result = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.remise.update({
          where: { id: req.params.id },
          data,
        });
        const reglesJson = await this.syncSupportingDocument(tx, {
          remiseId: updated.id,
          tenantId,
          userId,
          reglesJson: updated.regles_json,
        });

        if (JSON.stringify(reglesJson ?? null) === JSON.stringify(updated.regles_json ?? null)) {
          return updated;
        }

        return tx.remise.update({
          where: { id: updated.id },
          data: {
            regles_json: this.toPrismaJson(reglesJson),
          },
        });
      });
      Response.success(res, "Remise mise a jour avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la mise a jour de la remise", 400, error as Error);
      next(error);
    }
  }

  private async approve(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const result = await this.updateValidationStatus(
        req.params.id,
        tenantId,
        "APPROUVEE",
        (req as Request & { user?: { sub?: string } }).user?.sub ?? null,
        typeof req.body?.motif === "string" ? req.body.motif.trim() : null,
      );
      Response.success(res, "Remise approuvee avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de l'approbation de la remise", 400, error as Error);
      next(error);
    }
  }

  private async reject(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const result = await this.updateValidationStatus(
        req.params.id,
        tenantId,
        "REFUSEE",
        (req as Request & { user?: { sub?: string } }).user?.sub ?? null,
        typeof req.body?.motif === "string" ? req.body.motif.trim() : null,
      );
      Response.success(res, "Remise refusee avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors du refus de la remise", 400, error as Error);
      next(error);
    }
  }
}

export default RemiseApp;
