import { Application, NextFunction, Request, Response as R, Router } from "express";
import { PrismaClient, Prisma, type Paiement, type StatutFacture } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import {
  allocatePaiementsToFactureEcheances,
  deriveEcheanceStatus,
  ensurePlanForFacture,
  roundMoney,
  syncFactureStatusFromEcheances,
  syncPlanJsonFromEcheances,
  toMoney,
} from "../../finance_shared/utils/echeance_paiement";
import { archiveLinkedDocument } from "../../finance_shared/utils/document_archive";
import FinanceRecouvrementApp from "../../finance_recouvrement/application/finance_recouvrement.app";
import { autoLiftAdministrativeRestrictions } from "../../finance_shared/utils/recovery_restrictions";
import PaiementModel from "../models/paiement.model";

type DbClient = PrismaClient | Prisma.TransactionClient;

type PaiementPayload = {
  facture_id: string;
  paye_le: Date;
  montant: number;
  statut: string;
  methode: string | null;
  numero_recu: string | null;
  reference: string | null;
  payeur_type: string | null;
  payeur_nom: string | null;
  payeur_reference: string | null;
  recu_par: string | null;
  echeance_ids: string[];
  penalite_retard: number;
  trop_percu: number;
  motif_trop_percu: string | null;
  motif_penalite: string | null;
};

type PaiementSplitPayload = {
  montant: number;
  methode: string | null;
  reference: string | null;
  payeur_type: string | null;
  payeur_nom: string | null;
  payeur_reference: string | null;
};

type PaiementOperationPayload = {
  motif: string | null;
  echeance_ids: string[];
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
    this.router.post("/mixed", this.createMixed.bind(this));
    this.router.get("/", this.getAll.bind(this));
    this.router.get("/:id", this.getOne.bind(this));
    this.router.post("/:id/cancel", this.cancel.bind(this));
    this.router.post("/:id/refund", this.refund.bind(this));
    this.router.post("/:id/refund-overpayment", this.refundOverpayment.bind(this));
    this.router.post("/:id/reconcile", this.reconcile.bind(this));
    this.router.post("/:id/reallocate", this.reallocate.bind(this));
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

  private resolveUserId(req: Request) {
    return (req as Request & { user?: { sub?: string } }).user?.sub ?? null;
  }

  private getRequestIp(req: Request) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) {
      return forwarded.split(",")[0]?.trim() ?? null;
    }
    return req.ip ?? null;
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
      case "card":
      case "carte":
      case "carte bancaire":
      case "cb":
        return "card";
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
    return ["mobile_money", "virement", "cheque", "bank", "card"].includes(
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

  private async buildReceiptNumber(tenantId: string, payeLe: Date) {
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
        paye_le: {
          gte: start,
          lte: end,
        },
      },
    });

    return `RECU-${dateKey}-${String(count + 1).padStart(4, "0")}`;
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

  private async getScopedFacture(
    factureId: string,
    tenantId: string,
    db: DbClient = this.prisma,
  ) {
    return db.facture.findFirst({
      where: { id: factureId, etablissement_id: tenantId },
      include: {
        paiements: true,
        echeances: {
          orderBy: [{ ordre: "asc" }, { date_echeance: "asc" }],
        },
      },
    });
  }

  private async autoActivateTransportSubscriptionsForFacture(
    tx: Prisma.TransactionClient,
    factureId: string,
    actorId?: string | null,
    ip?: string | null,
  ) {
    const facture = await tx.facture.findUnique({
      where: { id: factureId },
      include: {
        lignes: {
          select: {
            catalogue_frais_id: true,
          },
        },
        paiements: {
          select: {
            id: true,
            montant: true,
            statut: true,
          },
        },
        echeances: {
          select: {
            montant_restant: true,
            statut: true,
          },
        },
      },
    });

    if (!facture) return;
    if (this.getOutstandingAmount(facture) > 0) return;

    const catalogueFraisIds = Array.from(
      new Set(
        (facture.lignes ?? [])
          .map((line) => line.catalogue_frais_id)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    if (catalogueFraisIds.length === 0) return;

    const subscriptions = await tx.abonnementTransport.findMany({
      where: {
        eleve_id: facture.eleve_id,
        annee_scolaire_id: facture.annee_scolaire_id,
        statut: {
          in: [
            "EN_ATTENTE_VALIDATION_FINANCIERE",
            "EN_ATTENTE_REGLEMENT",
            "EN_ATTENTE_SUSPENSION_FINANCIERE",
            "SUSPENDU_FINANCE",
          ],
        },
        ligne: {
          is: {
            catalogue_frais_id: { in: catalogueFraisIds },
          },
        },
      },
      select: { id: true, facture_id: true, eleve_id: true, ligne_transport_id: true, statut: true },
    });

    if (subscriptions.length === 0) return;

    await tx.abonnementTransport.updateMany({
      where: { id: { in: subscriptions.map((item) => item.id) } },
      data: {
        statut: "ACTIF",
        facture_id: facture.id,
      },
    });

    if (subscriptions.length > 0) {
      await tx.$executeRaw(
        Prisma.sql`UPDATE abonnements_transport
          SET a_facturer = ${false}
          WHERE id IN (${Prisma.join(subscriptions.map((item) => item.id))})`,
      );
    }

    const reactivatedSubscriptions = subscriptions.filter((item) =>
      ["EN_ATTENTE_SUSPENSION_FINANCIERE", "SUSPENDU_FINANCE"].includes(
        (item.statut ?? "").toUpperCase(),
      ),
    );

    const cantineSubscriptions = await tx.abonnementCantine.findMany({
      where: {
        facture_id: facture.id,
        eleve_id: facture.eleve_id,
        annee_scolaire_id: facture.annee_scolaire_id,
        statut: {
          in: ["EN_ATTENTE_VALIDATION_FINANCIERE", "EN_ATTENTE_REGLEMENT"],
        },
      },
      select: { id: true },
    });

    if (cantineSubscriptions.length > 0) {
      await tx.abonnementCantine.updateMany({
        where: { id: { in: cantineSubscriptions.map((item) => item.id) } },
        data: {
          statut: "ACTIF",
          facture_id: facture.id,
        },
      });
    }

    if (reactivatedSubscriptions.length === 0) return;

    for (const subscription of reactivatedSubscriptions) {
      await tx.journalAudit.create({
        data: {
          etablissement_id: facture.etablissement_id,
          acteur_utilisateur_id: actorId ?? null,
          action: "TRANSPORT_REACTIVATION_FINANCIERE",
          type_entite: "ABONNEMENT_TRANSPORT",
          id_entite: subscription.id,
          avant_json: {
            statut: subscription.statut ?? null,
            facture_id: subscription.facture_id ?? null,
          } as Prisma.InputJsonValue,
          apres_json: {
            statut: "ACTIF",
            facture_id: facture.id,
            source: "PAIEMENT_FINANCE",
          } as Prisma.InputJsonValue,
          ip: ip ?? null,
        } as never,
      });
    }

    const transportPermissionCodes = [
      "TC.TRANSPORT.MENUACTION",
      "TC.TRANSPORT.MENUACTION.LIST",
      "TC.TRANSPORT.MENUACTION.PARAMETRE",
      "TC.TRANSPORT.MENUACTION.DASHBOARD",
      "TC.TRANSPORT.MENUACTION.ADD",
    ];

    const parentLinks = await tx.eleveParentTuteur.findMany({
      where: {
        eleve_id: facture.eleve_id,
        parent_tuteur: {
          etablissement_id: facture.etablissement_id,
        },
      },
      select: {
        parent_tuteur: {
          select: {
            utilisateur_id: true,
          },
        },
      },
    });

    const transportAssignments = await tx.utilisateurRole.findMany({
      where: {
        utilisateur: {
          etablissement_id: facture.etablissement_id,
        },
        role: {
          permissions: {
            some: {
              permission: {
                code: {
                  in: transportPermissionCodes,
                },
              },
            },
          },
        },
      },
      select: {
        utilisateur_id: true,
      },
    });

    const recipientIds = Array.from(
      new Set(
        [
          ...parentLinks
            .map((item) => item.parent_tuteur?.utilisateur_id)
            .filter((value): value is string => Boolean(value)),
          ...transportAssignments
            .map((item) => item.utilisateur_id)
            .filter((value): value is string => Boolean(value)),
          ...(actorId ? [actorId] : []),
        ],
      ),
    );

    if (recipientIds.length === 0) return;

    await tx.notification.createMany({
      data: reactivatedSubscriptions.flatMap((subscription) =>
        recipientIds.map((utilisateur_id) => ({
          utilisateur_id,
          type: "TRANSPORT_REACTIVATION_ACTIVEE",
          payload_json: {
            abonnement_transport_id: subscription.id,
            eleve_id: subscription.eleve_id,
            ligne_transport_id: subscription.ligne_transport_id,
            facture_id: facture.id,
            source: "PAIEMENT_FINANCE",
          } as Prisma.InputJsonValue,
        })),
      ),
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

  private getOutstandingAmount(facture: {
    total_montant?: unknown;
    paiements: Array<{ montant?: unknown; statut?: string | null }>;
    echeances?: Array<{ montant_restant?: unknown; statut?: string | null }>;
  }) {
    if ((facture.echeances?.length ?? 0) > 0) {
      return roundMoney(
        (facture.echeances ?? []).reduce((sum, echeance) => {
          if ((echeance.statut ?? "").toUpperCase() === "ANNULEE") return sum;
          return sum + Math.max(0, toMoney(echeance.montant_restant));
        }, 0),
      );
    }

    const alreadyPaid = this.sumPaiements(this.getActivePaiements(facture.paiements));
    const total = Number(facture.total_montant ?? 0);
    return roundMoney(Math.max(0, total - alreadyPaid));
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
    db: DbClient = this.prisma,
    options?: { allowOverpayment?: boolean },
  ) {
    const facture = await this.getScopedFacture(factureId, tenantId, db);

    if (!facture) {
      throw new Error("La facture selectionnee n'appartient pas a cet etablissement.");
    }

    if (facture.statut === "ANNULEE") {
      throw new Error("Impossible d'enregistrer un paiement sur une facture annulee.");
    }

    const scopedFacture = {
      ...facture,
      paiements: this.getActivePaiements(facture.paiements, excludePaymentId),
    };
    const remaining = this.getOutstandingAmount(scopedFacture);

    if (amount <= 0) {
      throw new Error("Le montant du paiement doit etre strictement positif.");
    }

    if (!options?.allowOverpayment && amount > remaining + 0.009) {
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
    let numero_recu = this.normalizeText(
      (raw as Record<string, unknown>).numero_recu ??
        (current as Record<string, unknown> | undefined)?.numero_recu,
    );

    if (this.requiresExternalReference(methode) && !reference) {
      throw new Error(
        "Une reference est obligatoire pour les paiements Mobile Money, virement, cheque, banque ou carte.",
      );
    }

    if (!reference && this.canAutoGenerateReference(methode)) {
      reference = await this.buildAutomaticReference(tenantId, methode, paye_le);
    }

    if (!numero_recu) {
      numero_recu = await this.buildReceiptNumber(tenantId, paye_le);
    }

    const penalite_retard = Math.max(
      0,
      this.toNumber((raw as Record<string, unknown>).penalite_retard ?? 0),
    );
    const effectivePenaliteRetard =
      penalite_retard > 0
        ? penalite_retard
        : await FinanceRecouvrementApp.suggestPenaltyForOverdueSelection(
            this.prisma,
            tenantId,
            facture_id,
            paye_le,
          );
    const trop_percu = Math.max(
      0,
      this.toNumber((raw as Record<string, unknown>).trop_percu ?? 0),
    );

    return {
      facture_id,
      paye_le,
      montant: this.toNumber(raw.montant ?? current?.montant ?? 0),
      statut: requestedStatus,
      methode,
      numero_recu,
      reference,
      payeur_type: this.normalizeText((raw as Record<string, unknown>).payeur_type ?? (current as Record<string, unknown> | undefined)?.payeur_type),
      payeur_nom: this.normalizeText((raw as Record<string, unknown>).payeur_nom ?? (current as Record<string, unknown> | undefined)?.payeur_nom),
      payeur_reference: this.normalizeText((raw as Record<string, unknown>).payeur_reference ?? (current as Record<string, unknown> | undefined)?.payeur_reference),
      recu_par: this.normalizeText(raw.recu_par ?? current?.recu_par),
      echeance_ids,
      penalite_retard: effectivePenaliteRetard,
      trop_percu,
      motif_trop_percu: this.normalizeText((raw as Record<string, unknown>).motif_trop_percu),
      motif_penalite: this.normalizeText((raw as Record<string, unknown>).motif_penalite),
    };
  }

  private async validateSelectedEcheances(
    tenantId: string,
    factureId: string,
    echeanceIds: string[],
    amount: number,
    db: DbClient = this.prisma,
  ) {
    if (echeanceIds.length === 0) return;

    const echeances = await db.echeancePaiement.findMany({
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

  private async normalizeSplitPayloads(
    raw: Record<string, unknown>,
    tenantId: string,
    payeLe: Date,
  ) {
    const splits = Array.isArray(raw.splits) ? raw.splits : [];
    const defaultPayeurType = this.normalizeText(raw.payeur_type);
    const defaultPayeurNom = this.normalizeText(raw.payeur_nom);
    const defaultPayeurReference = this.normalizeText(raw.payeur_reference);

    if (splits.length < 2) {
      throw new Error("Un paiement mixte doit contenir au moins deux lignes de reglement.");
    }

    const normalized: PaiementSplitPayload[] = [];

    for (const [index, entry] of splits.entries()) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        throw new Error(`La ligne ${index + 1} du paiement mixte est invalide.`);
      }

      const rawSplit = entry as Record<string, unknown>;
      const methode = this.normalizeMethode(rawSplit.methode);
      let reference = this.normalizeText(rawSplit.reference);

      if (this.requiresExternalReference(methode) && !reference) {
        throw new Error(
          `La reference est obligatoire pour la ligne ${index + 1} du paiement mixte.`,
        );
      }

      if (!reference && this.canAutoGenerateReference(methode)) {
        reference = `${await this.buildAutomaticReference(tenantId, methode, payeLe)}-L${index + 1}`;
      }

      const payeur_type = this.normalizeText(rawSplit.payeur_type) ?? defaultPayeurType;
      const payeur_nom = this.normalizeText(rawSplit.payeur_nom) ?? defaultPayeurNom;
      const payeur_reference =
        this.normalizeText(rawSplit.payeur_reference) ?? defaultPayeurReference;

      if (payeur_type && !payeur_nom) {
        throw new Error(
          `Le nom du payeur est requis pour la ligne ${index + 1} du paiement mixte.`,
        );
      }

      normalized.push({
        montant: this.toNumber(rawSplit.montant ?? 0),
        methode,
        reference,
        payeur_type,
        payeur_nom,
        payeur_reference,
      });
    }

    const total = roundMoney(normalized.reduce((sum, item) => sum + item.montant, 0));
    if (total <= 0) {
      throw new Error("Le paiement mixte doit contenir un montant strictement positif.");
    }

    return normalized;
  }

  private async applyLatePenalty(
    tx: Prisma.TransactionClient,
    args: {
      tenantId: string;
      factureId: string;
      amount: number;
      payeLe: Date;
      utilisateurId?: string | null;
      motif?: string | null;
    },
  ) {
    const penaltyAmount = roundMoney(Math.max(0, toMoney(args.amount)));
    if (penaltyAmount <= 0) return null;

    const facture = await tx.facture.findUnique({
      where: { id: args.factureId },
      include: {
        echeances: {
          orderBy: [{ ordre: "asc" }, { date_echeance: "asc" }],
        },
      },
    });

    if (!facture) {
      throw new Error("Facture introuvable pour l'application de la penalite.");
    }

    const paymentDay = new Date(args.payeLe);
    paymentDay.setHours(0, 0, 0, 0);

    const hasOverdueOpenInstallment = (facture.echeances ?? []).some((item) => {
      if ((item.statut ?? "").toUpperCase() === "ANNULEE") return false;
      return Math.max(0, toMoney(item.montant_restant)) > 0 && item.date_echeance < paymentDay;
    });

    if (!hasOverdueOpenInstallment) {
      throw new Error("Aucune echeance en retard ne permet d'appliquer une penalite.");
    }

    await tx.facture.update({
      where: { id: facture.id },
      data: {
        total_montant: roundMoney(toMoney(facture.total_montant) + penaltyAmount),
      },
    });

    await tx.factureLigne.create({
      data: {
        facture_id: facture.id,
        catalogue_frais_id: null,
        libelle: `Penalite de retard - ${paymentDay.toISOString().slice(0, 10)}`,
        quantite: 1,
        prix_unitaire: penaltyAmount,
        montant: penaltyAmount,
      },
    });

    const planId = await ensurePlanForFacture(tx, {
      factureId: facture.id,
      preferredModePaiement:
        (facture.echeances?.length ?? 0) > 1 ? "ECHELONNE" : "COMPTANT",
    });

    const maxFactureOrdre = (facture.echeances ?? []).reduce(
      (max, item) => Math.max(max, Number(item.ordre ?? 0)),
      0,
    );
    const maxPlanOrdre = planId
      ? Number(
          (
            await tx.echeancePaiement.findFirst({
              where: { plan_paiement_id: planId },
              select: { ordre: true },
              orderBy: [{ ordre: "desc" }],
            })
          )?.ordre ?? 0,
        )
      : 0;
    const nextOrdre = Math.max(maxFactureOrdre, maxPlanOrdre) + 1;

    const penaltyEcheance = await tx.echeancePaiement.create({
      data: {
        plan_paiement_id: planId,
        facture_id: facture.id,
        eleve_id: facture.eleve_id,
        annee_scolaire_id: facture.annee_scolaire_id,
        ordre: nextOrdre,
        libelle: "Penalite de retard",
        date_echeance: paymentDay,
        montant_prevu: penaltyAmount,
        montant_regle: 0,
        montant_restant: penaltyAmount,
        statut: deriveEcheanceStatus(penaltyAmount, 0, paymentDay, "A_VENIR"),
        devise: facture.devise ?? "MGA",
        notes: args.motif ?? "Penalite appliquee lors de l'encaissement d'une echeance en retard.",
      },
    });

    if (planId) {
      await syncPlanJsonFromEcheances(tx, planId);
    }

    await tx.operationFinanciere.create({
      data: {
        etablissement_id: args.tenantId,
        facture_id: facture.id,
        cree_par_utilisateur_id: args.utilisateurId ?? null,
        type: "PENALITE_RETARD",
        montant: penaltyAmount,
        motif: args.motif ?? null,
        details_json: {
          echeance_paiement_id: penaltyEcheance.id,
          libelle: penaltyEcheance.libelle,
          date_penalite: paymentDay.toISOString(),
        },
      },
    });

    await syncFactureStatusFromEcheances(tx, facture.id);
    return penaltyEcheance.id;
  }

  private async registerOverpayment(
    tx: Prisma.TransactionClient,
    args: {
      tenantId: string;
      paiementId: string;
      factureId: string;
      montant: number;
      numeroRecu: string | null;
      utilisateurId?: string | null;
      motif?: string | null;
    },
  ) {
    const amount = roundMoney(Math.max(0, toMoney(args.montant)));
    if (amount <= 0) return;

    await tx.operationFinanciere.create({
      data: {
        etablissement_id: args.tenantId,
        facture_id: args.factureId,
        paiement_id: args.paiementId,
        cree_par_utilisateur_id: args.utilisateurId ?? null,
        type: "TROP_PERCU",
        montant: amount,
        motif: args.motif ?? null,
        details_json: {
          montant_disponible: amount,
          numero_recu: args.numeroRecu,
          source: "paiement",
        },
      },
    });
  }

  private async autoLiftRestrictionsForFacture(
    tx: Prisma.TransactionClient,
    tenantId: string,
    factureId: string,
    utilisateurId?: string | null,
  ) {
    const facture = await tx.facture.findUnique({
      where: { id: factureId },
      select: {
        eleve_id: true,
        annee_scolaire_id: true,
      },
    });

    if (!facture) return;

    await autoLiftAdministrativeRestrictions(tx, {
      tenantId,
      eleveId: facture.eleve_id,
      anneeScolaireId: facture.annee_scolaire_id,
      utilisateurId,
    });
  }

  private normalizeOperationPayload(raw: Record<string, unknown>): PaiementOperationPayload {
    return {
      motif: this.normalizeText(raw.motif),
      echeance_ids: Array.isArray(raw.echeance_ids)
        ? Array.from(
            new Set(
              raw.echeance_ids
                .map((value) => (typeof value === "string" ? value.trim() : ""))
                .filter(Boolean),
            ),
          )
        : [],
    };
  }

  private readString(raw: Record<string, unknown>, key: string) {
    const value = raw[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private getReconciliationChannel(methode: string | null) {
    switch ((methode ?? "").toLowerCase()) {
      case "cash":
      case "famille":
        return "CAISSE";
      case "mobile_money":
        return "SYSTEME";
      case "virement":
      case "cheque":
      case "bank":
      case "card":
        return "BANQUE";
      default:
        return "SYSTEME";
    }
  }

  private async createPaymentRegistrationOperation(
    tx: Prisma.TransactionClient,
    args: {
      tenantId: string;
      paiementId: string;
      factureId: string;
      montant: number;
      methode: string | null;
      numeroRecu: string | null;
      reference: string | null;
      utilisateurId?: string | null;
      justificatifReference?: string | null;
      justificatifUrl?: string | null;
      justificatifNote?: string | null;
    },
  ) {
    const archivedJustificatif = await archiveLinkedDocument(tx, {
      tenantId: args.tenantId,
      ownerUserId: args.utilisateurId ?? null,
      entityType: "paiements",
      entityId: args.paiementId,
      tag: "JUSTIFICATIF_ENCAISSEMENT",
      documentPath: args.justificatifUrl,
      documentReference: args.justificatifReference,
    });

    await tx.operationFinanciere.create({
      data: {
        etablissement_id: args.tenantId,
        facture_id: args.factureId,
        paiement_id: args.paiementId,
        cree_par_utilisateur_id: args.utilisateurId ?? null,
        type: "ENREGISTREMENT_PAIEMENT",
        montant: args.montant,
        motif: "Encaissement enregistre.",
        details_json: {
          numero_recu: args.numeroRecu,
          reference: args.reference,
          methode: args.methode,
          justificatif_reference: args.justificatifReference,
          justificatif_url: args.justificatifUrl,
          justificatif_note: args.justificatifNote,
          fichier_archive_id: archivedJustificatif?.id ?? null,
          fichier_archive_chemin: archivedJustificatif?.chemin ?? null,
          fichier_archive_stockage: archivedJustificatif?.fournisseur_stockage ?? null,
          fichier_archive_tag: archivedJustificatif?.tag ?? null,
          rapprochement_statut: "EN_ATTENTE",
          rapprochement_canal: this.getReconciliationChannel(args.methode),
        },
      },
    });
  }

  private async getAvailableOverpaymentAmount(
    tx: DbClient,
    args: {
      tenantId: string;
      paiementId: string;
    },
  ) {
    const overpayments = await tx.operationFinanciere.findMany({
      where: {
        etablissement_id: args.tenantId,
        paiement_id: args.paiementId,
        type: "TROP_PERCU",
      },
      select: {
        montant: true,
        details_json: true,
      },
    });

    const reports = await tx.operationFinanciere.findMany({
      where: {
        etablissement_id: args.tenantId,
        type: { in: ["REPORT_SOLDE_PERIODE", "REMBOURSEMENT_TROP_PERCU"] },
      },
      select: {
        paiement_id: true,
        type: true,
        montant: true,
        details_json: true,
      },
    });

    const initial = roundMoney(
      overpayments.reduce((sum, operation) => {
        const details =
          operation.details_json && typeof operation.details_json === "object" && !Array.isArray(operation.details_json)
            ? (operation.details_json as Record<string, unknown>)
            : null;
        const explicit = details ? toMoney(details.montant_disponible) : 0;
        const fallback = toMoney(operation.montant);
        return sum + Math.max(0, explicit || fallback);
      }, 0),
    );

    const consumed = roundMoney(
      reports.reduce((sum, operation) => {
        const details =
          operation.details_json && typeof operation.details_json === "object" && !Array.isArray(operation.details_json)
            ? (operation.details_json as Record<string, unknown>)
            : null;
        const sourcePaiementId =
          typeof details?.source_paiement_id === "string" ? details.source_paiement_id.trim() : null;
        const isDirectRefund =
          (operation.type ?? "").toUpperCase() === "REMBOURSEMENT_TROP_PERCU" &&
          (operation.paiement_id === args.paiementId || sourcePaiementId === args.paiementId);
        const isReport =
          (operation.type ?? "").toUpperCase() === "REPORT_SOLDE_PERIODE" &&
          sourcePaiementId === args.paiementId;

        if (!isDirectRefund && !isReport) return sum;

        const amount = details
          ? Math.max(
              0,
              toMoney(
                (operation.type ?? "").toUpperCase() === "REMBOURSEMENT_TROP_PERCU"
                  ? details.montant_rembourse ?? operation.montant
                  : details.montant_source_utilise ?? operation.montant,
              ),
            )
          : Math.max(0, toMoney(operation.montant));

        return sum + amount;
      }, 0),
    );

    return roundMoney(Math.max(0, initial - consumed));
  }

  private normalizeOrderList(value: unknown) {
    if (!Array.isArray(value)) return [];
    return Array.from(
      new Set(
        value
          .map((entry) => Number.parseInt(String(entry), 10))
          .filter((entry) => Number.isInteger(entry) && entry > 0),
      ),
    );
  }

  private async resolveReallocationTarget(
    tenantId: string,
    raw: Record<string, unknown>,
    currentFactureId: string,
  ) {
    const explicitFactureId =
      typeof raw.facture_id === "string" && raw.facture_id.trim()
        ? raw.facture_id.trim()
        : null;
    const factureNumero =
      typeof raw.facture_numero === "string" && raw.facture_numero.trim()
        ? raw.facture_numero.trim().toUpperCase()
        : null;

    let factureId = explicitFactureId ?? currentFactureId;

    if (!explicitFactureId && factureNumero) {
      const facture = await this.prisma.facture.findFirst({
        where: {
          etablissement_id: tenantId,
          numero_facture: factureNumero,
        },
        select: { id: true },
      });
      if (!facture) {
        throw new Error("La facture cible de reaffectation est introuvable.");
      }
      factureId = facture.id;
    }

    const echeanceIds = Array.isArray(raw.echeance_ids)
      ? Array.from(
          new Set(
            raw.echeance_ids
              .map((value) => (typeof value === "string" ? value.trim() : ""))
              .filter(Boolean),
          ),
        )
      : [];
    const echeanceOrdres = this.normalizeOrderList(raw.echeance_ordres);

    if (echeanceIds.length > 0 || echeanceOrdres.length === 0) {
      return {
        factureId,
        echeanceIds,
      };
    }

    const echeances = await this.prisma.echeancePaiement.findMany({
      where: {
        facture_id: factureId,
        ordre: { in: echeanceOrdres },
      },
      select: { id: true, ordre: true },
    });

    if (echeances.length !== echeanceOrdres.length) {
      throw new Error("Une ou plusieurs echeances cibles sont introuvables sur la facture cible.");
    }

    return {
      factureId,
      echeanceIds: echeances
        .sort((left, right) => left.ordre - right.ordre)
        .map((item) => item.id),
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
          etablissement: {
            select: {
              id: true,
              nom: true,
              code: true,
            },
          },
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
      const userId = this.resolveUserId(req);
      const requestIp = this.getRequestIp(req);

      const result = await this.prisma.$transaction(async (tx) => {
        const justificatifReference = this.readString(req.body as Record<string, unknown>, "justificatif_reference");
        const justificatifUrl = this.readString(req.body as Record<string, unknown>, "justificatif_url");
        const justificatifNote = this.readString(req.body as Record<string, unknown>, "justificatif_note");
        const penaltyEcheanceId = await this.applyLatePenalty(tx, {
          tenantId,
          factureId: data.facture_id,
          amount: data.penalite_retard,
          payeLe: data.paye_le,
          utilisateurId: userId,
          motif: data.motif_penalite,
        });
        const targetEcheanceIds = Array.from(
          new Set([
            ...data.echeance_ids,
            ...(penaltyEcheanceId ? [penaltyEcheanceId] : []),
          ]),
        );
        const allocatableAmount = roundMoney(Math.max(0, data.montant - data.trop_percu));

        await this.ensureAllowedAmount(
          data.facture_id,
          tenantId,
          allocatableAmount,
          undefined,
          tx,
          { allowOverpayment: data.trop_percu > 0 },
        );
        await this.validateSelectedEcheances(
          tenantId,
          data.facture_id,
          targetEcheanceIds,
          allocatableAmount,
          tx,
        );

        const paiement = await tx.paiement.create({
          data: {
            facture_id: data.facture_id,
            paye_le: data.paye_le,
            montant: data.montant,
            statut: data.statut,
            methode: data.methode,
            numero_recu: data.numero_recu,
            reference: data.reference,
            payeur_type: data.payeur_type,
            payeur_nom: data.payeur_nom,
            payeur_reference: data.payeur_reference,
            recu_par: data.recu_par,
          } as never,
        });

        await this.createPaymentRegistrationOperation(tx, {
          tenantId,
          paiementId: paiement.id,
          factureId: data.facture_id,
          montant: data.montant,
          methode: data.methode,
          numeroRecu: data.numero_recu,
          reference: data.reference,
          utilisateurId: userId,
          justificatifReference,
          justificatifUrl,
          justificatifNote,
        });

        await allocatePaiementsToFactureEcheances(tx, data.facture_id, {
          [paiement.id]: targetEcheanceIds,
        });

        const appliedAffectations = await tx.paiementEcheanceAffectation.findMany({
          where: { paiement_id: paiement.id },
          select: { montant: true },
        });
        const allocatedAmount = roundMoney(
          appliedAffectations.reduce((sum, item) => sum + toMoney(item.montant), 0),
        );
        const overpaymentAmount = roundMoney(Math.max(0, data.montant - allocatedAmount));
        if (overpaymentAmount > 0) {
          await this.registerOverpayment(tx, {
            tenantId,
            paiementId: paiement.id,
            factureId: data.facture_id,
            montant: overpaymentAmount,
            numeroRecu: data.numero_recu,
            utilisateurId: userId,
            motif: data.motif_trop_percu,
          });
        }

        await this.autoLiftRestrictionsForFacture(tx, tenantId, data.facture_id, userId);
        await this.autoActivateTransportSubscriptionsForFacture(
          tx,
          data.facture_id,
          userId,
          requestIp,
        );

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

  private async createMixed(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const data = await this.normalizePayload(req.body, tenantId);
      const splits = await this.normalizeSplitPayloads(req.body as Record<string, unknown>, tenantId, data.paye_le);
      const totalAmount = roundMoney(splits.reduce((sum, item) => sum + item.montant, 0));
      const userId = this.resolveUserId(req);
      const requestIp = this.getRequestIp(req);

      const result = await this.prisma.$transaction(async (tx) => {
        const justificatifReference = this.readString(req.body as Record<string, unknown>, "justificatif_reference");
        const justificatifUrl = this.readString(req.body as Record<string, unknown>, "justificatif_url");
        const justificatifNote = this.readString(req.body as Record<string, unknown>, "justificatif_note");
        const penaltyEcheanceId = await this.applyLatePenalty(tx, {
          tenantId,
          factureId: data.facture_id,
          amount: data.penalite_retard,
          payeLe: data.paye_le,
          utilisateurId: userId,
          motif: data.motif_penalite,
        });
        const targetEcheanceIds = Array.from(
          new Set([
            ...data.echeance_ids,
            ...(penaltyEcheanceId ? [penaltyEcheanceId] : []),
          ]),
        );
        const allocatableAmount = roundMoney(Math.max(0, totalAmount - data.trop_percu));

        await this.ensureAllowedAmount(
          data.facture_id,
          tenantId,
          allocatableAmount,
          undefined,
          tx,
          { allowOverpayment: data.trop_percu > 0 },
        );
        await this.validateSelectedEcheances(
          tenantId,
          data.facture_id,
          targetEcheanceIds,
          allocatableAmount,
          tx,
        );

        const paiements = await Promise.all(
          splits.map(async (split, index) =>
            (async () => {
              const paiement = await tx.paiement.create({
                data: {
                  facture_id: data.facture_id,
                  paye_le: data.paye_le,
                  montant: split.montant,
                  statut: "ENREGISTRE",
                  methode: split.methode,
                  numero_recu: `${await this.buildReceiptNumber(tenantId, data.paye_le)}-${String(index + 1).padStart(2, "0")}`,
                  reference: split.reference,
                  payeur_type: split.payeur_type,
                  payeur_nom: split.payeur_nom,
                  payeur_reference: split.payeur_reference,
                  recu_par: data.recu_par,
                } as never,
              });
              await this.createPaymentRegistrationOperation(tx, {
                tenantId,
                paiementId: paiement.id,
                factureId: data.facture_id,
                montant: split.montant,
                methode: split.methode,
                numeroRecu: (paiement as Record<string, unknown>).numero_recu as string | null,
                reference: split.reference,
                utilisateurId: userId,
                justificatifReference,
                justificatifUrl,
                justificatifNote,
              });
              return paiement;
            })(),
          ),
        );

        await tx.operationFinanciere.create({
          data: {
            etablissement_id: tenantId,
            facture_id: data.facture_id,
            cree_par_utilisateur_id: userId,
            type: "PAIEMENT_MIXTE",
            montant: totalAmount,
            motif: this.normalizeText((req.body as Record<string, unknown>).motif) ?? null,
            details_json: {
              paiement_ids: paiements.map((item) => item.id),
              nombre_lignes: paiements.length,
              echeance_ids: targetEcheanceIds,
            },
          },
        });

        await allocatePaiementsToFactureEcheances(
          tx,
          data.facture_id,
          Object.fromEntries(paiements.map((item) => [item.id, targetEcheanceIds])),
        );

        for (const paiement of paiements) {
          const appliedAffectations = await tx.paiementEcheanceAffectation.findMany({
            where: { paiement_id: paiement.id },
            select: { montant: true },
          });
          const allocatedAmount = roundMoney(
            appliedAffectations.reduce((sum, item) => sum + toMoney(item.montant), 0),
          );
          const overpaymentAmount = roundMoney(Math.max(0, toMoney(paiement.montant) - allocatedAmount));
          if (overpaymentAmount > 0) {
            await this.registerOverpayment(tx, {
              tenantId,
              paiementId: paiement.id,
              factureId: data.facture_id,
              montant: overpaymentAmount,
              numeroRecu: (paiement as Record<string, unknown>).numero_recu as string | null,
              utilisateurId: userId,
              motif: data.motif_trop_percu,
            });
          }
        }

        await this.autoLiftRestrictionsForFacture(tx, tenantId, data.facture_id, userId);
        await this.autoActivateTransportSubscriptionsForFacture(
          tx,
          data.facture_id,
          userId,
          requestIp,
        );

        return tx.paiement.findMany({
          where: { id: { in: paiements.map((item) => item.id) } },
          include: this.getInclude(),
          orderBy: [{ created_at: "asc" }],
        });
      });

      Response.success(res, "Paiement mixte cree avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la creation du paiement mixte", 400, error as Error);
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
        affectations?: Array<{
          echeance?: {
            id?: string | null;
          } | null;
        }> | null;
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

  private async reallocate(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = (await this.getScopedPaiement(req.params.id, tenantId)) as (PaiementRecord & {
        facture_id: string;
        reference?: string | null;
        methode?: string | null;
        affectations?: Array<{
          echeance?: {
            id?: string | null;
          } | null;
        }> | null;
      }) | null;

      if (!existing) {
        throw new Error("Paiement introuvable pour cet etablissement.");
      }

      if ((existing.statut ?? "ENREGISTRE").toUpperCase() !== "ENREGISTRE") {
        throw new Error(
          "Ce paiement a deja fait l'objet d'une operation comptable et ne peut plus etre reaffecte.",
        );
      }

      const payload = this.normalizeOperationPayload(req.body as Record<string, unknown>);
      const target = await this.resolveReallocationTarget(
        tenantId,
        req.body as Record<string, unknown>,
        existing.facture_id,
      );
      const data = await this.normalizePayload(
        ({
          ...(req.body as Record<string, unknown>),
          facture_id: target.factureId,
          echeance_ids: target.echeanceIds,
        } as unknown) as Partial<PaiementRecord>,
        tenantId,
        existing,
      );
      await this.ensureAllowedAmount(data.facture_id, tenantId, data.montant, req.params.id);
      await this.validateSelectedEcheances(
        tenantId,
        data.facture_id,
        data.echeance_ids,
        data.montant,
      );

      const previousEcheanceIds = (existing.affectations ?? []).map((item) => item.echeance?.id).filter(
        (value): value is string => Boolean(value),
      );
      const userId = (req as Request & { user?: { sub?: string } }).user?.sub ?? null;

      const result = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.paiement.update({
          where: { id: req.params.id },
          data: {
            facture_id: data.facture_id,
            montant: data.montant,
            paye_le: data.paye_le,
            methode: data.methode,
            reference: data.reference,
            payeur_type: data.payeur_type,
            payeur_nom: data.payeur_nom,
            payeur_reference: data.payeur_reference,
            recu_par: data.recu_par,
          } as never,
        });

        await tx.operationFinanciere.create({
          data: {
            etablissement_id: tenantId,
            facture_id: data.facture_id,
            paiement_id: updated.id,
            cree_par_utilisateur_id: userId,
            type: "REAFFECTATION_PAIEMENT",
            montant: data.montant,
            motif: payload.motif,
            details_json: {
              ancienne_facture_id: existing.facture_id,
              nouvelle_facture_id: data.facture_id,
              anciennes_echeances: previousEcheanceIds,
              nouvelles_echeances: data.echeance_ids,
            },
          },
        });

        const factureIds = Array.from(new Set([existing.facture_id, data.facture_id]));
        for (const factureId of factureIds) {
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

      Response.success(res, "Paiement reaffecte avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la reaffectation du paiement", 400, error as Error);
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

  private async refundOverpayment(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = (await this.getScopedPaiement(req.params.id, tenantId)) as (PaiementRecord & {
        facture_id: string;
        numero_recu?: string | null;
        reference?: string | null;
      }) | null;

      if (!existing) {
        throw new Error("Paiement introuvable pour cet etablissement.");
      }

      if ((existing.statut ?? "ENREGISTRE").toUpperCase() === "ANNULE") {
        throw new Error("Impossible de rembourser un trop-percu rattache a un paiement annule.");
      }

      const payload = this.normalizeOperationPayload(req.body as Record<string, unknown>);
      const requestedAmount = roundMoney(
        Math.max(0, toMoney((req.body as Record<string, unknown>).montant ?? 0)),
      );

      if (requestedAmount <= 0) {
        throw new Error("Le montant rembourse doit etre strictement positif.");
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const available = await this.getAvailableOverpaymentAmount(tx, {
          tenantId,
          paiementId: existing.id,
        });

        if (available <= 0) {
          throw new Error("Aucun trop-percu disponible n'est rattache a ce paiement.");
        }

        if (requestedAmount > available + 0.009) {
          throw new Error("Le montant demande depasse le trop-percu disponible.");
        }

        await tx.operationFinanciere.create({
          data: {
            etablissement_id: tenantId,
            facture_id: existing.facture_id,
            paiement_id: existing.id,
            cree_par_utilisateur_id: (req as Request & { user?: { sub?: string } }).user?.sub ?? null,
            type: "REMBOURSEMENT_TROP_PERCU",
            montant: requestedAmount,
            motif: payload.motif,
            details_json: {
              source_paiement_id: existing.id,
              numero_recu: existing.numero_recu ?? null,
              reference_paiement: existing.reference ?? null,
              montant_rembourse: requestedAmount,
              montant_disponible_apres_remboursement: roundMoney(Math.max(0, available - requestedAmount)),
            },
          },
        });

        return tx.paiement.findUnique({
          where: { id: existing.id },
          include: this.getInclude(),
        });
      });

      Response.success(res, "Trop-percu rembourse avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors du remboursement du trop-percu", 400, error as Error);
      next(error);
    }
  }

  private async reconcile(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedPaiement(req.params.id, tenantId);

      if (!existing) {
        throw new Error("Paiement introuvable pour cet etablissement.");
      }

      const canal = this.readString(req.body as Record<string, unknown>, "canal") ?? this.getReconciliationChannel((existing as Record<string, unknown>).methode as string | null);
      const referenceRapprochement = this.readString(req.body as Record<string, unknown>, "reference_rapprochement");
      const note = this.readString(req.body as Record<string, unknown>, "note");

      const result = await this.prisma.$transaction(async (tx) => {
        await tx.operationFinanciere.create({
          data: {
            etablissement_id: tenantId,
            facture_id: (existing as Record<string, unknown>).facture_id as string,
            paiement_id: existing.id,
            cree_par_utilisateur_id: (req as Request & { user?: { sub?: string } }).user?.sub ?? null,
            type: "RAPPROCHEMENT_PAIEMENT",
            montant: existing.montant,
            motif: note,
            details_json: {
              canal,
              reference_rapprochement: referenceRapprochement,
              rapproche_le: new Date().toISOString(),
              statut: "RAPPROCHE",
            },
          },
        });

        return tx.paiement.findUnique({
          where: { id: existing.id },
          include: this.getInclude(),
        });
      });

      Response.success(res, "Paiement rapproche avec succes.", result);
    } catch (error) {
      Response.error(res, "Erreur lors du rapprochement du paiement", 400, error as Error);
      next(error);
    }
  }
}

export default PaiementApp;
