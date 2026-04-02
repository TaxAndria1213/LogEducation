import { Application, NextFunction, Request, Response as R, Router } from "express";
import { Prisma, PrismaClient, type AbonnementCantine } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import AbonnementCantineModel from "../models/abonnement_cantine.model";
import {
  createServiceSubscriptionFacture,
  regularizeServiceSubscriptionFacture,
} from "../../finance_shared/utils/service_subscription_finance";

type AbonnementCantinePayload = {
  eleve_id: string;
  annee_scolaire_id: string;
  formule_cantine_id: string;
  statut: string;
  date_effet: Date | null;
};

type CantineRechargePayload = {
  montant: number;
  methode: string;
  reference: string | null;
  note: string | null;
  rechargement_le: Date;
};

type CantineConsumptionPayload = {
  montant: number;
  type_repas: string;
  note: string | null;
  consommation_le: Date;
};

type AbonnementCantineScopedRecord = Awaited<ReturnType<AbonnementCantineApp["getScopedRecord"]>>;

class AbonnementCantineApp {
  public app: Application;
  public router: Router;
  private abonnementCantine: AbonnementCantineModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.abonnementCantine = new AbonnementCantineModel();
    this.prisma = new PrismaClient();
    this.routes();
  }

  public routes(): Router {
    this.router.post("/", this.create.bind(this));
    this.router.get("/", this.getAll.bind(this));
    this.router.get("/pending-finance-billing", this.getPendingFinanceBilling.bind(this));
    this.router.get("/:id", this.getOne.bind(this));
    this.router.get("/:id/wallet", this.getWallet.bind(this));
    this.router.post("/:id/process-finance-billing", this.processFinanceBilling.bind(this));
    this.router.post("/:id/recharge", this.recharge.bind(this));
    this.router.post("/:id/consume", this.consume.bind(this));
    this.router.delete("/:id", this.delete.bind(this));
    this.router.put("/:id", this.update.bind(this));
    return this.router;
  }

  private async resolveTenantIdForWrite(req: Request): Promise<string> {
    try {
      return this.resolveTenantId(req);
    } catch (error) {
      const eleveId =
        typeof req.body?.eleve_id === "string" ? req.body.eleve_id.trim() : "";
      const formuleId =
        typeof req.body?.formule_cantine_id === "string"
          ? req.body.formule_cantine_id.trim()
          : "";

      if (eleveId) {
        const eleve = await this.prisma.eleve.findUnique({
          where: { id: eleveId },
          select: { etablissement_id: true },
        });
        if (eleve?.etablissement_id) return eleve.etablissement_id;
      }

      if (formuleId) {
        const formule = await this.prisma.formuleCantine.findUnique({
          where: { id: formuleId },
          select: { etablissement_id: true },
        });
        if (formule?.etablissement_id) return formule.etablissement_id;
      }

      throw error;
    }
  }

  private resolveTenantId(req: Request): string {
    const requestTenant = (req as Request & { tenantId?: string }).tenantId;
    const bodyTenant =
      typeof req.body?.etablissement_id === "string" ? req.body.etablissement_id.trim() : undefined;
    const queryWhere = parseJSON<Record<string, unknown>>(req.query.where, {});
    const queryTenant =
      typeof (queryWhere?.eleve as { is?: { etablissement_id?: unknown } } | undefined)?.is
        ?.etablissement_id === "string"
        ? ((queryWhere.eleve as { is?: { etablissement_id?: string } }).is?.etablissement_id ?? "").trim()
        : undefined;

    const candidates = [requestTenant, bodyTenant, queryTenant].filter(
      (value): value is string => Boolean(value),
    );
    if (candidates.length === 0) throw new Error("Aucun etablissement actif n'a ete fourni.");
    if (new Set(candidates).size > 1) throw new Error("Conflit d'etablissement detecte pour l'abonnement cantine.");
    return candidates[0];
  }

  private normalizePayload(raw: Record<string, unknown>): AbonnementCantinePayload {
    const eleve_id = typeof raw.eleve_id === "string" ? raw.eleve_id.trim() : "";
    const annee_scolaire_id =
      typeof raw.annee_scolaire_id === "string" ? raw.annee_scolaire_id.trim() : "";
    const formule_cantine_id =
      typeof raw.formule_cantine_id === "string" ? raw.formule_cantine_id.trim() : "";
    const requestedStatus =
      typeof raw.statut === "string" && raw.statut.trim()
        ? raw.statut.trim().toUpperCase()
        : "EN_ATTENTE_VALIDATION_FINANCIERE";
    const statut = [
      "EN_ATTENTE_VALIDATION_FINANCIERE",
      "EN_ATTENTE_REGLEMENT",
      "ACTIF",
      "SUSPENDU",
      "INACTIF",
      "ANNULE",
      "RESILIE",
    ].includes(requestedStatus)
      ? requestedStatus
      : "EN_ATTENTE_VALIDATION_FINANCIERE";
    const rawDateEffet =
      raw.date_effet instanceof Date
        ? raw.date_effet
        : typeof raw.date_effet === "string" && raw.date_effet.trim()
          ? new Date(raw.date_effet)
          : null;

    if (!eleve_id || !annee_scolaire_id || !formule_cantine_id) {
      throw new Error("L'eleve, l'annee scolaire et la formule de cantine sont requis.");
    }

    if (rawDateEffet && Number.isNaN(rawDateEffet.getTime())) {
      throw new Error("La date d'effet du service cantine est invalide.");
    }

    return { eleve_id, annee_scolaire_id, formule_cantine_id, statut, date_effet: rawDateEffet ?? new Date() };
  }

  private normalizeRechargePayload(raw: Record<string, unknown>): CantineRechargePayload {
    const montant = Number(raw.montant ?? 0);
    if (!Number.isFinite(montant) || montant <= 0) {
      throw new Error("Le montant du rechargement cantine doit etre strictement positif.");
    }

    const methodeRaw =
      typeof raw.methode === "string" && raw.methode.trim()
        ? raw.methode.trim().toLowerCase()
        : "cash";
    const methode = ["cash", "mobile_money", "virement", "cheque", "bank", "card", "famille"].includes(
      methodeRaw,
    )
      ? methodeRaw
      : "cash";
    const reference =
      typeof raw.reference === "string" && raw.reference.trim() ? raw.reference.trim() : null;
    const note = typeof raw.note === "string" && raw.note.trim() ? raw.note.trim() : null;
    const dateRaw =
      typeof raw.rechargement_le === "string" && raw.rechargement_le.trim()
        ? raw.rechargement_le.trim()
        : null;
    const rechargement_le = dateRaw ? new Date(dateRaw) : new Date();

    if (Number.isNaN(rechargement_le.getTime())) {
      throw new Error("La date du rechargement cantine est invalide.");
    }

    return {
      montant: Number(montant.toFixed(2)),
      methode,
      reference,
      note,
      rechargement_le,
    };
  }

  private normalizeConsumptionPayload(raw: Record<string, unknown>): CantineConsumptionPayload {
    const montant = Number(raw.montant ?? 0);
    if (!Number.isFinite(montant) || montant <= 0) {
      throw new Error("Le montant du repas consomme doit etre strictement positif.");
    }

    const typeRepasRaw =
      typeof raw.type_repas === "string" && raw.type_repas.trim()
        ? raw.type_repas.trim().toLowerCase()
        : "repas";
    const type_repas = [
      "petit_dejeuner",
      "dejeuner",
      "gouter",
      "diner",
      "repas",
    ].includes(typeRepasRaw)
      ? typeRepasRaw
      : "repas";
    const note = typeof raw.note === "string" && raw.note.trim() ? raw.note.trim() : null;
    const dateRaw =
      typeof raw.consommation_le === "string" && raw.consommation_le.trim()
        ? raw.consommation_le.trim()
        : null;
    const consommation_le = dateRaw ? new Date(dateRaw) : new Date();

    if (Number.isNaN(consommation_le.getTime())) {
      throw new Error("La date de consommation cantine est invalide.");
    }

    return {
      montant: Number(montant.toFixed(2)),
      type_repas,
      note,
      consommation_le,
    };
  }

  private buildScopedWhere(existingWhere: Record<string, unknown>, tenantId: string) {
    const scope = { eleve: { is: { etablissement_id: tenantId } } };
    if (!existingWhere || Object.keys(existingWhere).length === 0) return scope;
    return { AND: [existingWhere, scope] };
  }

  private async ensureScopedRelations(data: AbonnementCantinePayload, tenantId: string, excludeId?: string) {
    const [eleve, annee, formule] = await Promise.all([
      this.prisma.eleve.findFirst({
        where: { id: data.eleve_id, etablissement_id: tenantId },
        select: { id: true },
      }),
      this.prisma.anneeScolaire.findFirst({
        where: { id: data.annee_scolaire_id, etablissement_id: tenantId },
        select: { id: true },
      }),
      this.prisma.formuleCantine.findFirst({
        where: { id: data.formule_cantine_id, etablissement_id: tenantId },
        select: { id: true },
      }),
    ]);

    if (!eleve) throw new Error("L'eleve selectionne n'appartient pas a cet etablissement.");
    if (!annee) throw new Error("L'annee scolaire selectionnee n'appartient pas a cet etablissement.");
    if (!formule) throw new Error("La formule de cantine selectionnee n'appartient pas a cet etablissement.");

    const duplicate = await this.prisma.abonnementCantine.findFirst({
      where: {
        eleve_id: data.eleve_id,
        annee_scolaire_id: data.annee_scolaire_id,
        OR: [
          { statut: null },
          { statut: { notIn: ["RESILIE", "ANNULE", "INACTIF"] } },
        ],
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new Error("Un abonnement cantine existe deja pour cet eleve sur cette annee scolaire.");
    }
  }

  private async attachFinanceMetadata<T extends { id: string }>(records: T[]) {
    if (records.length === 0) return records.map((item) => ({ ...item, facture_id: null, facture: null }));
    const ids = records.map((item) => item.id);
    const rows = await this.prisma.$queryRaw<Array<{ id: string; facture_id: string | null; date_effet: Date | null }>>(
      Prisma.sql`SELECT id, facture_id, date_effet FROM abonnements_cantine WHERE id IN (${Prisma.join(ids)})`,
    );
    const recordById = new Map(rows.map((item) => [item.id, item]));
    const factureIds = rows
      .map((item) => item.facture_id)
      .filter((value): value is string => Boolean(value));
    const factures = factureIds.length
      ? await this.prisma.facture.findMany({
          where: { id: { in: factureIds } },
          select: { id: true, numero_facture: true, statut: true },
        })
      : [];
    const facturesById = new Map(factures.map((item) => [item.id, item]));
    return records.map((item) => {
      const row = recordById.get(item.id);
      const facture_id = row?.facture_id ?? null;
      const facture = facture_id ? facturesById.get(facture_id) ?? null : null;
      const statut = String((item as Record<string, unknown>).statut ?? "").toUpperCase();
      const factureStatus = String(facture?.statut ?? "").toUpperCase();
      const finance_status =
        factureStatus === "PAYEE"
          ? "REGLE"
          : statut === "EN_ATTENTE_VALIDATION_FINANCIERE"
            ? "EN_ATTENTE_VALIDATION_FINANCIERE"
            : statut === "EN_ATTENTE_REGLEMENT"
              ? "EN_ATTENTE_REGLEMENT"
              : facture_id
                ? "EN_ATTENTE_REGLEMENT"
                : statut === "ACTIF"
                  ? "ACTIF"
                  : statut || null;
      const access_status =
        statut === "SUSPENDU"
          ? "SUSPENDU"
          : ["ANNULE", "RESILIE", "INACTIF"].includes(statut)
            ? "EXPIRE"
            : statut === "ACTIF" && ["REGLE", "ACTIF"].includes(finance_status ?? "")
              ? "AUTORISE"
              : "EN_ATTENTE";
      return {
        ...item,
        facture_id,
        date_effet: row?.date_effet ?? ((item as Record<string, unknown>).date_effet as Date | null | undefined) ?? null,
        facture,
        finance_status,
        access_status,
      };
    });
  }

  private async getScopedRecord(id: string, tenantId: string) {
    const record = await this.prisma.abonnementCantine.findFirst({
      where: { id, eleve: { is: { etablissement_id: tenantId } } },
      include: {
        eleve: { include: { utilisateur: { include: { profil: true } } } },
        annee: true,
        formule: true,
        operationsFinancieres: {
          where: {
            type: {
              in: [
                "RECHARGEMENT_CANTINE",
                "ANNULATION_RECHARGEMENT_CANTINE",
                "CONSOMMATION_CANTINE",
                "AJUSTEMENT_SOLDE_CANTINE",
                "SUSPENSION_CANTINE",
                "REACTIVATION_CANTINE",
              ],
            },
          },
          orderBy: { created_at: "desc" },
          take: 20,
        },
      },
    });
    if (!record) return null;
    const [enriched] = await this.attachFinanceMetadata([record]);
    return enriched;
  }

  private ensureMutable(existing: NonNullable<AbonnementCantineScopedRecord>) {
    if (existing?.facture && (existing.facture.statut ?? "").toUpperCase() !== "ANNULEE") {
      throw new Error(
        `Cet abonnement cantine est deja facture par ${existing.facture.numero_facture}. Regularisez d'abord la facture liee.`,
      );
    }
  }

  private async updateOperationalStatus(
    id: string,
    statut: "ACTIF" | "SUSPENDU" | "INACTIF",
  ) {
    return this.prisma.abonnementCantine.update({
      where: { id },
      data: { statut },
    });
  }

  private async terminateSubscription(
    tenantId: string,
    existing: NonNullable<AbonnementCantineScopedRecord>,
    actorId: string | null,
  ) {
    if ((existing.statut ?? "").toUpperCase() === "RESILIE") {
      return existing;
    }

    if (!existing.facture_id) {
      return this.abonnementCantine.delete(existing.id);
    }

    return this.prisma.$transaction(async (tx) => {
      await regularizeServiceSubscriptionFacture(tx, {
        tenantId,
        factureId: existing.facture_id as string,
        eleveId: existing.eleve_id,
        anneeScolaireId: existing.annee_scolaire_id,
        catalogueFraisId: existing.formule?.catalogue_frais_id ?? null,
        libellePrefix: "Cantine -",
        serviceLabel: existing.formule?.nom
          ? `cantine ${existing.formule.nom}`
          : "cantine",
        createdByUtilisateurId: actorId,
        motif: "Resiliation abonnement cantine",
      });

      return tx.abonnementCantine.update({
        where: { id: existing.id },
        data: {
          statut: "RESILIE",
        },
      });
    });
  }

  private buildWalletResponse(existing: NonNullable<AbonnementCantineScopedRecord>) {
    const history = (existing.operationsFinancieres ?? []).map((item) => ({
      id: item.id,
      type: item.type,
      montant: item.montant,
      motif: item.motif,
      details_json: item.details_json,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));

    return {
      abonnement: existing,
      wallet: {
        solde_prepaye: existing.solde_prepaye,
        solde_min_alerte: existing.solde_min_alerte,
        dernier_rechargement_le: existing.dernier_rechargement_le,
        history,
      },
    };
  }

  private shouldAutoSuspend(soldeApres: number, soldeMinAlerte: number) {
    return soldeApres <= Math.max(0, soldeMinAlerte);
  }

  private shouldAutoReactivate(currentStatus: string | null | undefined, soldeApres: number, soldeMinAlerte: number) {
    return (currentStatus ?? "ACTIF").toUpperCase() === "SUSPENDU" && soldeApres > Math.max(0, soldeMinAlerte);
  }

  private async create(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = await this.resolveTenantIdForWrite(req);
      const data = this.normalizePayload(req.body);
      await this.ensureScopedRelations(data, tenantId);
      const created = await this.prisma.abonnementCantine.create({
        data: {
          eleve_id: data.eleve_id,
          annee_scolaire_id: data.annee_scolaire_id,
          formule_cantine_id: data.formule_cantine_id,
          statut: "EN_ATTENTE_VALIDATION_FINANCIERE",
        },
      });
      await this.prisma.$executeRaw(
        Prisma.sql`UPDATE abonnements_cantine SET date_effet = ${data.date_effet} WHERE id = ${created.id}`,
      );
      const result = await this.getScopedRecord(created.id, tenantId);
      Response.success(res, "Abonnement cantine cree.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la creation de l'abonnement cantine", 400, error as Error);
      next(error);
    }
  }

  private async getPendingFinanceBilling(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const records = await this.prisma.abonnementCantine.findMany({
        where: {
          eleve: { is: { etablissement_id: tenantId } },
          statut: { in: ["EN_ATTENTE_VALIDATION_FINANCIERE", "EN_ATTENTE_REGLEMENT"] },
        },
        include: {
          eleve: { include: { utilisateur: { include: { profil: true } } } },
          annee: true,
          formule: true,
          facture: true,
        },
        orderBy: { created_at: "desc" },
      });
      const data = await this.attachFinanceMetadata(records);
      Response.success(res, "Abonnements cantine en attente de prise en charge Finance.", data);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des abonnements cantine a facturer", 400, error as Error);
      next(error);
    }
  }

  private async processFinanceBilling(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedRecord(req.params.id, tenantId);
      if (!existing) throw new Error("Abonnement cantine introuvable.");
      if (existing.facture && (existing.facture.statut ?? "").toUpperCase() !== "ANNULEE") {
        throw new Error(
          `Cet abonnement cantine est deja facture par ${existing.facture.numero_facture}.`,
        );
      }

      const formule = await this.prisma.formuleCantine.findFirst({
        where: { id: existing.formule_cantine_id, etablissement_id: tenantId },
        select: { nom: true, catalogue_frais_id: true },
      });
      if (!formule?.catalogue_frais_id) {
        throw new Error("La formule de cantine selectionnee n'est reliee a aucun frais catalogue.");
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const { facture } = await createServiceSubscriptionFacture(tx, {
          tenantId,
          eleveId: existing.eleve_id,
          anneeScolaireId: existing.annee_scolaire_id,
          catalogueFraisId: formule.catalogue_frais_id as string,
          allowedScopes: ["GENERAL", "CANTINE"],
          libelle: `Cantine - ${formule.nom ?? "service"}`,
          modePaiement: "COMPTANT",
          nombreTranches: 1,
          jourPaiementMensuel: null,
          createdByUtilisateurId: (req as Request & { user?: { sub?: string } }).user?.sub ?? null,
          dateEcheance: ((existing as Record<string, unknown>).date_effet as Date | null | undefined) ?? null,
        });

        return tx.abonnementCantine.update({
          where: { id: existing.id },
          data: {
            facture_id: facture.id,
            statut: (facture.statut ?? "").toUpperCase() === "PAYEE" ? "ACTIF" : "EN_ATTENTE_REGLEMENT",
          },
          include: {
            eleve: { include: { utilisateur: { include: { profil: true } } } },
            annee: true,
            formule: true,
            facture: true,
          },
        });
      });

      Response.success(res, "Facturation cantine generee par Finance.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la generation de la facturation cantine", 400, error as Error);
      next(error);
    }
  }

  private async getAll(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const where = parseJSON<Record<string, unknown>>(req.query.where, {});
      const scopedQuery = {
        ...req.query,
        where: JSON.stringify(this.buildScopedWhere(where, tenantId)),
        orderBy: req.query.orderBy ?? JSON.stringify([{ created_at: "desc" }]),
      };
      const result = await getAllPaginated(scopedQuery as typeof req.query, this.abonnementCantine);
      const data = await this.attachFinanceMetadata((result?.data ?? []) as Array<{ id: string }>);
      Response.success(res, "Abonnements cantine.", { ...result, data });
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des abonnements cantine", 400, error as Error);
      next(error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const includeSpec = parseJSON<Record<string, unknown>>(req.query.includeSpec, {});
      const result =
        Object.keys(includeSpec).length > 0
          ? await this.prisma.abonnementCantine.findFirst({
              where: { id: req.params.id, eleve: { is: { etablissement_id: tenantId } } },
              include: includeSpec as never,
            })
          : await this.getScopedRecord(req.params.id, tenantId);
      if (!result) throw new Error("Abonnement cantine introuvable.");
      Response.success(res, "Abonnement cantine.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation de l'abonnement cantine", 404, error as Error);
      next(error);
    }
  }

  private async getWallet(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedRecord(req.params.id, tenantId);
      if (!existing) throw new Error("Compte cantine introuvable.");
      Response.success(res, "Compte cantine.", this.buildWalletResponse(existing));
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation du compte cantine", 404, error as Error);
      next(error);
    }
  }

  private async recharge(req: Request, res: R, next: NextFunction) {
    try {
      throw new Error("Le rechargement cantine doit etre enregistre depuis le module Finance.");
    } catch (error) {
      Response.error(res, "Erreur lors du rechargement du compte cantine", 400, error as Error);
      next(error);
    }
  }

  private async consume(req: Request, res: R, next: NextFunction) {
    try {
      throw new Error("La consommation monetaire cantine n'est plus saisie ici. Utilise un statut financier transmis par Finance.");
    } catch (error) {
      Response.error(res, "Erreur lors de l'enregistrement de la consommation cantine", 400, error as Error);
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = await this.resolveTenantIdForWrite(req);
      const existing = await this.getScopedRecord(req.params.id, tenantId);
      if (!existing) throw new Error("Abonnement cantine introuvable.");
      const requestedStatus =
        typeof req.body?.statut === "string" ? req.body.statut.trim().toUpperCase() : null;
      if (existing.facture && (existing.facture.statut ?? "").toUpperCase() !== "ANNULEE") {
        if (requestedStatus === "RESILIE") {
          const result = await this.terminateSubscription(
            tenantId,
            existing,
            (req as Request & { user?: { sub?: string } }).user?.sub ?? null,
          );
          return Response.success(res, "Abonnement cantine resilie.", result);
        }
        if (requestedStatus === "SUSPENDU" || requestedStatus === "ACTIF" || requestedStatus === "INACTIF") {
          const result = await this.updateOperationalStatus(req.params.id, requestedStatus);
          return Response.success(res, "Statut operationnel de la cantine mis a jour.", result);
        }
        this.ensureMutable(existing);
      }
      const data = this.normalizePayload({ ...existing, ...req.body });
      await this.ensureScopedRelations(data, tenantId, req.params.id);
      const result = await this.abonnementCantine.update(req.params.id, data);
      Response.success(res, "Abonnement cantine mis a jour.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la mise a jour de l'abonnement cantine", 400, error as Error);
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedRecord(req.params.id, tenantId);
      if (!existing) throw new Error("Abonnement cantine introuvable.");
      const result = await this.terminateSubscription(
        tenantId,
        existing,
        (req as Request & { user?: { sub?: string } }).user?.sub ?? null,
      );
      Response.success(
        res,
        existing.facture_id ? "Abonnement cantine resilie et regularise." : "Abonnement cantine supprime.",
        result,
      );
    } catch (error) {
      Response.error(res, "Erreur lors de la suppression de l'abonnement cantine", 400, error as Error);
      next(error);
    }
  }
}

export default AbonnementCantineApp;
