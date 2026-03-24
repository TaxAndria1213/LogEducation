import { Application, NextFunction, Request, Response as R, Router } from "express";
import { PrismaClient, type Paiement, type StatutFacture } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import { allocatePaiementsToFactureEcheances } from "../../finance_shared/utils/echeance_paiement";
import PaiementModel from "../models/paiement.model";

type PaiementPayload = {
  facture_id: string;
  paye_le: Date;
  montant: number;
  methode: string | null;
  reference: string | null;
  recu_par: string | null;
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

  private async getScopedFacture(factureId: string, tenantId: string) {
    return this.prisma.facture.findFirst({
      where: { id: factureId, etablissement_id: tenantId },
      include: { paiements: true },
    });
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

    const alreadyPaid = facture.paiements
      .filter((payment) => payment.id !== excludePaymentId)
      .reduce((sum, payment) => sum + Number(payment.montant ?? 0), 0);
    const total = Number(facture.total_montant ?? 0);

    if (amount <= 0) {
      throw new Error("Le montant du paiement doit etre strictement positif.");
    }

    if (alreadyPaid + amount > total + 0.009) {
      throw new Error("Le paiement depasse le solde restant de la facture.");
    }
  }

  private normalizePayload(raw: Partial<Paiement>, current?: Paiement): PaiementPayload {
    const facture_id =
      typeof raw.facture_id === "string" && raw.facture_id.trim()
        ? raw.facture_id.trim()
        : current?.facture_id ?? "";

    if (!facture_id) {
      throw new Error("La facture est requise.");
    }

    return {
      facture_id,
      paye_le: this.parseDate(raw.paye_le ?? current?.paye_le ?? new Date()),
      montant: this.toNumber(raw.montant ?? current?.montant ?? 0),
      methode: this.normalizeText(raw.methode ?? current?.methode),
      reference: this.normalizeText(raw.reference ?? current?.reference),
      recu_par: this.normalizeText(raw.recu_par ?? current?.recu_par),
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
        },
      },
      affectations: {
        include: {
          echeance: true,
        },
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
      const data = this.normalizePayload(req.body);

      await this.ensureAllowedAmount(data.facture_id, tenantId, data.montant);

      const result = await this.prisma.$transaction(async (tx) => {
        const paiement = await tx.paiement.create({ data });

        const facture = await tx.facture.findUnique({
          where: { id: data.facture_id },
          include: { paiements: true },
        });

        if (facture) {
          const paidAmount = facture.paiements.reduce(
            (sum, payment) => sum + Number(payment.montant ?? 0),
            0,
          );
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

        await allocatePaiementsToFactureEcheances(tx, data.facture_id);

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
        const deleted = await tx.paiement.delete({
          where: { id: req.params.id },
        });

        const facture = await tx.facture.findUnique({
          where: { id: existing.facture_id },
          include: { paiements: true },
        });

        if (facture) {
          const paidAmount = facture.paiements.reduce(
            (sum, payment) => sum + Number(payment.montant ?? 0),
            0,
          );
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

        return deleted;
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
      const existing = await this.getScopedPaiement(req.params.id, tenantId);

      if (!existing) {
        throw new Error("Paiement introuvable pour cet etablissement.");
      }

      const data = this.normalizePayload(req.body, existing as Paiement);
      await this.ensureAllowedAmount(data.facture_id, tenantId, data.montant, req.params.id);

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

          const paidAmount = facture.paiements.reduce(
            (sum, payment) => sum + Number(payment.montant ?? 0),
            0,
          );

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

          await allocatePaiementsToFactureEcheances(tx, factureId);
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
}

export default PaiementApp;
