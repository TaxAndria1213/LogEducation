import { Application, NextFunction, Request, Response as R, Router } from "express";
import { PrismaClient, type Paiement, type Prisma, type StatutFacture } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import { allocatePaiementsToFactureEcheances } from "../../finance_shared/utils/echeance_paiement";
import PaiementModel from "../models/paiement.model";

type PaiementPayload = {
  facture_id: string;
  paye_le: Date;
  montant: number;
  statut: string;
  methode: string | null;
  reference: string | null;
  recu_par: string | null;
  echeance_ids: string[];
};

type PaiementOperationPayload = {
  motif: string | null;
};

type OperationFinanciereDelegate = {
  create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
};

type TransactionWithFinance = Prisma.TransactionClient & {
  operationFinanciere: OperationFinanciereDelegate;
};

type PaiementRecord = Paiement & {
  statut?: string | null;
};

class PaiementApp {
  public app: Application;
  public router: Router;
  private paiement: PaiementModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.paiement = new PaiementModel();
    this.prisma = new PrismaClient();
    this.routes();
  }

  public routes(): Router {
    this.router.post("/", this.create.bind(this));
    this.router.get("/", this.getAll.bind(this));
    this.router.get("/:id", this.getOne.bind(this));
    this.router.post("/:id/cancel", this.cancel.bind(this));
    this.router.post("/:id/refund", this.refund.bind(this));
    this.router.delete("/:id", this.delete.bind(this));
    this.router.put("/:id", this.update.bind(this));
    return this.router;
  }

  private resolveTenantId(req: Request): string {
    const requestTenant = (req as Request & { tenantId?: string }).tenantId;
    const queryWhere = parseJSON<Record<string, unknown>>(req.query.where, {});
    const queryTenant =
      typeof queryWhere?.facture === "object" &&
      queryWhere.facture !== null &&
      "etablissement_id" in queryWhere.facture &&
      typeof queryWhere.facture.etablissement_id === "string"
        ? queryWhere.facture.etablissement_id.trim()
        : undefined;

    const tenantCandidates = [requestTenant, queryTenant].filter(
      (value): value is string => Boolean(value),
    );

    if (tenantCandidates.length === 0) {
      throw new Error("Aucun etablissement actif n'a ete fourni.");
    }

    if (new Set(tenantCandidates).size > 1) {
      throw new Error("Conflit d'etablissement detecte pour le paiement.");
    }

    return tenantCandidates[0];
  }

  private parseDate(value: unknown, fallback?: Date) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value === "string" || typeof value === "number") {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) return date;
    }
    if (fallback) return fallback;
    throw new Error("La date du paiement est invalide.");
  }

  private toNumber(value: unknown) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      throw new Error("Le montant du paiement est invalide.");
    }
    return Math.round(number * 100) / 100;
  }

  private normalizeText(value: unknown) {
    if (typeof value !== "string") return null;
    const normalized = value.trim().replace(/\s+/g, " ");
    return normalized || null;
  }

  private normalizeMethode(value: unknown) {
    const normalized = this.normalizeText(value)?.toLowerCase();

    switch (normalized) {
      case "cash":
      case "comptant":
      case "caisse":
        return "cash";
      case "mobile":
      case "mobile money":
      case "mobile_money":
      case "mobile-money":
        return "mobile_money";
      case "virement":
        return "virement";
      case "cheque":
      case "chèque":
        return "cheque";
      case "bank":
      case "banque":
        return "bank";
      case "famille":
      case "family":
      case "paiement_famille":
      case "family_payment":
        return "famille";
      default:
        return normalized ?? null;
    }
  }

  private requiresExternalReference(methode: string | null) {
    return ["mobile_money", "virement", "cheque", "bank"].includes(
      (methode ?? "").toLowerCase(),
    );
  }

  private canAutoGenerateReference(methode: string | null) {
    return ["cash", "famille"].includes((methode ?? "").toLowerCase());
  }

  private getReferencePrefix(methode: string | null) {
    switch ((methode ?? "").toLowerCase()) {
      case "cash":
        return "CAISSE";
      case "famille":
        return "FAM";
      default:
        return "PAIEMENT";
    }
  }

  private async buildAutomaticReference(tenantId: string, methode: string | null, payeLe: Date) {
    const prefix = this.getReferencePrefix(methode);
    const dateKey = payeLe.toISOString().slice(0, 10).replace(/-/g, "");
    const start = new Date(payeLe);
    start.setHours(0, 0, 0, 0);
    const end = new Date(payeLe);
    end.setHours(23, 59, 59, 999);

    const count = await this.prisma.paiement.count({
      where: {
        facture: {
          is: {
            etablissement_id: tenantId,
          },
        },
        methode: methode ?? undefined,
        paye_le: {
          gte: start,
          lte: end,
        },
      },
    });

    return `${prefix}-${dateKey}-${String(count + 1).padStart(4, "0")}`;
  }

  private getOperationFinanciereDelegate(tx: Prisma.TransactionClient) {
    return (tx as unknown as TransactionWithFinance).operationFinanciere;
  }

  private async getScopedFacture(factureId: string, tenantId: string) {
    return this.prisma.facture.findFirst({
      where: { id: factureId, etablissement_id: tenantId },
      include: { paiements: true },
    });
  }

  private getActivePaiements<
    T extends {
      statut?: string | null;
      montant?: unknown;
      id?: string;
    },
  >(paiements: T[], excludePaymentId?: string) {
    return paiements.filter(
      (payment) =>
        payment.id !== excludePaymentId &&
        (payment.statut ?? "ENREGISTRE").toUpperCase() === "ENREGISTRE",
    );
  }

  private sumPaiements(paiements: Array<{ montant?: unknown }>) {
    return paiements.reduce((sum, payment) => sum + Number(payment.montant ?? 0), 0);
  }

  private deriveFactureStatus(
    requestedStatus: string | undefined,
    total: number,
    paidAmount: number,
    dueDate: Date | null,
  ): StatutFacture {
    const normalizedRequested = (requestedStatus ?? "").toUpperCase();

    if (normalizedRequested === "BROUILLON") return "BROUILLON";
    if (normalizedRequested === "ANNULEE") return "ANNULEE";

    if (total <= 0) return "PAYEE";
    if (paidAmount >= total) return "PAYEE";
    if (paidAmount > 0) return "PARTIELLE";
    if (dueDate && dueDate < new Date()) return "EN_RETARD";
    return "EMISE";
  }

  private async ensureAllowedAmount(
    factureId: string,
    tenantId: string,
    amount: number,
    excludePaymentId?: string,
  ) {
    const facture = await this.getScopedFacture(factureId, tenantId);

    if (!facture) {
      throw new Error("La facture selectionnee n'appartient pas a cet etablissement.");
    }

    if (facture.statut === "ANNULEE") {
      throw new Error("Impossible d'enregistrer un paiement sur une facture annulee.");
    }

    const alreadyPaid = this.sumPaiements(this.getActivePaiements(facture.paiements, excludePaymentId));
    const total = Number(facture.total_montant ?? 0);

    if (amount <= 0) {
      throw new Error("Le montant du paiement doit etre strictement positif.");
    }

    if (alreadyPaid + amount > total + 0.009) {
      throw new Error("Le paiement depasse le solde restant de la facture.");
    }
  }

  private async normalizePayload(
    raw: Partial<PaiementRecord>,
    tenantId: string,
    current?: PaiementRecord,
  ): Promise<PaiementPayload> {
    const facture_id =
      typeof raw.facture_id === "string" && raw.facture_id.trim()
        ? raw.facture_id.trim()
        : current?.facture_id ?? "";

    if (!facture_id) {
      throw new Error("La facture est requise.");
    }

    const requestedStatus =
      typeof raw.statut === "string" && raw.statut.trim()
        ? raw.statut.trim().toUpperCase()
        : current?.statut?.toUpperCase() ?? "ENREGISTRE";

    if (requestedStatus !== "ENREGISTRE") {
      throw new Error(
        "Le CRUD paiement n'autorise que le statut ENREGISTRE. Utilise les operations dediees pour annuler ou rembourser.",
      );
    }

    const echeance_ids = Array.isArray((raw as Record<string, unknown>).echeance_ids)
      ? Array.from(
          new Set(
            ((raw as Record<string, unknown>).echeance_ids as unknown[])
              .map((value) => (typeof value === "string" ? value.trim() : ""))
              .filter(Boolean),
          ),
        )
      : [];

    const paye_le = this.parseDate(raw.paye_le ?? current?.paye_le ?? new Date());
    const methode = this.normalizeMethode(raw.methode ?? current?.methode);
    let reference = this.normalizeText(raw.reference ?? current?.reference);

    if (this.requiresExternalReference(methode) && !reference) {
      throw new Error(
        "Une reference est obligatoire pour les paiements Mobile Money, virement, cheque ou banque.",
      );
    }

    if (!reference && this.canAutoGenerateReference(methode)) {
      reference = await this.buildAutomaticReference(tenantId, methode, paye_le);
    }

    return {
      facture_id,
      paye_le,
      montant: this.toNumber(raw.montant ?? current?.montant ?? 0),
      statut: requestedStatus,
      methode,
      reference,
      recu_par: this.normalizeText(raw.recu_par ?? current?.recu_par),
      echeance_ids,
    };
  }

  private async validateSelectedEcheances(
    tenantId: string,
    factureId: string,
    echeanceIds: string[],
    amount: number,
  ) {
    if (echeanceIds.length === 0) return;

    const echeances = await this.prisma.echeancePaiement.findMany({
      where: {
        id: { in: echeanceIds },
        facture_id: factureId,
        facture: {
          is: {
            etablissement_id: tenantId,
          },
        },
        statut: { notIn: ["PAYEE", "ANNULEE"] },
      },
      select: {
        id: true,
        montant_restant: true,
      },
    });

    if (echeances.length !== echeanceIds.length) {
      throw new Error("Une ou plusieurs echeances selectionnees ne sont pas valides pour cette facture.");
    }

    const allowedAmount = echeances.reduce(
      (sum, echeance) => sum + this.toNumber(echeance.montant_restant),
      0,
    );

    if (amount > allowedAmount + 0.009) {
      throw new Error("Le montant saisi depasse le total restant des echeances selectionnees.");
    }
  }

  private normalizeOperationPayload(raw: Record<string, unknown>): PaiementOperationPayload {
    return {
      motif: this.normalizeText(raw.motif),
    };
  }

  private buildScopedWhere(existingWhere: Record<string, unknown>, tenantId: string) {
    const scope = { facture: { is: { etablissement_id: tenantId } } };
    if (!existingWhere || Object.keys(existingWhere).length === 0) {
      return scope;
    }

    return {
      AND: [existingWhere, scope],
    };
  }

  private getInclude() {
    return {
          facture: {
            include: {
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
          echeances: {
            include: {
              affectations: true,
            },
            orderBy: [{ ordre: "asc" as const }, { date_echeance: "asc" as const }],
          },
          operationsFinancieres: {
            orderBy: [{ created_at: "desc" as const }],
          },
        },
      },
      affectations: {
        include: {
          echeance: true,
        },
      },
      operationsFinancieres: {
        orderBy: [{ created_at: "desc" as const }],
      },
    };
  }

  private async getScopedPaiement(id: string, tenantId: string) {
    return this.prisma.paiement.findFirst({
      where: {
        id,
        facture: { is: { etablissement_id: tenantId } },
      },
      include: this.getInclude(),
    });
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const data = await this.normalizePayload(req.body, tenantId);

      await this.ensureAllowedAmount(data.facture_id, tenantId, data.montant);
      await this.validateSelectedEcheances(
        tenantId,
        data.facture_id,
        data.echeance_ids,
        data.montant,
      );

      const result = await this.prisma.$transaction(async (tx) => {
        const paiement = await tx.paiement.create({
          data: {
            facture_id: data.facture_id,
            paye_le: data.paye_le,
            montant: data.montant,
            statut: data.statut,
            methode: data.methode,
            reference: data.reference,
            recu_par: data.recu_par,
          },
        });

        const facture = await tx.facture.findUnique({
          where: { id: data.facture_id },
          include: { paiements: true },
        });

        if (facture) {
          const paidAmount = this.sumPaiements(this.getActivePaiements(facture.paiements));
          await tx.facture.update({
            where: { id: data.facture_id },
            data: {
              statut: this.deriveFactureStatus(
                facture.statut,
                Number(facture.total_montant ?? 0),
                paidAmount,
                facture.date_echeance,
              ),
            },
          });
        }

        await allocatePaiementsToFactureEcheances(tx, data.facture_id, {
          [paiement.id]: data.echeance_ids,
        });

        return tx.paiement.findUnique({
          where: { id: paiement.id },
          include: this.getInclude(),
        });
      });

      Response.success(res, "Paiement cree avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la creation du paiement", 400, error as Error);
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
        orderBy: req.query.orderBy ?? JSON.stringify([{ paye_le: "desc" }, { created_at: "desc" }]),
      };
      const result = await getAllPaginated(scopedQuery as typeof req.query, this.paiement);
      Response.success(res, "Liste des paiements recuperee.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des paiements", 400, error as Error);
      next(error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const includeSpec = parseJSON<Record<string, unknown>>(req.query.includeSpec, this.getInclude());
      const result = await this.prisma.paiement.findFirst({
        where: {
          id: req.params.id,
          facture: { is: { etablissement_id: tenantId } },
        },
        include: includeSpec,
      });

      if (!result) {
        throw new Error("Paiement introuvable pour cet etablissement.");
      }

      Response.success(res, "Detail du paiement.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation du paiement", 404, error as Error);
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedPaiement(req.params.id, tenantId);

      if (!existing) {
        throw new Error("Paiement introuvable pour cet etablissement.");
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const operation = await this.getOperationFinanciereDelegate(tx).create({
          data: {
            etablissement_id: tenantId,
            facture_id: existing.facture_id,
            paiement_id: existing.id,
            cree_par_utilisateur_id: (req as Request & { user?: { sub?: string } }).user?.sub ?? null,
            type: "SUPPRESSION_PAIEMENT",
            montant: existing.montant,
            motif: "Suppression manuelle du paiement.",
            details_json: {
              reference: existing.reference,
              methode: existing.methode,
              paye_le: existing.paye_le,
            },
          },
        });

        await tx.paiement.delete({
          where: { id: req.params.id },
        });

        const facture = await tx.facture.findUnique({
          where: { id: existing.facture_id },
          include: { paiements: true },
        });

        if (facture) {
          const paidAmount = this.sumPaiements(this.getActivePaiements(facture.paiements));
          await tx.facture.update({
            where: { id: existing.facture_id },
            data: {
              statut: this.deriveFactureStatus(
                facture.statut,
                Number(facture.total_montant ?? 0),
                paidAmount,
                facture.date_echeance,
              ),
            },
          });
        }

        await allocatePaiementsToFactureEcheances(tx, existing.facture_id);

        return operation;
      });

      Response.success(res, "Paiement supprime avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la suppression du paiement", 400, error as Error);
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = (await this.getScopedPaiement(req.params.id, tenantId)) as (PaiementRecord & {
        facture_id: string;
        reference?: string | null;
        methode?: string | null;
      }) | null;

      if (!existing) {
        throw new Error("Paiement introuvable pour cet etablissement.");
      }

      if ((existing.statut ?? "ENREGISTRE").toUpperCase() !== "ENREGISTRE") {
        throw new Error(
          "Ce paiement a deja fait l'objet d'une operation comptable et ne peut plus etre modifie.",
        );
      }

      const data = await this.normalizePayload(req.body, tenantId, existing);
      await this.ensureAllowedAmount(data.facture_id, tenantId, data.montant, req.params.id);
      await this.validateSelectedEcheances(
        tenantId,
        data.facture_id,
        data.echeance_ids,
        data.montant,
      );

      const result = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.paiement.update({
          where: { id: req.params.id },
          data,
        });

        const factureIds = Array.from(new Set([existing.facture_id, data.facture_id]));

        for (const factureId of factureIds) {
          const facture = await tx.facture.findUnique({
            where: { id: factureId },
            include: { paiements: true },
          });

          if (!facture) continue;

          const paidAmount = this.sumPaiements(this.getActivePaiements(facture.paiements));

          await tx.facture.update({
            where: { id: factureId },
            data: {
              statut: this.deriveFactureStatus(
                facture.statut,
                Number(facture.total_montant ?? 0),
                paidAmount,
                facture.date_echeance,
              ),
            },
          });

          await allocatePaiementsToFactureEcheances(
            tx,
            factureId,
            factureId === data.facture_id
              ? { [updated.id]: data.echeance_ids }
              : undefined,
          );
        }

        return tx.paiement.findUnique({
          where: { id: updated.id },
          include: this.getInclude(),
        });
      });

      Response.success(res, "Paiement mis a jour avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la mise a jour du paiement", 400, error as Error);
      next(error);
    }
  }

  private async handleStatusOperation(
    req: Request,
    res: R,
    next: NextFunction,
    targetStatus: "ANNULE" | "REMBOURSE",
    operationType: "ANNULATION_PAIEMENT" | "REMBOURSEMENT_PAIEMENT",
    successMessage: string,
  ) {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = (await this.getScopedPaiement(req.params.id, tenantId)) as (PaiementRecord & {
        facture_id: string;
        reference?: string | null;
        methode?: string | null;
        statut?: string | null;
      }) | null;

      if (!existing) {
        throw new Error("Paiement introuvable pour cet etablissement.");
      }

      if ((existing.statut ?? "ENREGISTRE").toUpperCase() !== "ENREGISTRE") {
        throw new Error("Ce paiement a deja fait l'objet d'une operation comptable.");
      }

      const payload = this.normalizeOperationPayload(req.body as Record<string, unknown>);

      const result = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.paiement.update({
          where: { id: existing.id },
          data: {
            statut: targetStatus,
          } as never,
        });

        await this.getOperationFinanciereDelegate(tx).create({
          data: {
            etablissement_id: tenantId,
            facture_id: existing.facture_id,
            paiement_id: existing.id,
            cree_par_utilisateur_id: (req as Request & { user?: { sub?: string } }).user?.sub ?? null,
            type: operationType,
            montant: existing.montant,
            motif: payload.motif,
            details_json: {
              reference: existing.reference,
              methode: existing.methode,
              paye_le: existing.paye_le,
            },
          },
        });

        const facture = await tx.facture.findUnique({
          where: { id: existing.facture_id },
          include: { paiements: true },
        });

        if (facture) {
          const paidAmount = this.sumPaiements(this.getActivePaiements(facture.paiements));
          await tx.facture.update({
            where: { id: existing.facture_id },
            data: {
              statut: this.deriveFactureStatus(
                facture.statut,
                Number(facture.total_montant ?? 0),
                paidAmount,
                facture.date_echeance,
              ),
            },
          });
        }

        await allocatePaiementsToFactureEcheances(tx, existing.facture_id);

        return tx.paiement.findUnique({
          where: { id: updated.id },
          include: this.getInclude(),
        });
      });

      Response.success(res, successMessage, result);
    } catch (error) {
      Response.error(res, "Erreur lors de l'operation comptable sur le paiement", 400, error as Error);
      next(error);
    }
  }

  private async cancel(req: Request, res: R, next: NextFunction): Promise<void> {
    await this.handleStatusOperation(
      req,
      res,
      next,
      "ANNULE",
      "ANNULATION_PAIEMENT",
      "Paiement annule avec succes.",
    );
  }

  private async refund(req: Request, res: R, next: NextFunction): Promise<void> {
    await this.handleStatusOperation(
      req,
      res,
      next,
      "REMBOURSE",
      "REMBOURSEMENT_PAIEMENT",
      "Paiement rembourse avec succes.",
    );
  }
}

export default PaiementApp;
