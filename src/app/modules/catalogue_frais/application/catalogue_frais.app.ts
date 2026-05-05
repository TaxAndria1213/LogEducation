import { Application, NextFunction, Request, Response as R, Router } from "express";
import { Prisma, PrismaClient, type CatalogueFrais } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import CatalogueFraisModel from "../models/catalogue_frais.model";
import { prisma } from "../../../service/prisma";

type CatalogueFraisPayload = {
  etablissement_id: string;
  niveau_scolaire_id: string | null;
  usage_scope: string;
  nom: string;
  description: string | null;
  montant: number;
  devise: string;
  nombre_tranches: number;
  mode_facturation: string;
  est_recurrent: boolean;
  periodicite: string | null;
  prorata_eligible: boolean;
  eligibilite_json: Record<string, unknown> | null;
  plans_paiement_autorises_json: Prisma.InputJsonValue | null;
  plan_paiement_defaut_code: string | null;
};

type CataloguePaymentPlan = {
  code: string;
  label: string;
  nombre_tranches: number;
  offsets_mois: number[];
};

const ALLOWED_PERIODICITIES = new Set(["daily", "weekly", "monthly", "term", "semester", "year"]);
const ALLOWED_BILLING_MODES = new Set(["PONCTUEL", "ANNUEL", "RECURRENT"]);
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

const DEFAULT_SCOLARITE_PAYMENT_PLANS: CataloguePaymentPlan[] = [
  { code: "1X", label: "Comptant", nombre_tranches: 1, offsets_mois: [0] },
  { code: "3X", label: "3 tranches", nombre_tranches: 3, offsets_mois: [0, 4, 8] },
  {
    code: "10X",
    label: "10 tranches",
    nombre_tranches: 10,
    offsets_mois: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  },
];

const DEFAULT_INSCRIPTION_PAYMENT_PLANS: CataloguePaymentPlan[] = [
  { code: "1X", label: "Comptant", nombre_tranches: 1, offsets_mois: [0] },
  { code: "2X", label: "2 tranches", nombre_tranches: 2, offsets_mois: [0, 1] },
  { code: "3X", label: "3 tranches", nombre_tranches: 3, offsets_mois: [0, 1, 2] },
];

class CatalogueFraisApp {
  public app: Application;
  public router: Router;
  private catalogueFrais: CatalogueFraisModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.catalogueFrais = new CatalogueFraisModel();
    this.prisma = prisma;
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

  private normalizeLegacyTrancheCount(value: unknown) {
    const parsed = Number.parseInt(String(value ?? 1), 10);
    if (!Number.isFinite(parsed) || parsed < 1) return 1;
    return parsed;
  }

  private normalizeBillingMode(
    rawMode: unknown,
    usageScope: string,
    estRecurrent: boolean,
  ): string {
    if (usageScope === "SCOLARITE") {
      return "ANNUEL";
    }

    const normalized =
      typeof rawMode === "string" && rawMode.trim()
        ? rawMode.trim().toUpperCase()
        : null;

    if (estRecurrent) {
      return "RECURRENT";
    }

    if (normalized && ALLOWED_BILLING_MODES.has(normalized)) {
      return normalized;
    }

    return "PONCTUEL";
  }

  private normalizePaymentPlans(raw: unknown): CataloguePaymentPlan[] | null {
    if (raw == null || raw === "") return null;

    const parsed =
      typeof raw === "string"
        ? JSON.parse(raw)
        : raw;

    if (!Array.isArray(parsed)) {
      throw new Error("Les plans de paiement autorises doivent etre fournis sous forme de tableau JSON.");
    }

    const normalized = parsed.map((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        throw new Error(`Le plan de paiement #${index + 1} est invalide.`);
      }

      const rawPlan = entry as Record<string, unknown>;
      const code =
        typeof rawPlan.code === "string" ? rawPlan.code.trim().toUpperCase() : "";
      const label =
        typeof rawPlan.label === "string" ? rawPlan.label.trim() : "";
      const nombreTranches = this.normalizeLegacyTrancheCount(rawPlan.nombre_tranches);
      const offsets = Array.isArray(rawPlan.offsets_mois)
        ? rawPlan.offsets_mois.map((value, offsetIndex) => {
            const parsedOffset = Number.parseInt(String(value), 10);
            if (!Number.isFinite(parsedOffset) || parsedOffset < 0 || parsedOffset > 11) {
              throw new Error(
                `Le decalage mensuel #${offsetIndex + 1} du plan ${code || `#${index + 1}`} est invalide.`,
              );
            }
            return parsedOffset;
          })
        : [];

      if (!code) {
        throw new Error(`Le code du plan de paiement #${index + 1} est requis.`);
      }

      if (!label) {
        throw new Error(`Le libelle du plan de paiement ${code} est requis.`);
      }

      if (nombreTranches > 12) {
        throw new Error(`Le plan ${code} depasse la limite de 12 tranches annuelles.`);
      }

      if (offsets.length !== nombreTranches) {
        throw new Error(
          `Le plan ${code} doit definir ${nombreTranches} decalage(s) mensuel(s).`,
        );
      }

      if (new Set(offsets).size !== offsets.length) {
        throw new Error(`Le plan ${code} contient des decalages mensuels dupliques.`);
      }

      return {
        code,
        label,
        nombre_tranches: nombreTranches,
        offsets_mois: [...offsets].sort((left, right) => left - right),
      } satisfies CataloguePaymentPlan;
    });

    if (new Set(normalized.map((item) => item.code)).size !== normalized.length) {
      throw new Error("Chaque plan de paiement autorise doit avoir un code unique.");
    }

    return normalized;
  }

  private buildAnnualPlansFromLegacy(nombreTranches: number): CataloguePaymentPlan[] {
    const boundedTranches = Math.max(1, Math.min(12, nombreTranches));
    return [{
      code: `${boundedTranches}X`,
      label:
        boundedTranches === 1 ? "Comptant" : `${boundedTranches} tranches`,
      nombre_tranches: boundedTranches,
      offsets_mois: Array.from({ length: boundedTranches }, (_, index) => index),
    }];
  }

  private buildInscriptionPlansFromLegacy(nombreTranches: number): CataloguePaymentPlan[] {
    const boundedTranches = Math.max(1, Math.min(3, nombreTranches));
    return [{
      code: `${boundedTranches}X`,
      label: boundedTranches === 1 ? "Comptant" : `${boundedTranches} tranches`,
      nombre_tranches: boundedTranches,
      offsets_mois: Array.from({ length: boundedTranches }, (_, index) => index),
    }];
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
    const legacyNombreTranches = this.normalizeLegacyTrancheCount(raw.nombre_tranches);
    const rawEstRecurrent = Boolean(raw.est_recurrent);
    const rawPeriodicite =
      typeof raw.periodicite === "string" && raw.periodicite.trim()
        ? raw.periodicite.trim().toLowerCase()
        : null;
    const rawProrataEligible = Boolean(
      (raw as Partial<CatalogueFrais> & { prorata_eligible?: unknown }).prorata_eligible,
    );
    const eligibilite_json = this.normalizeEligibilityRules(
      (raw as Partial<CatalogueFrais> & { eligibilite_json?: unknown }).eligibilite_json,
    );
    const rawWithBilling = raw as Partial<CatalogueFrais> & {
      mode_facturation?: unknown;
      plans_paiement_autorises_json?: unknown;
      plan_paiement_defaut_code?: unknown;
    };
    let mode_facturation = this.normalizeBillingMode(
      rawWithBilling.mode_facturation,
      usage_scope,
      rawEstRecurrent,
    );
    let plans_paiement_autorises_json = this.normalizePaymentPlans(
      rawWithBilling.plans_paiement_autorises_json,
    );
    let plan_paiement_defaut_code =
      typeof rawWithBilling.plan_paiement_defaut_code === "string" &&
      rawWithBilling.plan_paiement_defaut_code.trim()
        ? rawWithBilling.plan_paiement_defaut_code.trim().toUpperCase()
        : null;
    let est_recurrent = rawEstRecurrent;
    let periodicite = rawPeriodicite;
    let prorata_eligible = rawProrataEligible;
    let nombre_tranches = legacyNombreTranches;
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

    if (mode_facturation === "RECURRENT" && (!periodicite || !ALLOWED_PERIODICITIES.has(periodicite))) {
      throw new Error("La periodicite est requise pour un frais recurrent.");
    }

    if (periodicite && !ALLOWED_PERIODICITIES.has(periodicite)) {
      throw new Error("La periodicite fournie n'est pas valide.");
    }

    if (usage_scope === "SCOLARITE") {
      if (rawEstRecurrent || rawPeriodicite || rawProrataEligible) {
        throw new Error("Un frais de scolarite doit etre annuel: il ne peut pas etre recurrent ni au prorata.");
      }

      mode_facturation = "ANNUEL";
      est_recurrent = false;
      periodicite = null;
      prorata_eligible = false;
      const annualPlans =
        plans_paiement_autorises_json ?? DEFAULT_SCOLARITE_PAYMENT_PLANS;
      plans_paiement_autorises_json = annualPlans;
      plan_paiement_defaut_code =
        plan_paiement_defaut_code ??
        (annualPlans.find((plan) => plan.code === "10X")?.code ??
          annualPlans[0]?.code ??
          null);
    }

    if (usage_scope === "INSCRIPTION") {
      if (rawEstRecurrent || rawPeriodicite || rawProrataEligible || mode_facturation === "RECURRENT") {
        throw new Error("Un droit d'inscription doit rester ponctuel: il ne peut pas etre recurrent ni au prorata.");
      }

      mode_facturation = "PONCTUEL";
      est_recurrent = false;
      periodicite = null;
      prorata_eligible = false;
      const inscriptionPlans =
        plans_paiement_autorises_json ?? this.buildInscriptionPlansFromLegacy(legacyNombreTranches);

      if (inscriptionPlans.some((plan) => plan.nombre_tranches > 3)) {
        throw new Error("Un droit d'inscription ne peut pas depasser 3 tranches autorisees.");
      }

      plans_paiement_autorises_json = inscriptionPlans;
      plan_paiement_defaut_code =
        plan_paiement_defaut_code ??
        (inscriptionPlans.find((plan) => plan.code === "1X")?.code ??
          inscriptionPlans[0]?.code ??
          null);
    }

    const planManagedMode = mode_facturation === "ANNUEL" || usage_scope === "INSCRIPTION";

    if (mode_facturation === "ANNUEL") {
      const annualPlans =
        plans_paiement_autorises_json ?? this.buildAnnualPlansFromLegacy(legacyNombreTranches);
      plans_paiement_autorises_json = annualPlans;
      plan_paiement_defaut_code =
        plan_paiement_defaut_code ?? annualPlans[0]?.code ?? null;
    }

    if (!planManagedMode) {
      plans_paiement_autorises_json = null;
      plan_paiement_defaut_code = null;
    }

    if (mode_facturation === "RECURRENT") {
      est_recurrent = true;
    }

    if (!est_recurrent) {
      periodicite = null;
      prorata_eligible = false;
    } else {
      prorata_eligible = periodicite === "monthly" ? prorata_eligible : false;
    }

    if (plans_paiement_autorises_json && plan_paiement_defaut_code) {
      const selectedPlan = plans_paiement_autorises_json.find(
        (plan) => plan.code === plan_paiement_defaut_code,
      );
      if (!selectedPlan) {
        throw new Error("Le plan de paiement annuel par defaut doit exister dans la liste des plans autorises.");
      }
      nombre_tranches = selectedPlan.nombre_tranches;
    }

    return {
      etablissement_id: tenantId,
      niveau_scolaire_id,
      usage_scope,
      nom,
      description,
      montant,
      devise,
      nombre_tranches,
      mode_facturation,
      est_recurrent,
      periodicite: est_recurrent ? periodicite : null,
      prorata_eligible,
      eligibilite_json,
      plans_paiement_autorises_json:
        plans_paiement_autorises_json != null
          ? (plans_paiement_autorises_json as Prisma.InputJsonValue)
          : null,
      plan_paiement_defaut_code,
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
      );    }
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
      );    }
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
      );    }
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
      );    }
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
      );    }
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

      Response.success(res, "BarÃ¨me approuve avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de l'approbation du barÃ¨me", 400, error as Error);    }
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
          : "BarÃ¨me rejete par la direction.";

      const result = await this.catalogueFrais.update(req.params.id, {
        statut_validation: "REJETEE",
        approuve_par_utilisateur_id: null,
        approuve_le: null,
        motif_rejet: motif,
      });

      Response.success(res, "BarÃ¨me rejete avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors du rejet du barÃ¨me", 400, error as Error);    }
  }
}

export default CatalogueFraisApp;

