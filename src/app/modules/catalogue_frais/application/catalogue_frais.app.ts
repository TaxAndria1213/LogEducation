import { Application, NextFunction, Request, Response as R, Router } from "express";
import { PrismaClient, type CatalogueFrais } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import CatalogueFraisModel from "../models/catalogue_frais.model";

type CatalogueFraisPayload = {
  etablissement_id: string;
  niveau_scolaire_id: string | null;
  usage_scope: string;
  nom: string;
  description: string | null;
  montant: number;
  devise: string;
  est_recurrent: boolean;
  periodicite: string | null;
  prorata_eligible: boolean;
  eligibilite_json: Record<string, unknown> | null;
};

const ALLOWED_PERIODICITIES = new Set(["daily", "weekly", "monthly", "term", "semester", "year"]);
const ALLOWED_USAGE_SCOPES = new Set([
  "GENERAL",
  "INSCRIPTION",
  "SCOLARITE",
  "TRANSPORT",
  "CANTINE",
  "OPTION_PEDAGOGIQUE",
  "ACTIVITE_EXTRASCOLAIRE",
  "FOURNITURE",
  "UNIFORME",
  "BADGE",
  "EXAMEN",
  "RATTRAPAGE",
  "COMPLEMENTAIRE",
]);

class CatalogueFraisApp {
  public app: Application;
  public router: Router;
  private catalogueFrais: CatalogueFraisModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.catalogueFrais = new CatalogueFraisModel();
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
      throw new Error("Conflit d'etablissement detecte pour le catalogue de frais.");
    }

    return tenantCandidates[0];
  }

  private getUserId(req: Request) {
    return (req as Request & { user?: { sub?: string } }).user?.sub ?? null;
  }

  private normalizeEligibilityRules(raw: unknown) {
    if (raw == null || raw === "") return null;

    const value =
      typeof raw === "string"
        ? parseJSON<Record<string, unknown>>(raw, {})
        : typeof raw === "object" && !Array.isArray(raw)
          ? (raw as Record<string, unknown>)
          : null;

    if (!value) {
      throw new Error("Les regles d'eligibilite doivent etre fournies sous forme d'objet JSON.");
    }

    const normalized: Record<string, unknown> = {};
    const normalizeStringArray = (input: unknown, label: string) => {
      if (input == null) return null;
      if (!Array.isArray(input)) {
        throw new Error(`La regle ${label} doit etre un tableau de chaines.`);
      }
      const items = input
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
      return items.length > 0 ? items : null;
    };

    const classeIds = normalizeStringArray(value.classe_ids, "classe_ids");
    const eleveIds = normalizeStringArray(value.eleve_ids, "eleve_ids");

    if (classeIds) normalized.classe_ids = classeIds;
    if (eleveIds) normalized.eleve_ids = eleveIds;

    return Object.keys(normalized).length > 0 ? normalized : null;
  }

  private normalizePayload(
    raw: Partial<CatalogueFrais>,
    tenantId: string,
  ): CatalogueFraisPayload {
    const rawWithNiveau = raw as Partial<CatalogueFrais> & {
      niveau_scolaire_id?: string | null;
    };
    const niveau_scolaire_id =
      typeof rawWithNiveau.niveau_scolaire_id === "string"
        ? rawWithNiveau.niveau_scolaire_id.trim() || null
        : null;
    const nom = typeof raw.nom === "string" ? raw.nom.trim().replace(/\s+/g, " ") : "";
    const description =
      typeof raw.description === "string" && raw.description.trim()
        ? raw.description.trim().replace(/\s+/g, " ")
        : null;
    const rawWithScope = raw as Partial<CatalogueFrais> & {
      usage_scope?: string | null;
    };
    const usage_scope =
      typeof rawWithScope.usage_scope === "string" && rawWithScope.usage_scope.trim()
        ? rawWithScope.usage_scope.trim().toUpperCase()
        : "GENERAL";
    const devise = typeof raw.devise === "string" && raw.devise.trim()
      ? raw.devise.trim().toUpperCase()
      : "MGA";
    const est_recurrent = Boolean(raw.est_recurrent);
    const periodicite =
      typeof raw.periodicite === "string" && raw.periodicite.trim()
        ? raw.periodicite.trim().toLowerCase()
        : null;
    const prorata_eligible = Boolean(
      (raw as Partial<CatalogueFrais> & { prorata_eligible?: unknown }).prorata_eligible,
    );
    const eligibilite_json = this.normalizeEligibilityRules(
      (raw as Partial<CatalogueFrais> & { eligibilite_json?: unknown }).eligibilite_json,
    );
    const montant = Number(raw.montant ?? 0);
    if (!nom) {
      throw new Error("Le nom du frais est requis.");
    }

    if (!Number.isFinite(montant) || montant < 0) {
      throw new Error("Le montant doit etre un nombre positif ou nul.");
    }

    if (!ALLOWED_USAGE_SCOPES.has(usage_scope)) {
      throw new Error("Le type d'usage du frais n'est pas valide.");
    }

    if (est_recurrent && (!periodicite || !ALLOWED_PERIODICITIES.has(periodicite))) {
      throw new Error("La periodicite est requise pour un frais recurrent.");
    }

    if (!est_recurrent && periodicite && !ALLOWED_PERIODICITIES.has(periodicite)) {
      throw new Error("La periodicite fournie n'est pas valide.");
    }

    return {
      etablissement_id: tenantId,
      niveau_scolaire_id,
      usage_scope,
      nom,
      description,
      montant,
      devise,
      est_recurrent,
      periodicite: est_recurrent ? periodicite : null,
      prorata_eligible: est_recurrent && periodicite === "monthly" ? prorata_eligible : false,
      eligibilite_json,
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

  private async ensureUniqueNom(data: CatalogueFraisPayload, excludeId?: string) {
    const duplicate = await this.prisma.catalogueFrais.findFirst({
      where: {
        etablissement_id: data.etablissement_id,
        niveau_scolaire_id: data.niveau_scolaire_id,
        nom: data.nom,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      } as never,
      select: { id: true },
    });

    if (duplicate) {
      throw new Error(
        data.niveau_scolaire_id
          ? "Un frais avec ce nom existe deja pour ce niveau dans cet etablissement."
          : "Un frais global avec ce nom existe deja dans cet etablissement.",
      );
    }
  }

  private async ensureScopedNiveau(niveauId: string | null, tenantId: string) {
    if (!niveauId) return;

    const niveau = await this.prisma.niveauScolaire.findFirst({
      where: {
        id: niveauId,
        etablissement_id: tenantId,
      },
      select: {
        id: true,
      },
    });

    if (!niveau) {
      throw new Error("Le niveau scolaire selectionne n'appartient pas a cet etablissement.");
    }
  }

  private async getScopedCatalogueFrais(id: string, tenantId: string) {
    return this.prisma.catalogueFrais.findFirst({
      where: { id, etablissement_id: tenantId },
      include: {
        _count: {
          select: {
            lignesFacture: true,
          },
        },
        niveau: true,
        approbateur: {
          select: {
            id: true,
            email: true,
          },
        },
      } as never,
    });
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const data = this.normalizePayload(req.body, tenantId);

      await this.ensureScopedNiveau(data.niveau_scolaire_id, tenantId);
      await this.ensureUniqueNom(data);

      const result = await this.catalogueFrais.create({
        ...data,
        statut_validation: "EN_ATTENTE",
        approuve_par_utilisateur_id: null,
        approuve_le: null,
        motif_rejet: null,
      });
      Response.success(res, "Frais catalogue cree avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la creation du frais catalogue",
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

      const result = await getAllPaginated(
        scopedQuery as typeof req.query,
        this.catalogueFrais,
      );
      Response.success(res, "Liste des frais catalogue recuperee.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation du catalogue de frais",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const includeSpec = parseJSON<Record<string, unknown>>(req.query.includeSpec, {});

      const result = await this.prisma.catalogueFrais.findFirst({
        where: { id: req.params.id, etablissement_id: tenantId },
        include: (Object.keys(includeSpec).length > 0 ? includeSpec : { niveau: true }) as never,
      });

      if (!result) {
        throw new Error("Frais catalogue introuvable pour cet etablissement.");
      }

      Response.success(res, "Detail du frais catalogue.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation du frais catalogue",
        404,
        error as Error,
      );
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedCatalogueFrais(req.params.id, tenantId);

      if (!existing) {
        throw new Error("Frais catalogue introuvable pour cet etablissement.");
      }

      if ((((existing as unknown as { _count?: { lignesFacture?: number } })._count?.lignesFacture) ?? 0) > 0) {
        throw new Error("Ce frais est deja utilise dans des factures et ne peut pas etre supprime.");
      }

      const result = await this.catalogueFrais.delete(req.params.id);
      Response.success(res, "Frais catalogue supprime avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la suppression du frais catalogue",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.prisma.catalogueFrais.findFirst({
        where: { id: req.params.id, etablissement_id: tenantId },
      });

      if (!existing) {
        throw new Error("Frais catalogue introuvable pour cet etablissement.");
      }

      const data = this.normalizePayload(
        { ...existing, ...(req.body as Partial<CatalogueFrais>) },
        tenantId,
      );

      await this.ensureScopedNiveau(data.niveau_scolaire_id, tenantId);
      await this.ensureUniqueNom(data, req.params.id);

      const result = await this.catalogueFrais.update(req.params.id, {
        ...data,
        statut_validation: "EN_ATTENTE",
        approuve_par_utilisateur_id: null,
        approuve_le: null,
        motif_rejet: null,
      });
      Response.success(res, "Frais catalogue mis a jour avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la mise a jour du frais catalogue",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async approve(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedCatalogueFrais(req.params.id, tenantId);

      if (!existing) {
        throw new Error("Frais catalogue introuvable pour cet etablissement.");
      }

      const result = await this.catalogueFrais.update(req.params.id, {
        statut_validation: "APPROUVEE",
        approuve_par_utilisateur_id: this.getUserId(req),
        approuve_le: new Date(),
        motif_rejet: null,
      });

      Response.success(res, "Barème approuve avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de l'approbation du barème", 400, error as Error);
      next(error);
    }
  }

  private async reject(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedCatalogueFrais(req.params.id, tenantId);

      if (!existing) {
        throw new Error("Frais catalogue introuvable pour cet etablissement.");
      }

      const motif =
        typeof req.body?.motif === "string" && req.body.motif.trim()
          ? req.body.motif.trim()
          : "Barème rejete par la direction.";

      const result = await this.catalogueFrais.update(req.params.id, {
        statut_validation: "REJETEE",
        approuve_par_utilisateur_id: null,
        approuve_le: null,
        motif_rejet: motif,
      });

      Response.success(res, "Barème rejete avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors du rejet du barème", 400, error as Error);
      next(error);
    }
  }
}

export default CatalogueFraisApp;
