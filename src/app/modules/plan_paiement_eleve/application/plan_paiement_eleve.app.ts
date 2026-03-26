import { Application, NextFunction, Request, Response as R, Router } from "express";
import { PrismaClient, type PlanPaiementEleve } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import {
  allocatePaiementsToFactureEcheances,
  hydratePlanEcheancesFromLegacyJson,
  normalizeText,
  resolveLinkedFactureIdForPlan,
  roundMoney,
  syncPlanJsonFromEcheances,
  toMoney,
  upsertPlanEcheances,
  type EcheanceInput,
} from "../../finance_shared/utils/echeance_paiement";
import PlanPaiementEleveModel from "../models/plan_paiement_eleve.model";

type PaymentScheduleLine = {
  echeance_paiement_id?: string | null;
  date: string;
  montant: number;
  statut?: string | null;
  note?: string | null;
  libelle?: string | null;
  paid_amount?: number | null;
  remaining_amount?: number | null;
};

type PlanPayload = {
  eleve_id: string;
  annee_scolaire_id: string;
  remise_id: string | null;
  plan_json: {
    mode_paiement: string;
    nombre_tranches: number;
    devise: string;
    remise_id: string | null;
    notes: string | null;
    echeances: PaymentScheduleLine[];
  };
};

class PlanPaiementEleveApp {
  public app: Application;
  public router: Router;
  private planPaiement: PlanPaiementEleveModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.planPaiement = new PlanPaiementEleveModel();
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
    const queryWhere = parseJSON<Record<string, unknown>>(req.query.where, {});
    const queryTenant =
      typeof queryWhere?.eleve === "object" &&
      queryWhere.eleve !== null &&
      "etablissement_id" in queryWhere.eleve &&
      typeof queryWhere.eleve.etablissement_id === "string"
        ? queryWhere.eleve.etablissement_id.trim()
        : undefined;

    const tenantCandidates = [requestTenant, queryTenant].filter(
      (value): value is string => Boolean(value),
    );

    if (tenantCandidates.length === 0) {
      throw new Error("Aucun etablissement actif n'a ete fourni.");
    }

    if (new Set(tenantCandidates).size > 1) {
      throw new Error("Conflit d'etablissement detecte pour le plan de paiement.");
    }

    return tenantCandidates[0];
  }

  private normalizeLine(raw: Record<string, unknown>, index: number): PaymentScheduleLine {
    const echeance_paiement_id =
      typeof raw.echeance_paiement_id === "string" && raw.echeance_paiement_id.trim()
        ? raw.echeance_paiement_id.trim()
        : null;
    const date = typeof raw.date === "string" ? raw.date.trim() : "";
    const montant = roundMoney(Number(raw.montant ?? 0));
    const statut = normalizeText(raw.statut);
    const note = normalizeText(raw.note);
    const libelle = normalizeText(raw.libelle);

    if (!date) {
      throw new Error(`La date de l'echeance ${index + 1} est requise.`);
    }

    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new Error(`La date de l'echeance ${index + 1} est invalide.`);
    }

    if (!Number.isFinite(montant) || montant < 0) {
      throw new Error(`Le montant de l'echeance ${index + 1} doit etre positif ou nul.`);
    }

    return {
      echeance_paiement_id,
      date: parsedDate.toISOString().slice(0, 10),
      montant,
      statut,
      note,
      libelle,
    };
  }

  private async ensureEleveAndAnnee(
    eleveId: string,
    anneeId: string,
    tenantId: string,
  ) {
    const eleve = await this.prisma.eleve.findFirst({
      where: { id: eleveId, etablissement_id: tenantId },
      select: { id: true },
    });

    if (!eleve) {
      throw new Error("L'eleve selectionne n'appartient pas a cet etablissement.");
    }

    const annee = await this.prisma.anneeScolaire.findFirst({
      where: { id: anneeId, etablissement_id: tenantId },
      select: { id: true },
    });

    if (!annee) {
      throw new Error("L'annee scolaire selectionnee n'appartient pas a cet etablissement.");
    }
  }

  private async ensureUniquePlan(
    eleveId: string,
    anneeId: string,
    excludeId?: string,
  ) {
    const duplicate = await this.prisma.planPaiementEleve.findFirst({
      where: {
        eleve_id: eleveId,
        annee_scolaire_id: anneeId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new Error("Un plan de paiement existe deja pour cet eleve sur cette annee.");
    }
  }

  private async resolveRemise(remiseId: string | null, tenantId: string) {
    if (!remiseId) return null;

    const remise = await this.prisma.remise.findFirst({
      where: {
        id: remiseId,
        etablissement_id: tenantId,
      },
      select: {
        id: true,
      },
    });

    if (!remise) {
      throw new Error("La remise selectionnee n'appartient pas a cet etablissement.");
    }

    return remise;
  }

  private normalizePayload(
    raw: Record<string, unknown>,
    currentPlanJson?: Record<string, unknown> | null,
  ): PlanPayload {
    const eleve_id = typeof raw.eleve_id === "string" ? raw.eleve_id.trim() : "";
    const annee_scolaire_id =
      typeof raw.annee_scolaire_id === "string" ? raw.annee_scolaire_id.trim() : "";
    const mode_paiement =
      typeof raw.mode_paiement === "string" && raw.mode_paiement.trim()
        ? raw.mode_paiement.trim().toUpperCase()
        : "ECHELONNE";
    const devise =
      typeof raw.devise === "string" && raw.devise.trim()
        ? raw.devise.trim().toUpperCase()
        : "MGA";
    const remise_id =
      typeof raw.remise_id === "string" && raw.remise_id.trim()
        ? raw.remise_id.trim()
        : raw.remise_id === null
          ? null
          : currentPlanJson && typeof currentPlanJson.remise_id === "string" && currentPlanJson.remise_id.trim()
            ? currentPlanJson.remise_id.trim()
            : null;
    const notes = normalizeText(raw.notes);
    const rawEcheances = Array.isArray(raw.echeances) ? raw.echeances : [];
    const echeances = rawEcheances.map((item, index) =>
      this.normalizeLine((item ?? {}) as Record<string, unknown>, index),
    );

    if (!eleve_id) {
      throw new Error("L'eleve est requis.");
    }

    if (!annee_scolaire_id) {
      throw new Error("L'annee scolaire est requise.");
    }

    if (echeances.length === 0) {
      throw new Error("Le plan de paiement doit contenir au moins une echeance.");
    }

    const extraKeys = currentPlanJson
      ? Object.fromEntries(
        Object.entries(currentPlanJson).filter(
          ([key]) =>
            !["mode_paiement", "nombre_tranches", "devise", "remise_id", "notes", "echeances"].includes(key),
        ),
      )
      : {};

    return {
      eleve_id,
      annee_scolaire_id,
      remise_id,
      plan_json: {
        ...extraKeys,
        mode_paiement,
        nombre_tranches: echeances.length,
        devise,
        remise_id,
        notes,
        echeances,
      },
    };
  }

  private buildScopedWhere(existingWhere: Record<string, unknown>, tenantId: string) {
    const scope = { eleve: { is: { etablissement_id: tenantId } } };
    if (!existingWhere || Object.keys(existingWhere).length === 0) {
      return scope;
    }

    return {
      AND: [existingWhere, scope],
    };
  }

  private getInclude() {
    return {
      eleve: {
        include: {
          utilisateur: {
            include: {
              profil: true,
            },
          },
        },
      },
      annee: true,
      remise: true,
      echeances: {
        include: {
          affectations: true,
        },
        orderBy: [{ ordre: "asc" as const }, { date_echeance: "asc" as const }],
      },
    };
  }

  private async getScopedPlan(id: string, tenantId: string) {
    return this.prisma.planPaiementEleve.findFirst({
      where: {
        id,
        eleve: { is: { etablissement_id: tenantId } },
      },
      include: this.getInclude(),
    });
  }

  private assertLockedEcheancesIntegrity(
    existingPlan: NonNullable<Awaited<ReturnType<PlanPaiementEleveApp["getScopedPlan"]>>>,
    submittedLines: PaymentScheduleLine[],
  ) {
    const existingEcheances = Array.isArray(existingPlan.echeances) ? existingPlan.echeances : [];
    const locked = existingEcheances.filter((item) => {
      const paidAmount = toMoney(item.montant_regle);
      const affectationCount = Array.isArray(item.affectations) ? item.affectations.length : 0;
      const status = (item.statut ?? "").toUpperCase();
      return paidAmount > 0 || affectationCount > 0 || status === "PARTIELLE" || status === "PAYEE";
    });

    if (locked.length === 0) return;

    for (const echeance of locked) {
      const byIdIndex = echeance.id
        ? submittedLines.findIndex((line) => line.echeance_paiement_id === echeance.id)
        : -1;
      const fallbackIndex = Math.max(0, Number(echeance.ordre ?? 1) - 1);
      const submittedIndex = byIdIndex >= 0 ? byIdIndex : fallbackIndex;
      const submitted = submittedLines[submittedIndex];

      if (!submitted) {
        throw new Error(
          `La tranche ${echeance.ordre} est deja encaissee et ne peut pas etre supprimee du plan.`,
        );
      }

      if (byIdIndex >= 0 && byIdIndex + 1 !== echeance.ordre) {
        throw new Error(
          `La tranche ${echeance.ordre} est deja encaissee et ne peut pas etre deplacee dans l'echeancier.`,
        );
      }

      const existingDate = new Date(echeance.date_echeance).toISOString().slice(0, 10);
      const submittedDate = new Date(submitted.date).toISOString().slice(0, 10);
      const existingAmount = roundMoney(toMoney(echeance.montant_prevu));
      const submittedAmount = roundMoney(toMoney(submitted.montant));

      if (existingDate !== submittedDate || existingAmount !== submittedAmount) {
        throw new Error(
          `La tranche ${echeance.ordre} est deja encaissee : sa date et son montant sont verrouilles.`,
        );
      }
    }
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const data = this.normalizePayload(req.body as Record<string, unknown>);

      await this.ensureEleveAndAnnee(data.eleve_id, data.annee_scolaire_id, tenantId);
      await this.ensureUniquePlan(data.eleve_id, data.annee_scolaire_id);
      await this.resolveRemise(data.remise_id, tenantId);

      const result = await this.prisma.$transaction(async (tx) => {
        const created = await tx.planPaiementEleve.create({
          data: {
            eleve_id: data.eleve_id,
            annee_scolaire_id: data.annee_scolaire_id,
            remise_id: data.remise_id,
            plan_json: data.plan_json,
          },
        }) as PlanPaiementEleve;
        const linkedFactureId = await resolveLinkedFactureIdForPlan(tx, created.id);
        if (linkedFactureId) {
          await tx.facture.update({
            where: { id: linkedFactureId },
            data: {
              remise_id: data.remise_id,
            },
          });
        }
        await upsertPlanEcheances(tx, {
          planId: created.id,
          factureId: linkedFactureId,
          eleveId: data.eleve_id,
          anneeScolaireId: data.annee_scolaire_id,
          devise: data.plan_json.devise,
          lines: data.plan_json.echeances as EcheanceInput[],
        });
        if (linkedFactureId) {
          await allocatePaiementsToFactureEcheances(tx, linkedFactureId);
        }
        await syncPlanJsonFromEcheances(tx, created.id);
        return tx.planPaiementEleve.findUnique({
          where: { id: created.id },
          include: this.getInclude(),
        });
      });

      const refreshed = result;
      Response.success(res, "Plan de paiement cree avec succes.", refreshed ?? result);
    } catch (error) {
      Response.error(res, "Erreur lors de la creation du plan de paiement", 400, error as Error);
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
        orderBy: req.query.orderBy ?? JSON.stringify([{ created_at: "desc" }]),
      };
      const result = await getAllPaginated(scopedQuery as typeof req.query, this.planPaiement);
      Response.success(res, "Liste des plans de paiement recuperee.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des plans de paiement", 400, error as Error);
      next(error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const includeSpec = parseJSON<Record<string, unknown>>(req.query.includeSpec, this.getInclude());
      await hydratePlanEcheancesFromLegacyJson(this.prisma, req.params.id);
      const result = await this.prisma.planPaiementEleve.findFirst({
        where: {
          id: req.params.id,
          eleve: { is: { etablissement_id: tenantId } },
        },
        include: includeSpec,
      });

      if (!result) {
        throw new Error("Plan de paiement introuvable pour cet etablissement.");
      }

      Response.success(res, "Detail du plan de paiement.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation du plan de paiement", 404, error as Error);
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedPlan(req.params.id, tenantId);

      if (!existing) {
        throw new Error("Plan de paiement introuvable pour cet etablissement.");
      }

      const hasLockedEcheances = (existing.echeances ?? []).some((item) => {
        const paidAmount = toMoney(item.montant_regle);
        const affectationCount = Array.isArray(item.affectations) ? item.affectations.length : 0;
        const status = (item.statut ?? "").toUpperCase();
        return paidAmount > 0 || affectationCount > 0 || status === "PARTIELLE" || status === "PAYEE";
      });

      if (hasLockedEcheances) {
        throw new Error(
          "Ce plan comporte deja des tranches encaissees. Il ne peut pas etre supprime.",
        );
      }

      const hasLinkedFacture = (existing.echeances ?? []).some((item) => Boolean(item.facture_id));
      if (hasLinkedFacture) {
        throw new Error(
          "Ce plan est deja rattache a une facture. Conserve-le ou traite le dossier depuis la facture liee.",
        );
      }

      const result = await this.planPaiement.delete(req.params.id);
      Response.success(res, "Plan de paiement supprime avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la suppression du plan de paiement", 400, error as Error);
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedPlan(req.params.id, tenantId);

      if (!existing) {
        throw new Error("Plan de paiement introuvable pour cet etablissement.");
      }

      const data = this.normalizePayload(
        req.body as Record<string, unknown>,
        (existing.plan_json as Record<string, unknown> | null | undefined) ?? null,
      );

      this.assertLockedEcheancesIntegrity(existing, data.plan_json.echeances);

      await this.ensureEleveAndAnnee(data.eleve_id, data.annee_scolaire_id, tenantId);
      await this.ensureUniquePlan(data.eleve_id, data.annee_scolaire_id, req.params.id);
      await this.resolveRemise(data.remise_id, tenantId);

      const result = await this.prisma.$transaction(async (tx) => {
        await tx.planPaiementEleve.update({
          where: { id: req.params.id },
          data: {
            ...data,
            remise_id: data.remise_id,
          },
        });
        const linkedFactureId = await resolveLinkedFactureIdForPlan(tx, req.params.id);
        if (linkedFactureId) {
          await tx.facture.update({
            where: { id: linkedFactureId },
            data: {
              remise_id: data.remise_id,
            },
          });
        }
        await upsertPlanEcheances(tx, {
          planId: req.params.id,
          factureId: linkedFactureId,
          eleveId: data.eleve_id,
          anneeScolaireId: data.annee_scolaire_id,
          devise: data.plan_json.devise,
          lines: data.plan_json.echeances as EcheanceInput[],
        });
        if (linkedFactureId) {
          await allocatePaiementsToFactureEcheances(tx, linkedFactureId);
        }
        await syncPlanJsonFromEcheances(tx, req.params.id);
        return tx.planPaiementEleve.findUnique({
          where: { id: req.params.id },
          include: this.getInclude(),
        });
      });
      const refreshed = result;
      Response.success(res, "Plan de paiement mis a jour avec succes.", refreshed ?? result);
    } catch (error) {
      Response.error(res, "Erreur lors de la mise a jour du plan de paiement", 400, error as Error);
      next(error);
    }
  }
}

export default PlanPaiementEleveApp;
