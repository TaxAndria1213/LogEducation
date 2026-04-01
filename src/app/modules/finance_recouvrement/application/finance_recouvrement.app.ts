import { Application, NextFunction, Request, Response as R, Router } from "express";
import { Prisma, PrismaClient } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import { assertDirectionUser } from "../../finance_shared/utils/direction_approval";
import {
  resolveLinkedFactureIdForPlan,
  syncFactureStatusFromEcheances,
  syncPlanJsonFromEcheances,
  toMoney,
} from "../../finance_shared/utils/echeance_paiement";
import {
  calculateRecoveryPenalty,
  getApprovedRecoveryPolicy,
  normalizeRelanceDays,
} from "../../finance_shared/utils/recovery_policy";
import {
  autoLiftAdministrativeRestrictions,
  computeOutstandingOverdueAmount,
} from "../../finance_shared/utils/recovery_restrictions";

type RequestWithAuth = Request & {
  tenantId?: string;
  user?: {
    sub?: string;
  };
};

type LinkedContext = {
  eleveId: string;
  anneeId: string;
  factureId: string | null;
  planId: string | null;
  echeanceId: string | null;
};

class FinanceRecouvrementApp {
  public app: Application;
  public router: Router;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.prisma = new PrismaClient();
    this.routes();
  }

  public routes(): Router {
    this.router.get("/policy", this.getPolicy.bind(this));
    this.router.put("/policy", this.upsertPolicy.bind(this));
    this.router.post("/policy/approve", this.approvePolicy.bind(this));
    this.router.post("/policy/reject", this.rejectPolicy.bind(this));

    this.router.post("/payment-promises", this.createPaymentPromise.bind(this));
    this.router.get("/payment-promises", this.getPaymentPromises.bind(this));
    this.router.post("/payment-promises/:id/keep", this.keepPaymentPromise.bind(this));
    this.router.post("/payment-promises/:id/break", this.breakPaymentPromise.bind(this));
    this.router.post("/payment-promises/:id/cancel", this.cancelPaymentPromise.bind(this));

    this.router.post("/administrative-restrictions", this.createAdministrativeRestriction.bind(this));
    this.router.get("/administrative-restrictions", this.getAdministrativeRestrictions.bind(this));
    this.router.post("/administrative-restrictions/:id/lift", this.liftAdministrativeRestriction.bind(this));

    this.router.post("/collection-cases", this.createCollectionCase.bind(this));
    this.router.get("/collection-cases", this.getCollectionCases.bind(this));
    this.router.post("/collection-cases/:id/status", this.updateCollectionCaseStatus.bind(this));
    return this.router;
  }

  private resolveTenantId(req: RequestWithAuth) {
    const tenantId = req.tenantId?.trim();
    if (!tenantId) {
      throw new Error("Aucun etablissement actif n'a ete fourni.");
    }
    return tenantId;
  }

  private resolveUserId(req: RequestWithAuth) {
    return req.user?.sub?.trim() ?? null;
  }

  private normalizeText(value: unknown) {
    if (typeof value !== "string") return null;
    const normalized = value.trim().replace(/\s+/g, " ");
    return normalized || null;
  }

  private toBool(value: unknown, fallback = false) {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "oui"].includes(normalized)) return true;
      if (["false", "0", "no", "non"].includes(normalized)) return false;
    }
    return fallback;
  }

  private toNumber(value: unknown, fallback = 0) {
    const number = Number(value ?? fallback);
    if (!Number.isFinite(number)) throw new Error("Une valeur numerique est invalide.");
    return Math.round(number * 100) / 100;
  }

  private buildScopedWhere(existingWhere: Record<string, unknown>, tenantId: string, relation = "eleve") {
    const scope =
      relation === "eleve"
        ? { eleve: { is: { etablissement_id: tenantId } } }
        : { etablissement_id: tenantId };
    if (!existingWhere || Object.keys(existingWhere).length === 0) return scope;
    return { AND: [existingWhere, scope] };
  }

  private normalizePolicyPayload(raw: Record<string, unknown>) {
    const relanceDays = normalizeRelanceDays(raw.relance_jours_json as Prisma.JsonValue);
    const penaliteActive = this.toBool(raw.penalite_active, false);
    const penaliteMode = penaliteActive
      ? String(raw.penalite_mode ?? "FIXED").trim().toUpperCase()
      : null;
    if (penaliteMode && !["FIXED", "PERCENT"].includes(penaliteMode)) {
      throw new Error("Le mode de penalite doit etre FIXED ou PERCENT.");
    }

    const penaliteValeur = penaliteActive ? this.toNumber(raw.penalite_valeur ?? 0) : null;
    if (penaliteActive && (!penaliteValeur || penaliteValeur <= 0)) {
      throw new Error("Une valeur de penalite positive est requise.");
    }

    return {
      nom: this.normalizeText(raw.nom) ?? "Regle de recouvrement par defaut",
      jours_grace: Math.max(0, Math.trunc(Number(raw.jours_grace ?? 0) || 0)),
      relance_jours_json: relanceDays,
      penalite_active: penaliteActive,
      penalite_mode: penaliteMode,
      penalite_valeur: penaliteValeur,
    };
  }

  private async resolveLinkedContext(
    tenantId: string,
    raw: Record<string, unknown>,
    tx: PrismaClient | Prisma.TransactionClient = this.prisma,
  ): Promise<LinkedContext> {
    const factureId =
      typeof raw.facture_id === "string" && raw.facture_id.trim() ? raw.facture_id.trim() : null;
    const planId =
      typeof raw.plan_paiement_id === "string" && raw.plan_paiement_id.trim()
        ? raw.plan_paiement_id.trim()
        : null;
    const echeanceId =
      typeof raw.echeance_paiement_id === "string" && raw.echeance_paiement_id.trim()
        ? raw.echeance_paiement_id.trim()
        : null;
    const directEleveId =
      typeof raw.eleve_id === "string" && raw.eleve_id.trim() ? raw.eleve_id.trim() : null;
    const directAnneeId =
      typeof raw.annee_scolaire_id === "string" && raw.annee_scolaire_id.trim()
        ? raw.annee_scolaire_id.trim()
        : null;

    const contexts: LinkedContext[] = [];

    if (factureId) {
      const facture = await tx.facture.findFirst({
        where: { id: factureId, etablissement_id: tenantId },
        select: { id: true, eleve_id: true, annee_scolaire_id: true },
      });
      if (!facture) throw new Error("La facture selectionnee n'appartient pas a cet etablissement.");
      contexts.push({
        eleveId: facture.eleve_id,
        anneeId: facture.annee_scolaire_id,
        factureId: facture.id,
        planId: null,
        echeanceId: null,
      });
    }

    if (planId) {
      const plan = await tx.planPaiementEleve.findFirst({
        where: { id: planId, eleve: { etablissement_id: tenantId } } as never,
        select: { id: true, eleve_id: true, annee_scolaire_id: true },
      });
      if (!plan) throw new Error("Le plan de paiement selectionne n'appartient pas a cet etablissement.");
      contexts.push({
        eleveId: plan.eleve_id,
        anneeId: plan.annee_scolaire_id,
        factureId: null,
        planId: plan.id,
        echeanceId: null,
      });
    }

    if (echeanceId) {
      const echeance = await tx.echeancePaiement.findFirst({
        where: { id: echeanceId, eleve: { etablissement_id: tenantId } } as never,
        select: {
          id: true,
          eleve_id: true,
          annee_scolaire_id: true,
          facture_id: true,
          plan_paiement_id: true,
        },
      });
      if (!echeance) throw new Error("L'echeance selectionnee n'appartient pas a cet etablissement.");
      contexts.push({
        eleveId: echeance.eleve_id,
        anneeId: echeance.annee_scolaire_id,
        factureId: echeance.facture_id,
        planId: echeance.plan_paiement_id,
        echeanceId: echeance.id,
      });
    }

    if (directEleveId && directAnneeId) {
      const eleve = await tx.eleve.findFirst({
        where: { id: directEleveId, etablissement_id: tenantId },
        select: { id: true },
      });
      if (!eleve) throw new Error("L'eleve selectionne n'appartient pas a cet etablissement.");
      const annee = await tx.anneeScolaire.findFirst({
        where: { id: directAnneeId, etablissement_id: tenantId },
        select: { id: true },
      });
      if (!annee) throw new Error("L'annee scolaire selectionnee n'appartient pas a cet etablissement.");
      contexts.push({
        eleveId: directEleveId,
        anneeId: directAnneeId,
        factureId,
        planId,
        echeanceId,
      });
    }

    if (contexts.length === 0) {
      throw new Error("Selectionne au moins un eleve et une annee, ou une facture, ou un plan, ou une echeance.");
    }

    const uniqueEleves = new Set(contexts.map((item) => item.eleveId));
    const uniqueAnnees = new Set(contexts.map((item) => item.anneeId));
    if (uniqueEleves.size > 1 || uniqueAnnees.size > 1) {
      throw new Error("Les liens de recouvrement selectionnes ne pointent pas vers le meme eleve ou la meme annee.");
    }

    return contexts.reduce<LinkedContext>(
      (acc, item) => ({
        eleveId: item.eleveId,
        anneeId: item.anneeId,
        factureId: acc.factureId ?? item.factureId,
        planId: acc.planId ?? item.planId,
        echeanceId: acc.echeanceId ?? item.echeanceId,
      }),
      {
        eleveId: contexts[0].eleveId,
        anneeId: contexts[0].anneeId,
        factureId: null,
        planId: null,
        echeanceId: null,
      },
    );
  }

  private async getPolicy(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req as RequestWithAuth);
      const policy = await this.prisma.regleRecouvrementFinance.findFirst({
        where: { etablissement_id: tenantId },
      });
      Response.success(res, "Regle de recouvrement.", policy);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation de la regle de recouvrement", 400, error as Error);
      next(error);
    }
  }

  private async upsertPolicy(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req as RequestWithAuth);
      const data = this.normalizePolicyPayload(req.body as Record<string, unknown>);
      const existing = await this.prisma.regleRecouvrementFinance.findFirst({
        where: { etablissement_id: tenantId },
        select: { id: true },
      });

      const policy = existing
        ? await this.prisma.regleRecouvrementFinance.update({
            where: { id: existing.id },
            data: {
              ...data,
              statut_validation: "EN_ATTENTE",
              approuve_par_utilisateur_id: null,
              approuve_le: null,
              motif_rejet: null,
            } as never,
          })
        : await this.prisma.regleRecouvrementFinance.create({
            data: {
              etablissement_id: tenantId,
              ...data,
            } as never,
          });

      Response.success(res, "Regle de recouvrement enregistree.", policy);
    } catch (error) {
      Response.error(res, "Erreur lors de l'enregistrement de la regle de recouvrement", 400, error as Error);
      next(error);
    }
  }

  private async approvePolicy(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req as RequestWithAuth);
      const userId = this.resolveUserId(req as RequestWithAuth);
      if (!userId) throw new Error("Aucun utilisateur validateur n'a ete detecte.");
      await assertDirectionUser(
        this.prisma,
        userId,
        tenantId,
        "Seule la direction peut approuver une regle de recouvrement.",
      );

      const policy = await this.prisma.regleRecouvrementFinance.findFirst({
        where: { etablissement_id: tenantId },
        select: { id: true },
      });
      if (!policy) throw new Error("Aucune regle de recouvrement n'est configuree.");

      const updated = await this.prisma.regleRecouvrementFinance.update({
        where: { id: policy.id },
        data: {
          statut_validation: "APPROUVEE",
          approuve_par_utilisateur_id: userId,
          approuve_le: new Date(),
          motif_rejet: null,
        } as never,
      });

      Response.success(res, "Regle de recouvrement approuvee.", updated);
    } catch (error) {
      Response.error(res, "Erreur lors de l'approbation de la regle de recouvrement", 400, error as Error);
      next(error);
    }
  }

  private async rejectPolicy(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req as RequestWithAuth);
      const policy = await this.prisma.regleRecouvrementFinance.findFirst({
        where: { etablissement_id: tenantId },
        select: { id: true },
      });
      if (!policy) throw new Error("Aucune regle de recouvrement n'est configuree.");

      const motif = this.normalizeText((req.body as Record<string, unknown>).motif);
      const updated = await this.prisma.regleRecouvrementFinance.update({
        where: { id: policy.id },
        data: {
          statut_validation: "REJETEE",
          motif_rejet: motif,
          approuve_par_utilisateur_id: null,
          approuve_le: null,
        } as never,
      });

      Response.success(res, "Regle de recouvrement rejetee.", updated);
    } catch (error) {
      Response.error(res, "Erreur lors du rejet de la regle de recouvrement", 400, error as Error);
      next(error);
    }
  }

  private async createPaymentPromise(req: Request, res: R, next: NextFunction) {
    try {
      const request = req as RequestWithAuth;
      const tenantId = this.resolveTenantId(request);
      const userId = this.resolveUserId(request);
      const context = await this.resolveLinkedContext(tenantId, req.body as Record<string, unknown>);
      const montantPromis = this.toNumber((req.body as Record<string, unknown>).montant_promis ?? 0);
      const dateLimite = new Date((req.body as Record<string, unknown>).date_limite as string);
      if (montantPromis <= 0) throw new Error("Le montant promis doit etre strictement positif.");
      if (Number.isNaN(dateLimite.getTime())) throw new Error("La date limite de promesse est invalide.");

      const promise = await this.prisma.promessePaiement.create({
        data: {
          etablissement_id: tenantId,
          eleve_id: context.eleveId,
          annee_scolaire_id: context.anneeId,
          facture_id: context.factureId,
          plan_paiement_id: context.planId,
          echeance_paiement_id: context.echeanceId,
          montant_promis: montantPromis,
          date_limite: dateLimite,
          canal: this.normalizeText((req.body as Record<string, unknown>).canal),
          note: this.normalizeText((req.body as Record<string, unknown>).note),
          cree_par_utilisateur_id: userId,
        } as never,
      });

      Response.success(res, "Promesse de paiement enregistree.", promise);
    } catch (error) {
      Response.error(res, "Erreur lors de l'enregistrement de la promesse de paiement", 400, error as Error);
      next(error);
    }
  }

  private async getPaymentPromises(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req as RequestWithAuth);
      const where = parseJSON<Record<string, unknown>>(req.query.where, {});
      const scopedWhere = this.buildScopedWhere(where, tenantId);
      const rows = await this.prisma.promessePaiement.findMany({
        where: scopedWhere as never,
        orderBy: [{ date_limite: "asc" }, { created_at: "desc" }],
      });
      Response.success(res, "Promesses de paiement.", rows);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des promesses de paiement", 400, error as Error);
      next(error);
    }
  }

  private async keepPaymentPromise(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req as RequestWithAuth);
      const userId = this.resolveUserId(req as RequestWithAuth);
      const promise = await this.prisma.promessePaiement.findFirst({
        where: { id: req.params.id, etablissement_id: tenantId } as never,
      });
      if (!promise) throw new Error("Promesse de paiement introuvable.");

      const overdueAmount = await computeOutstandingOverdueAmount(
        this.prisma,
        promise.eleve_id,
        promise.annee_scolaire_id,
      );
      if (overdueAmount > 0) {
        throw new Error("La dette en retard n'est pas encore soldee. La promesse ne peut pas etre marquee comme tenue.");
      }

      const updated = await this.prisma.promessePaiement.update({
        where: { id: promise.id },
        data: {
          statut: "TENUE",
          tenue_le: new Date(),
          valide_par_utilisateur_id: userId,
        } as never,
      });

      await autoLiftAdministrativeRestrictions(this.prisma, {
        tenantId,
        eleveId: promise.eleve_id,
        anneeScolaireId: promise.annee_scolaire_id,
        utilisateurId: userId,
      });

      Response.success(res, "Promesse de paiement marquee comme tenue.", updated);
    } catch (error) {
      Response.error(res, "Erreur lors de la validation de la promesse de paiement", 400, error as Error);
      next(error);
    }
  }

  private async breakPaymentPromise(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req as RequestWithAuth);
      const userId = this.resolveUserId(req as RequestWithAuth);
      const updated = await this.prisma.promessePaiement.updateMany({
        where: { id: req.params.id, etablissement_id: tenantId } as never,
        data: {
          statut: "ROMPUE",
          rompue_le: new Date(),
          valide_par_utilisateur_id: userId,
        } as never,
      });
      if (updated.count === 0) throw new Error("Promesse de paiement introuvable.");
      Response.success(res, "Promesse de paiement marquee comme rompue.", { updated: updated.count });
    } catch (error) {
      Response.error(res, "Erreur lors du traitement de la promesse de paiement", 400, error as Error);
      next(error);
    }
  }

  private async cancelPaymentPromise(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req as RequestWithAuth);
      const userId = this.resolveUserId(req as RequestWithAuth);
      const updated = await this.prisma.promessePaiement.updateMany({
        where: { id: req.params.id, etablissement_id: tenantId } as never,
        data: {
          statut: "ANNULEE",
          annulee_le: new Date(),
          valide_par_utilisateur_id: userId,
        } as never,
      });
      if (updated.count === 0) throw new Error("Promesse de paiement introuvable.");
      Response.success(res, "Promesse de paiement annulee.", { updated: updated.count });
    } catch (error) {
      Response.error(res, "Erreur lors de l'annulation de la promesse de paiement", 400, error as Error);
      next(error);
    }
  }

  private async createAdministrativeRestriction(req: Request, res: R, next: NextFunction) {
    try {
      const request = req as RequestWithAuth;
      const tenantId = this.resolveTenantId(request);
      const userId = this.resolveUserId(request);
      const context = await this.resolveLinkedContext(tenantId, req.body as Record<string, unknown>);
      const type = String((req.body as Record<string, unknown>).type ?? "").trim().toUpperCase();
      if (!["BULLETIN", "EXAMEN", "REINSCRIPTION"].includes(type)) {
        throw new Error("Le type de restriction administrative est invalide.");
      }

      const overdueAmount = await computeOutstandingOverdueAmount(
        this.prisma,
        context.eleveId,
        context.anneeId,
      );
      if (overdueAmount <= 0) {
        throw new Error("Aucun impaye en retard ne justifie un blocage administratif.");
      }

      const restriction = await this.prisma.restrictionAdministrative.create({
        data: {
          etablissement_id: tenantId,
          eleve_id: context.eleveId,
          annee_scolaire_id: context.anneeId,
          facture_id: context.factureId,
          plan_paiement_id: context.planId,
          type,
          source: this.normalizeText((req.body as Record<string, unknown>).source) ?? "MANUEL",
          motif: this.normalizeText((req.body as Record<string, unknown>).motif),
          cree_par_utilisateur_id: userId,
        } as never,
      });

      Response.success(res, "Restriction administrative creee.", restriction);
    } catch (error) {
      Response.error(res, "Erreur lors de la creation de la restriction administrative", 400, error as Error);
      next(error);
    }
  }

  private async getAdministrativeRestrictions(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req as RequestWithAuth);
      const where = parseJSON<Record<string, unknown>>(req.query.where, {});
      const rows = await this.prisma.restrictionAdministrative.findMany({
        where: this.buildScopedWhere(where, tenantId) as never,
        orderBy: [{ created_at: "desc" }],
      });
      Response.success(res, "Restrictions administratives.", rows);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des restrictions administratives", 400, error as Error);
      next(error);
    }
  }

  private async liftAdministrativeRestriction(req: Request, res: R, next: NextFunction) {
    try {
      const request = req as RequestWithAuth;
      const tenantId = this.resolveTenantId(request);
      const userId = this.resolveUserId(request);
      const restriction = await this.prisma.restrictionAdministrative.findFirst({
        where: { id: req.params.id, etablissement_id: tenantId } as never,
      });
      if (!restriction) throw new Error("Restriction administrative introuvable.");

      const overdueAmount = await computeOutstandingOverdueAmount(
        this.prisma,
        restriction.eleve_id,
        restriction.annee_scolaire_id,
      );
      if (overdueAmount > 0) {
        throw new Error("La dette en retard n'est pas encore soldee. Le blocage ne peut pas etre leve.");
      }

      const updated = await this.prisma.restrictionAdministrative.update({
        where: { id: restriction.id },
        data: {
          statut: "LEVEE",
          date_levee: new Date(),
          levee_par_utilisateur_id: userId,
        } as never,
      });

      Response.success(res, "Restriction administrative levee.", updated);
    } catch (error) {
      Response.error(res, "Erreur lors de la levee de la restriction administrative", 400, error as Error);
      next(error);
    }
  }

  private async createCollectionCase(req: Request, res: R, next: NextFunction) {
    try {
      const request = req as RequestWithAuth;
      const tenantId = this.resolveTenantId(request);
      const userId = this.resolveUserId(request);
      const context = await this.resolveLinkedContext(tenantId, req.body as Record<string, unknown>);
      const statut = String((req.body as Record<string, unknown>).statut ?? "OUVERT").trim().toUpperCase();
      if (!["OUVERT", "RENFORCE", "CONTENTIEUX", "IRRECOUVRABLE", "ABANDON_EN_ATTENTE"].includes(statut)) {
        throw new Error("Le statut initial du dossier de recouvrement est invalide.");
      }

      const overdueAmount = await computeOutstandingOverdueAmount(
        this.prisma,
        context.eleveId,
        context.anneeId,
      );

      const dossier = await this.prisma.dossierRecouvrement.create({
        data: {
          etablissement_id: tenantId,
          eleve_id: context.eleveId,
          annee_scolaire_id: context.anneeId,
          facture_id: context.factureId,
          plan_paiement_id: context.planId,
          statut,
          motif: this.normalizeText((req.body as Record<string, unknown>).motif),
          note: this.normalizeText((req.body as Record<string, unknown>).note),
          montant_reference: overdueAmount,
          cree_par_utilisateur_id: userId,
        } as never,
      });

      Response.success(res, "Dossier de recouvrement cree.", dossier);
    } catch (error) {
      Response.error(res, "Erreur lors de la creation du dossier de recouvrement", 400, error as Error);
      next(error);
    }
  }

  private async getCollectionCases(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req as RequestWithAuth);
      const where = parseJSON<Record<string, unknown>>(req.query.where, {});
      const rows = await this.prisma.dossierRecouvrement.findMany({
        where: this.buildScopedWhere(where, tenantId) as never,
        orderBy: [{ date_statut: "desc" }, { created_at: "desc" }],
      });
      Response.success(res, "Dossiers de recouvrement.", rows);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des dossiers de recouvrement", 400, error as Error);
      next(error);
    }
  }

  private async writeOffOutstandingDebt(
    tx: Prisma.TransactionClient,
    args: {
      tenantId: string;
      dossier: {
        id: string;
        eleve_id: string;
        annee_scolaire_id: string;
        facture_id: string | null;
        plan_paiement_id: string | null;
      };
      userId?: string | null;
      motif?: string | null;
    },
  ) {
    const factureId =
      args.dossier.facture_id ??
      (args.dossier.plan_paiement_id
        ? await resolveLinkedFactureIdForPlan(tx, args.dossier.plan_paiement_id)
        : null);

    const where: Prisma.EcheancePaiementWhereInput = {
      eleve_id: args.dossier.eleve_id,
      annee_scolaire_id: args.dossier.annee_scolaire_id,
      statut: { notIn: ["PAYEE", "ANNULEE"] },
      montant_restant: { gt: 0 },
    };
    if (factureId) where.facture_id = factureId;
    else if (args.dossier.plan_paiement_id) where.plan_paiement_id = args.dossier.plan_paiement_id;

    const openEcheances = await tx.echeancePaiement.findMany({
      where,
      select: {
        id: true,
        montant_restant: true,
      },
    });

    const abandonedAmount = openEcheances.reduce((sum, item) => sum + toMoney(item.montant_restant), 0);
    if (abandonedAmount <= 0) return 0;

    for (const echeance of openEcheances) {
      await tx.echeancePaiement.update({
        where: { id: echeance.id },
        data: {
          montant_restant: 0,
          statut: "ANNULEE",
          notes: args.motif ?? "Abandon exceptionnel de creance approuve.",
        } as never,
      });
    }

    if (args.dossier.plan_paiement_id) {
      await syncPlanJsonFromEcheances(tx, args.dossier.plan_paiement_id);
    }
    if (factureId) {
      await syncFactureStatusFromEcheances(tx, factureId);
      await tx.operationFinanciere.create({
        data: {
          etablissement_id: args.tenantId,
          facture_id: factureId,
          cree_par_utilisateur_id: args.userId ?? null,
          type: "ABANDON_CREANCE",
          montant: abandonedAmount,
          motif: args.motif ?? "Abandon exceptionnel de creance.",
          details_json: {
            dossier_recouvrement_id: args.dossier.id,
            nombre_echeances: openEcheances.length,
          },
        } as never,
      });
    }

    return abandonedAmount;
  }

  private async updateCollectionCaseStatus(req: Request, res: R, next: NextFunction) {
    try {
      const request = req as RequestWithAuth;
      const tenantId = this.resolveTenantId(request);
      const userId = this.resolveUserId(request);
      const dossier = await this.prisma.dossierRecouvrement.findFirst({
        where: { id: req.params.id, etablissement_id: tenantId } as never,
      });
      if (!dossier) throw new Error("Dossier de recouvrement introuvable.");

      const nextStatus = String((req.body as Record<string, unknown>).statut ?? "").trim().toUpperCase();
      if (
        ![
          "OUVERT",
          "RENFORCE",
          "CONTENTIEUX",
          "IRRECOUVRABLE",
          "ABANDON_EN_ATTENTE",
          "ABANDONNE",
          "CLOTURE",
        ].includes(nextStatus)
      ) {
        throw new Error("Le nouveau statut de recouvrement est invalide.");
      }

      const motif = this.normalizeText((req.body as Record<string, unknown>).motif);
      const note = this.normalizeText((req.body as Record<string, unknown>).note);

      if (["ABANDON_EN_ATTENTE", "ABANDONNE", "IRRECOUVRABLE"].includes(nextStatus)) {
        await assertDirectionUser(
          this.prisma,
          userId,
          tenantId,
          "Seule la direction peut valider ce statut de recouvrement.",
        );
      }

      const updated = await this.prisma.$transaction(async (tx) => {
        if (nextStatus === "ABANDONNE") {
          if ((dossier.statut ?? "").toUpperCase() !== "ABANDON_EN_ATTENTE") {
            throw new Error("Le dossier doit d'abord passer en abandon en attente avant validation finale.");
          }
          await this.writeOffOutstandingDebt(tx, {
            tenantId,
            dossier,
            userId,
            motif,
          });
        }

        return tx.dossierRecouvrement.update({
          where: { id: dossier.id },
          data: {
            statut: nextStatus,
            motif: motif ?? dossier.motif,
            note: note ?? dossier.note,
            date_statut: new Date(),
            valide_par_utilisateur_id:
              nextStatus === "ABANDONNE" || nextStatus === "IRRECOUVRABLE" ? userId : dossier.valide_par_utilisateur_id,
            valide_le:
              nextStatus === "ABANDONNE" || nextStatus === "IRRECOUVRABLE" ? new Date() : dossier.valide_le,
          } as never,
        });
      });

      Response.success(res, "Statut du dossier de recouvrement mis a jour.", updated);
    } catch (error) {
      Response.error(res, "Erreur lors de la mise a jour du dossier de recouvrement", 400, error as Error);
      next(error);
    }
  }

  public static async suggestPenaltyForOverdueSelection(
    prisma: PrismaClient | Prisma.TransactionClient,
    tenantId: string,
    factureId: string,
    paymentDate: Date,
  ) {
    const policy = await getApprovedRecoveryPolicy(prisma, tenantId);
    if (!policy) return 0;

    const overdueEcheance = await prisma.echeancePaiement.findFirst({
      where: {
        facture_id: factureId,
        statut: { notIn: ["PAYEE", "ANNULEE"] },
        montant_restant: { gt: 0 },
      } as never,
      orderBy: [{ date_echeance: "asc" }],
      select: {
        date_echeance: true,
        montant_restant: true,
      },
    });
    if (!overdueEcheance) return 0;

    return calculateRecoveryPenalty({
      policy,
      overdueAmount: toMoney(overdueEcheance.montant_restant),
      dueDate: overdueEcheance.date_echeance,
      paymentDate,
    });
  }
}

export default FinanceRecouvrementApp;


