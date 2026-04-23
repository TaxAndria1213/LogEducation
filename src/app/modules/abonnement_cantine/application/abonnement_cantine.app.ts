import { Application, NextFunction, Request, Response as R, Router } from "express";
import { Prisma, PrismaClient } from "@prisma/client";
import Response from "../../../common/app/response";
import { prisma } from "../../../service/prisma";
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

type ChangeFormulaPayload = {
  formule_cantine_id: string;
  date_effet: Date;
};

type CantineAccessCheckPayload = {
  abonnement_cantine_id?: string | null;
  lookup?: string | null;
  reference_date?: Date | null;
};

type CantineFinanceSuspensionPayload = {
  source: string;
  motif: string | null;
  finance_status: string | null;
};

type CantineRechargePayload = {
  montant: number;
  methode: string;
  reference: string | null;
  note: string | null;
  rechargement_le: Date;
};

type CantineConsumptionPayload = {
  type_repas: string;
  note: string | null;
  consommation_le: Date;
};

type CantineAbsencePayload = {
  type_evenement: "ABSENCE" | "ANNULATION";
  note: string | null;
  date_repas: Date;
};

type CantineAbsenceFinancePayload = {
  decision_finance: "AVOIR" | "REPORT" | "REMBOURSEMENT" | "AJUSTEMENT" | "REFUS_REGULARISATION";
  note: string | null;
};

type AbonnementCantineScopedRecord = Awaited<ReturnType<AbonnementCantineApp["getScopedRecord"]>>;

type CantineControlAnomalyCode =
  | "REPAS_SANS_AUTORISATION_ACTIVE"
  | "PAYE_SANS_CONSOMMATION"
  | "CONSOMMATION_SUPERIEURE_AUX_DROITS";

type CantineControlAnomalyRow = {
  anomaly_id: string;
  code: CantineControlAnomalyCode;
  gravite: "HIGH" | "MEDIUM";
  abonnement_cantine_id: string | null;
  consommation_cantine_id?: string | null;
  eleve_id: string | null;
  eleve_label: string;
  code_eleve: string | null;
  annee_scolaire_id: string | null;
  annee_label: string | null;
  formule_cantine_id: string | null;
  formule_label: string | null;
  formule_type: string | null;
  finance_status: string | null;
  service_status: string | null;
  access_status: string | null;
  motif: string;
  evaluation_date: Date | null;
  period_start: Date | null;
  period_end: Date | null;
  consommation_le?: Date | null;
  consommation_count?: number;
  allowed_count?: number | null;
  tracking_status: "OUVERTE" | "RESOLUE" | "IGNOREE";
};

type CantineControlAnomalySummary = {
  total: number;
  repas_sans_autorisation_active: number;
  payes_sans_consommation: number;
  consommations_superieures_aux_droits: number;
};

type CantineOperationalStatus =
  | "AUTORISE"
  | "SUSPENDU"
  | "EN_ATTENTE"
  | "INSUFFISANT"
  | "EXPIRE";

type CantineOperationalSummary = {
  autorises: number;
  suspendus: number;
  en_attente: number;
  insuffisants: number;
  expires: number;
};

type CantineOperationalQueryContext = {
  referenceDate: Date;
  periodStart: Date;
  periodEnd: Date;
  search: string | null;
  accessStatusFilter: CantineOperationalStatus | null;
};

type CantineControlAnomalyQueryContext = {
  referenceDate: Date;
  periodStart: Date;
  periodEnd: Date;
  search: string | null;
};

class AbonnementCantineApp {
  public app: Application;
  public router: Router;
  private abonnementCantine: AbonnementCantineModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.abonnementCantine = new AbonnementCantineModel();
    this.prisma = prisma;
    this.routes();
  }

  public routes(): Router {
    this.router.post("/", this.create.bind(this));
    this.router.get("/", this.getAll.bind(this));
    this.router.get("/pending-finance-billing", this.getPendingFinanceBilling.bind(this));
    this.router.get("/pending-finance-regularization", this.getPendingFinanceRegularization.bind(this));
    this.router.get("/pending-finance-consumption-control", this.getPendingFinanceConsumptionControl.bind(this));
    this.router.get("/pending-finance-absence-regularization", this.getPendingFinanceAbsenceRegularization.bind(this));
    this.router.get("/pending-finance-suspension", this.getPendingFinanceSuspension.bind(this));
    this.router.get("/operational-list", this.getOperationalList.bind(this));
    this.router.get("/control-anomalies", this.getControlAnomalies.bind(this));
    this.router.post("/control-anomalies/mark", this.markControlAnomaly.bind(this));
    this.router.post("/absences/:absenceId/process-finance-regularization", this.processFinanceAbsenceRegularization.bind(this));
    this.router.post("/consommations/:consommationId/process-finance-control", this.processFinanceConsumptionControl.bind(this));
    this.router.post("/access-check", this.checkAccess.bind(this));
    this.router.get("/:id", this.getOne.bind(this));
    this.router.get("/:id/wallet", this.getWallet.bind(this));
    this.router.post("/:id/change-formula", this.changeFormula.bind(this));
    this.router.post("/:id/report-absence", this.reportAbsence.bind(this));
    this.router.post("/:id/signal-finance-suspension", this.signalFinanceSuspension.bind(this));
    this.router.post("/:id/process-finance-billing", this.processFinanceBilling.bind(this));
    this.router.post("/:id/process-finance-regularization", this.processFinanceRegularization.bind(this));
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

  private normalizeChangeFormulaPayload(raw: Record<string, unknown>): ChangeFormulaPayload {
    const formule_cantine_id =
      typeof raw.formule_cantine_id === "string" ? raw.formule_cantine_id.trim() : "";
    const rawDateEffet =
      raw.date_effet instanceof Date
        ? raw.date_effet
        : typeof raw.date_effet === "string" && raw.date_effet.trim()
          ? new Date(raw.date_effet)
          : new Date();

    if (!formule_cantine_id) {
      throw new Error("La nouvelle formule de cantine est obligatoire.");
    }

    if (Number.isNaN(rawDateEffet.getTime())) {
      throw new Error("La date d'effet du changement de formule est invalide.");
    }

    return {
      formule_cantine_id,
      date_effet: rawDateEffet,
    };
  }

  private normalizeAccessCheckPayload(raw: Record<string, unknown>): CantineAccessCheckPayload {
    const abonnement_cantine_id =
      typeof raw.abonnement_cantine_id === "string" && raw.abonnement_cantine_id.trim()
        ? raw.abonnement_cantine_id.trim()
        : null;
    const lookup =
      typeof raw.lookup === "string" && raw.lookup.trim()
        ? raw.lookup.trim()
        : null;
    const rawReferenceDate =
      raw.reference_date instanceof Date
        ? raw.reference_date
        : typeof raw.reference_date === "string" && raw.reference_date.trim()
          ? new Date(raw.reference_date)
          : null;

    if (!abonnement_cantine_id && !lookup) {
      throw new Error("Renseigne un abonnement cantine ou une valeur de recherche.");
    }

    if (rawReferenceDate && Number.isNaN(rawReferenceDate.getTime())) {
      throw new Error("La date de controle cantine est invalide.");
    }

    return {
      abonnement_cantine_id,
      lookup,
      reference_date: rawReferenceDate,
    };
  }

  private normalizeFinanceSuspensionPayload(raw: Record<string, unknown>): CantineFinanceSuspensionPayload {
    const source =
      typeof raw.source === "string" && raw.source.trim() ? raw.source.trim().toUpperCase() : "FINANCE";
    const motif = typeof raw.motif === "string" && raw.motif.trim() ? raw.motif.trim() : null;
    const finance_status =
      typeof raw.finance_status === "string" && raw.finance_status.trim()
        ? raw.finance_status.trim().toUpperCase()
        : null;
    return { source, motif, finance_status };
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
      type_repas,
      note,
      consommation_le,
    };
  }

  private normalizeAbsencePayload(raw: Record<string, unknown>): CantineAbsencePayload {
    const typeEvenementRaw =
      typeof raw.type_evenement === "string" && raw.type_evenement.trim()
        ? raw.type_evenement.trim().toUpperCase()
        : "ABSENCE";
    const type_evenement = ["ABSENCE", "ANNULATION"].includes(typeEvenementRaw)
      ? (typeEvenementRaw as CantineAbsencePayload["type_evenement"])
      : "ABSENCE";
    const note = typeof raw.note === "string" && raw.note.trim() ? raw.note.trim() : null;
    const dateRaw =
      typeof raw.date_repas === "string" && raw.date_repas.trim()
        ? raw.date_repas.trim()
        : null;
    const date_repas = dateRaw ? new Date(dateRaw) : new Date();

    if (Number.isNaN(date_repas.getTime())) {
      throw new Error("La date d'absence ou d'annulation cantine est invalide.");
    }

    return {
      type_evenement,
      note,
      date_repas,
    };
  }

  private normalizeAbsenceFinancePayload(raw: Record<string, unknown>): CantineAbsenceFinancePayload {
    const decisionRaw =
      typeof raw.decision_finance === "string" && raw.decision_finance.trim()
        ? raw.decision_finance.trim().toUpperCase()
        : "AVOIR";
    const decision_finance = [
      "AVOIR",
      "REPORT",
      "REMBOURSEMENT",
      "AJUSTEMENT",
      "REFUS_REGULARISATION",
    ].includes(decisionRaw)
      ? (decisionRaw as CantineAbsenceFinancePayload["decision_finance"])
      : "AVOIR";
    const note = typeof raw.note === "string" && raw.note.trim() ? raw.note.trim() : null;

    return {
      decision_finance,
      note,
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
    const [
      latestReactivationBySubscription,
      latestFormulaRegularizationBySubscription,
      latestAbsenceRegularizationBySubscription,
      suspensionAudits,
    ] = await Promise.all([
      this.getLatestFinancialReactivationDates(ids),
      this.getLatestFormulaRegularizationDates(ids),
      this.getLatestAbsenceRegularizationDates(ids),
      this.prisma.journalAudit.findMany({
        where: {
          action: "CANTINE_SUSPENSION_FINANCIERE",
          type_entite: "ABONNEMENT_CANTINE",
          id_entite: { in: ids },
        },
        select: {
          id_entite: true,
          apres_json: true,
          date_action: true,
        },
        orderBy: [{ date_action: "desc" }, { created_at: "desc" }],
      }),
    ]);
    const facturesById = new Map(factures.map((item) => [item.id, item]));
    const suspensionAuditById = new Map<string, { apres_json: Prisma.JsonValue | null }>();
    for (const audit of suspensionAudits) {
      if (!audit.id_entite || suspensionAuditById.has(audit.id_entite)) continue;
      suspensionAuditById.set(audit.id_entite, { apres_json: audit.apres_json });
    }
    return records.map((item) => {
      const row = recordById.get(item.id);
      const facture_id = row?.facture_id ?? null;
      const facture = facture_id ? facturesById.get(facture_id) ?? null : null;
      const statut = String((item as Record<string, unknown>).statut ?? "").toUpperCase();
      const factureStatus = String(facture?.statut ?? "").toUpperCase();
      const suspensionAudit = suspensionAuditById.get(item.id);
      const suspensionDetails =
        suspensionAudit?.apres_json &&
        typeof suspensionAudit.apres_json === "object" &&
        !Array.isArray(suspensionAudit.apres_json)
          ? (suspensionAudit.apres_json as Record<string, unknown>)
          : null;
      const suspensionFinanceStatusRaw =
        typeof suspensionDetails?.finance_status === "string"
          ? String(suspensionDetails.finance_status).toUpperCase()
          : null;
      const suspensionFinanceStatus =
        suspensionFinanceStatusRaw === "EN_ATTENTE_REGLEMENT"
          ? "IMPAYE_SIGNALE"
          : suspensionFinanceStatusRaw;
      const latestReactivation = latestReactivationBySubscription.get(item.id) ?? null;
      const latestFormulaRegularization =
        latestFormulaRegularizationBySubscription.get(item.id) ?? null;
      const latestAbsenceRegularization =
        latestAbsenceRegularizationBySubscription.get(item.id) ?? null;
      const latestFinancialRegularization = [
        latestReactivation,
        latestFormulaRegularization,
        latestAbsenceRegularization,
      ]
        .filter((value): value is Date => Boolean(value))
        .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
      let finance_status: string | null;
      if (factureStatus === "PAYEE") {
        finance_status = latestFinancialRegularization ? "REGULARISE" : "REGLE";
      } else if (factureStatus === "PARTIELLE") {
        finance_status = "PARTIELLEMENT_REGLE";
      } else if (factureStatus === "EN_RETARD") {
        finance_status = "IMPAYE";
      } else if (statut === "SUSPENDU" && suspensionFinanceStatus) {
        finance_status = "SUSPENDU";
      } else if (statut === "SUSPENDU") {
        finance_status = "SUSPENDU";
      } else if (statut === "EN_ATTENTE_VALIDATION_FINANCIERE") {
        finance_status = "EN_ATTENTE_VALIDATION_FINANCIERE";
      } else if (statut === "EN_ATTENTE_REGLEMENT") {
        finance_status = "EN_ATTENTE_REGLEMENT";
      } else if (facture_id) {
        finance_status = "EN_ATTENTE_REGLEMENT";
      } else if (statut === "ACTIF") {
        finance_status = "ACTIF";
      } else {
        finance_status = statut || null;
      }
      const dateEffet =
        row?.date_effet ?? ((item as Record<string, unknown>).date_effet as Date | null | undefined) ?? null;
      const soldePrepaye = Number((item as Record<string, unknown>).solde_prepaye ?? 0);
      const soldeMinAlerte = Number((item as Record<string, unknown>).solde_min_alerte ?? 0);
      const formuleType =
        ((item as Record<string, unknown>).formule as { type_formule?: string | null } | undefined)?.type_formule ??
        null;
      const validityEnd =
        ((item as Record<string, unknown>).annee as { date_fin?: Date | null } | undefined)?.date_fin ?? null;
      const decision = this.deriveAccessDecision({
        statut,
        financeStatus: finance_status,
        dateEffet,
        validityEnd,
        formuleType,
        soldePrepaye,
        soldeMinAlerte,
      });
      return {
        ...item,
        facture_id,
        date_effet: dateEffet,
        facture,
        finance_status,
        derniere_reactivation_financiere: latestReactivation,
        access_status: decision.access_status,
        access_reason: decision.access_reason,
        validity_start: decision.validity_start,
        validity_end: decision.validity_end,
      };
    });
  }

  private async getLatestFinancialReactivationDates(subscriptionIds: string[]) {
    if (subscriptionIds.length === 0) return new Map<string, Date>();

    const rows = await this.prisma.journalAudit.findMany({
      where: {
        type_entite: "ABONNEMENT_CANTINE",
        action: "CANTINE_REACTIVATION_FINANCIERE",
        id_entite: { in: subscriptionIds },
      },
      select: {
        id_entite: true,
        date_action: true,
      },
      orderBy: [{ date_action: "desc" }],
    });

    const latestBySubscription = new Map<string, Date>();
    rows.forEach((row) => {
      if (typeof row.id_entite !== "string" || !row.id_entite.trim()) return;
      if (!latestBySubscription.has(row.id_entite)) {
        latestBySubscription.set(row.id_entite, row.date_action);
      }
    });
    return latestBySubscription;
  }

  private extractFinanceProcessedAt(value: unknown) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const raw = value as Record<string, unknown>;
    const financeProcessedAt =
      typeof raw.finance_processed_at === "string" && raw.finance_processed_at.trim()
        ? new Date(raw.finance_processed_at.trim())
        : null;
    if (!financeProcessedAt || Number.isNaN(financeProcessedAt.getTime())) return null;
    return financeProcessedAt;
  }

  private async getLatestFormulaRegularizationDates(subscriptionIds: string[]) {
    if (subscriptionIds.length === 0) return new Map<string, Date>();

    const rows = await this.prisma.historiqueFormuleCantine.findMany({
      where: {
        abonnement_cantine_id: { in: subscriptionIds },
      },
      select: {
        abonnement_cantine_id: true,
        details_json: true,
      },
      orderBy: [{ created_at: "desc" }],
    });

    const latestBySubscription = new Map<string, Date>();
    rows.forEach((row) => {
      const processedAt = this.extractFinanceProcessedAt(row.details_json);
      if (!processedAt) return;
      const current = latestBySubscription.get(row.abonnement_cantine_id);
      if (!current || processedAt > current) {
        latestBySubscription.set(row.abonnement_cantine_id, processedAt);
      }
    });
    return latestBySubscription;
  }

  private async getLatestAbsenceRegularizationDates(subscriptionIds: string[]) {
    if (subscriptionIds.length === 0) return new Map<string, Date>();

    const rows = await this.prisma.absenceCantine.findMany({
      where: {
        abonnement_cantine_id: { in: subscriptionIds },
        finance_processed_at: { not: null },
      },
      select: {
        abonnement_cantine_id: true,
        finance_processed_at: true,
      },
      orderBy: [{ finance_processed_at: "desc" }],
    });

    const latestBySubscription = new Map<string, Date>();
    rows.forEach((row) => {
      if (!row.finance_processed_at) return;
      const current = latestBySubscription.get(row.abonnement_cantine_id);
      if (!current || row.finance_processed_at > current) {
        latestBySubscription.set(row.abonnement_cantine_id, row.finance_processed_at);
      }
    });
    return latestBySubscription;
  }

  private deriveAccessDecision(args: {
    statut: string;
    financeStatus: string | null;
    dateEffet: Date | null;
    validityEnd: Date | null;
    formuleType: string | null;
    soldePrepaye: number;
    soldeMinAlerte: number;
    referenceDate?: Date;
  }) {
    const referenceDate = args.referenceDate ?? new Date();
    const todayKey = referenceDate.toISOString().slice(0, 10);
    const startKey = args.dateEffet ? args.dateEffet.toISOString().slice(0, 10) : null;
    const endKey = args.validityEnd ? args.validityEnd.toISOString().slice(0, 10) : null;

    if (args.statut === "SUSPENDU") {
      return {
        access_status: "SUSPENDU",
        access_reason: "SERVICE_SUSPENDU",
        validity_start: args.dateEffet,
        validity_end: args.validityEnd,
      };
    }

    if (["ANNULE", "RESILIE", "INACTIF"].includes(args.statut) || (endKey && todayKey > endKey)) {
      return {
        access_status: "EXPIRE",
        access_reason: endKey && todayKey > endKey ? "PERIODE_TERMINEE" : "SERVICE_INACTIF",
        validity_start: args.dateEffet,
        validity_end: args.validityEnd,
      };
    }

    if (startKey && todayKey < startKey) {
      return {
        access_status: "EN_ATTENTE",
        access_reason: "SERVICE_NON_EFFECTIF",
        validity_start: args.dateEffet,
        validity_end: args.validityEnd,
      };
    }

    if (!["REGLE", "ACTIF", "REGULARISE"].includes((args.financeStatus ?? "").toUpperCase())) {
      return {
        access_status: "EN_ATTENTE",
        access_reason: "VALIDATION_FINANCIERE_EN_ATTENTE",
        validity_start: args.dateEffet,
        validity_end: args.validityEnd,
      };
    }

    if ((args.formuleType ?? "").toUpperCase() === "REPAS_UNITAIRE" && args.soldePrepaye <= Math.max(0, args.soldeMinAlerte)) {
      return {
        access_status: "INSUFFISANT",
        access_reason: "SOLDE_INSUFFISANT",
        validity_start: args.dateEffet,
        validity_end: args.validityEnd,
      };
    }

    return {
      access_status: "AUTORISE",
      access_reason: "AUTORISATION_VALIDE",
      validity_start: args.dateEffet,
      validity_end: args.validityEnd,
    };
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
                "CANTINE_REGULARISATION_ABSENCE",
              ],
            },
          },
          orderBy: { created_at: "desc" },
          take: 20,
        },
        historiquesFormule: {
          include: {
            ancienneFormule: true,
            nouvelleFormule: true,
          },
          orderBy: { created_at: "desc" },
          take: 20,
        },
        consommations: {
          orderBy: { consommation_le: "desc" },
          take: 20,
        },
        absences: {
          orderBy: { date_repas: "desc" },
          take: 20,
        },
      },
    });
    if (!record) return null;
    const [enriched] = await this.attachFinanceMetadata([record]);
    return enriched;
  }

  private async resolveAccessCheckRecord(payload: CantineAccessCheckPayload, tenantId: string) {
    if (payload.abonnement_cantine_id) {
      return this.getScopedRecord(payload.abonnement_cantine_id, tenantId);
    }

    const lookup = payload.lookup ?? "";
    const identifiant = await this.prisma.identifiantEleve.findFirst({
      where: {
        valeur: lookup,
        eleve: {
          is: {
            etablissement_id: tenantId,
          },
        },
      },
      select: {
        eleve_id: true,
      },
    });

    const eleveId = identifiant?.eleve_id ?? null;
    const record = await this.prisma.abonnementCantine.findFirst({
      where: {
        eleve: {
          is: {
            etablissement_id: tenantId,
            OR: [
              ...(eleveId ? [{ id: eleveId }] : []),
              { code_eleve: lookup },
              {
                utilisateur: {
                  is: {
                    profil: {
                      is: {
                        OR: [
                          { prenom: { contains: lookup } },
                          { nom: { contains: lookup } },
                        ],
                      },
                    },
                  },
                },
              },
            ],
          },
        },
      },
      orderBy: [{ updated_at: "desc" }, { created_at: "desc" }],
      select: { id: true },
    });

    if (!record) return null;
    return this.getScopedRecord(record.id, tenantId);
  }

  private async checkAccess(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const payload = this.normalizeAccessCheckPayload(req.body);
      const record = await this.resolveAccessCheckRecord(payload, tenantId);
      if (!record) {
        throw new Error("Aucun dossier cantine correspondant n'a ete trouve.");
      }
      const recordFinanceStatus =
        typeof (record as Record<string, unknown>).finance_status === "string"
          ? String((record as Record<string, unknown>).finance_status)
          : null;

      const decision = this.deriveAccessDecision({
        statut: String(record.statut ?? "").toUpperCase(),
        financeStatus: recordFinanceStatus,
        dateEffet: record.date_effet ?? null,
        validityEnd: record.annee?.date_fin ?? null,
        formuleType: record.formule?.type_formule ?? null,
        soldePrepaye: Number(record.solde_prepaye ?? 0),
        soldeMinAlerte: Number(record.solde_min_alerte ?? 0),
        referenceDate: payload.reference_date ?? new Date(),
      });

      const audit = await this.prisma.journalAudit.create({
        data: {
          etablissement_id: tenantId,
          acteur_utilisateur_id: (req as Request & { user?: { sub?: string } }).user?.sub ?? null,
          action: "CANTINE_ACCESS_CHECK",
          type_entite: "ABONNEMENT_CANTINE",
          id_entite: record.id,
          avant_json: Prisma.JsonNull,
          apres_json: {
            abonnement_cantine_id: record.id,
            eleve_id: record.eleve_id,
            lookup: payload.lookup ?? null,
            finance_status: recordFinanceStatus,
            access_status: decision.access_status,
            access_reason: decision.access_reason,
            validity_start: decision.validity_start,
            validity_end: decision.validity_end,
            solde_prepaye: record.solde_prepaye ?? 0,
            solde_min_alerte: record.solde_min_alerte ?? 0,
            formule_type: record.formule?.type_formule ?? null,
          } as Prisma.InputJsonValue,
          date_action: payload.reference_date ?? new Date(),
        },
      });

      Response.success(res, "Decision d'acces cantine calculee.", {
        abonnement: {
          ...record,
          access_status: decision.access_status,
          access_reason: decision.access_reason,
          validity_start: decision.validity_start,
          validity_end: decision.validity_end,
        },
        trace_id: audit.id,
        checked_at: audit.date_action,
      });
    } catch (error) {
      Response.error(res, "Erreur lors du controle d'acces cantine", 400, error as Error);
      next(error);
    }
  }

  private ensureMutable(existing: NonNullable<AbonnementCantineScopedRecord>) {
    if (existing?.facture && (existing.facture.statut ?? "").toUpperCase() !== "ANNULEE") {
      throw new Error(
        `Cet abonnement cantine est deja facture par ${existing.facture.numero_facture}. Regularisez d'abord la facture liee.`,
      );
    }
  }

  private async getFormuleWithFinanceContext(formuleId: string, tenantId: string) {
    const formule = await this.prisma.formuleCantine.findFirst({
      where: { id: formuleId, etablissement_id: tenantId },
      include: {
        frais: {
          select: {
            id: true,
            montant: true,
            devise: true,
            nom: true,
          },
        },
      },
    });
    if (!formule) {
      throw new Error("La formule de cantine selectionnee n'appartient pas a cet etablissement.");
    }
    return formule;
  }

  private hasFormulaTariffImpact(
    currentFormule: Awaited<ReturnType<AbonnementCantineApp["getFormuleWithFinanceContext"]>>,
    nextFormule: Awaited<ReturnType<AbonnementCantineApp["getFormuleWithFinanceContext"]>>,
  ) {
    const currentCatalogueId = currentFormule.catalogue_frais_id ?? null;
    const nextCatalogueId = nextFormule.catalogue_frais_id ?? null;
    const currentAmount = Number(currentFormule.frais?.montant ?? 0);
    const nextAmount = Number(nextFormule.frais?.montant ?? 0);

    return currentCatalogueId !== nextCatalogueId || currentAmount !== nextAmount;
  }

  private getLatestPendingFormulaHistory(
    existing: NonNullable<AbonnementCantineScopedRecord>,
  ) {
    return (existing.historiquesFormule ?? []).find((history) => {
      if (!history.impact_tarifaire) return false;
      const details =
        history.details_json && typeof history.details_json === "object" && !Array.isArray(history.details_json)
          ? (history.details_json as Record<string, unknown>)
          : {};
      return details.notification_finance === true && !details.finance_processed_at;
    }) ?? null;
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

  private buildConsumptionResponse(existing: NonNullable<AbonnementCantineScopedRecord>) {
    const history = (existing.consommations ?? []).map((item) => ({
      id: item.id,
      type_repas: item.type_repas,
      note: item.note,
      consommation_le: item.consommation_le,
      statut_acces: item.statut_acces,
      motif_acces: item.motif_acces,
      finance_status_snapshot: item.finance_status_snapshot,
      transmission_finance: item.transmission_finance,
      finance_processed_at: item.finance_processed_at,
      details_json: item.details_json,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));

    return {
      abonnement: existing,
      consommations: history,
    };
  }

  private getAbsenceRegularizationPolicy(existing: NonNullable<AbonnementCantineScopedRecord>) {
    return {
      ouvre_droit_regularisation: existing.formule?.regulariser_absence_annulation ?? false,
      mode_regularisation_suggere:
        existing.formule?.regulariser_absence_annulation
          ? existing.formule?.mode_regularisation_absence ?? "AVOIR"
          : null,
    };
  }

  private getConsumptionTransmissionRequirement(existing: NonNullable<AbonnementCantineScopedRecord>) {
    return existing.formule?.transmettre_consommations_finance ?? true;
  }

  private getControlMaxMealsPerDay(existing: {
    formule?: {
      max_repas_par_jour?: number | null;
    } | null;
  }) {
    const raw = Number(existing.formule?.max_repas_par_jour ?? 1);
    if (!Number.isFinite(raw) || raw <= 0) return 1;
    return Math.max(1, Math.trunc(raw));
  }

  private resolveUserId(req: Request) {
    return (req as Request & { user?: { sub?: string } }).user?.sub ?? null;
  }

  private getRequestIp(req: Request) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) {
      return forwarded.split(",")[0].trim();
    }
    return req.ip ?? null;
  }

  private isCantineFinanceAuthorized(status?: string | null) {
    return ["REGLE", "ACTIF", "REGULARISE"].includes((status ?? "").toUpperCase());
  }

  private toStartOfDay(date: Date) {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }

  private toEndOfDay(date: Date) {
    const copy = new Date(date);
    copy.setHours(23, 59, 59, 999);
    return copy;
  }

  private toDateKey(value: Date | string | null | undefined) {
    if (!value) return "no-date";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "no-date";
    return date.toISOString().slice(0, 10);
  }

  private getOperationalQueryContext(req: Request): CantineOperationalQueryContext {
    const query = req.query as Record<string, unknown>;
    const referenceDate =
      typeof query.reference_date === "string" && query.reference_date.trim()
        ? new Date(query.reference_date.trim())
        : new Date();
    if (Number.isNaN(referenceDate.getTime())) {
      throw new Error("La date de reference de la liste cantine est invalide.");
    }

    const periodStartRaw =
      typeof query.period_start === "string" && query.period_start.trim()
        ? new Date(query.period_start.trim())
        : referenceDate;
    const periodEndRaw =
      typeof query.period_end === "string" && query.period_end.trim()
        ? new Date(query.period_end.trim())
        : referenceDate;

    if (Number.isNaN(periodStartRaw.getTime()) || Number.isNaN(periodEndRaw.getTime())) {
      throw new Error("La periode de la liste cantine est invalide.");
    }

    const periodStart = this.toStartOfDay(periodStartRaw);
    const periodEnd = this.toEndOfDay(periodEndRaw);
    if (periodStart.getTime() > periodEnd.getTime()) {
      throw new Error("La date de debut de la periode cantine doit preceder la date de fin.");
    }

    const search =
      typeof query.search === "string" && query.search.trim() ? query.search.trim() : null;
    const accessStatusRaw =
      typeof query.access_status === "string" && query.access_status.trim()
        ? query.access_status.trim().toUpperCase()
        : null;
    const accessStatusFilter = [
      "AUTORISE",
      "SUSPENDU",
      "EN_ATTENTE",
      "INSUFFISANT",
      "EXPIRE",
    ].includes(accessStatusRaw ?? "")
      ? (accessStatusRaw as CantineOperationalStatus)
      : null;

    return {
      referenceDate,
      periodStart,
      periodEnd,
      search,
      accessStatusFilter,
    };
  }

  private getControlQueryContext(req: Request): CantineControlAnomalyQueryContext {
    const query = req.query as Record<string, unknown>;
    const referenceDate =
      typeof query.reference_date === "string" && query.reference_date.trim()
        ? new Date(query.reference_date.trim())
        : new Date();
    if (Number.isNaN(referenceDate.getTime())) {
      throw new Error("La date de reference du controle cantine est invalide.");
    }

    const monthStart = new Date(referenceDate);
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const periodStart =
      typeof query.period_start === "string" && query.period_start.trim()
        ? new Date(query.period_start.trim())
        : monthStart;
    const periodEnd =
      typeof query.period_end === "string" && query.period_end.trim()
        ? new Date(query.period_end.trim())
        : referenceDate;

    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
      throw new Error("La fenetre de controle cantine est invalide.");
    }

    const normalizedPeriodStart = this.toStartOfDay(periodStart);
    const normalizedPeriodEnd = this.toEndOfDay(periodEnd);
    if (normalizedPeriodStart.getTime() > normalizedPeriodEnd.getTime()) {
      throw new Error("La date de debut de la fenetre cantine doit preceder la date de fin.");
    }

    const search =
      typeof query.search === "string" && query.search.trim() ? query.search.trim() : null;

    return {
      referenceDate,
      periodStart: normalizedPeriodStart,
      periodEnd: normalizedPeriodEnd,
      search,
    };
  }

  private async buildOperationalList(args: {
    tenantId: string;
    referenceDate: Date;
    periodStart: Date;
    periodEnd: Date;
    search: string | null;
    accessStatusFilter: CantineOperationalStatus | null;
  }) {
    const search = args.search?.trim() ?? null;
    const where: Prisma.AbonnementCantineWhereInput = {
      eleve: {
        is: {
          etablissement_id: args.tenantId,
        },
      },
      date_effet: {
        lte: args.periodEnd,
      },
      annee: {
        is: {
          date_fin: {
            gte: args.periodStart,
          },
        },
      },
    };

    if (search) {
      where.AND = [
        {
          OR: [
            { eleve: { is: { code_eleve: { contains: search } } } },
            {
              eleve: {
                is: {
                  utilisateur: {
                    is: {
                      profil: {
                        is: {
                          prenom: { contains: search },
                        },
                      },
                    },
                  },
                },
              },
            },
            {
              eleve: {
                is: {
                  utilisateur: {
                    is: {
                      profil: {
                        is: {
                          nom: { contains: search },
                        },
                      },
                    },
                  },
                },
              },
            },
            {
              formule: {
                is: {
                  nom: { contains: search },
                },
              },
            },
            {
              annee: {
                is: {
                  nom: { contains: search },
                },
              },
            },
          ],
        },
      ];
    }

    const subscriptions = await this.prisma.abonnementCantine.findMany({
      where,
      include: {
        eleve: { include: { utilisateur: { include: { profil: true } } } },
        annee: true,
        formule: true,
        facture: true,
        consommations: {
          where: {
            consommation_le: {
              gte: args.periodStart,
              lte: args.periodEnd,
            },
          },
          orderBy: { consommation_le: "desc" },
          take: 5,
        },
      },
      orderBy: [{ created_at: "desc" }],
    });

    const enrichedSubscriptions = await this.attachFinanceMetadata(subscriptions);
    const rows = enrichedSubscriptions
      .map((item) => {
        const decision = this.deriveAccessDecision({
          statut: String(item.statut ?? "").toUpperCase(),
          financeStatus:
            typeof (item as Record<string, unknown>).finance_status === "string"
              ? String((item as Record<string, unknown>).finance_status)
              : null,
          dateEffet: item.date_effet ?? null,
          validityEnd: item.annee?.date_fin ?? null,
          formuleType: item.formule?.type_formule ?? null,
          soldePrepaye: Number(item.solde_prepaye ?? 0),
          soldeMinAlerte: Number(item.solde_min_alerte ?? 0),
          referenceDate: args.referenceDate,
        });
        const operationalStatus = decision.access_status as CantineOperationalStatus;
        if (args.accessStatusFilter && operationalStatus !== args.accessStatusFilter) {
          return null;
        }
        return {
          ...item,
          operational_status: operationalStatus,
          evaluation_date: args.referenceDate,
        };
      })
      .filter(
        (
          item,
        ): item is (typeof enrichedSubscriptions)[number] & {
          operational_status: CantineOperationalStatus;
          evaluation_date: Date;
        } => Boolean(item),
      )
      .sort((left, right) => {
        const leftName = [
          left.eleve?.utilisateur?.profil?.prenom,
          left.eleve?.utilisateur?.profil?.nom,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const rightName = [
          right.eleve?.utilisateur?.profil?.prenom,
          right.eleve?.utilisateur?.profil?.nom,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return leftName.localeCompare(rightName);
      });

    const summary: CantineOperationalSummary = {
      autorises: rows.filter((item) => item.operational_status === "AUTORISE").length,
      suspendus: rows.filter((item) => item.operational_status === "SUSPENDU").length,
      en_attente: rows.filter((item) => item.operational_status === "EN_ATTENTE").length,
      insuffisants: rows.filter((item) => item.operational_status === "INSUFFISANT").length,
      expires: rows.filter((item) => item.operational_status === "EXPIRE").length,
    };

    return {
      rows,
      summary,
    };
  }

  private buildCantineControlAnomalyId(args: {
    code: CantineControlAnomalyCode;
    abonnementCantineId?: string | null;
    consommationCantineId?: string | null;
    eleveId?: string | null;
    anneeScolaireId?: string | null;
    scopeKey?: string | null;
  }) {
    return [
      args.code,
      args.abonnementCantineId ?? "none",
      args.consommationCantineId ?? "none",
      args.eleveId ?? "none",
      args.anneeScolaireId ?? "none",
      args.scopeKey ?? "none",
    ].join("::");
  }

  private mapControlAnomalyTrackingStatus(action?: string | null) {
    switch ((action ?? "").toUpperCase()) {
      case "CANTINE_FINANCE_ANOMALY_RESOLVED":
        return "RESOLUE" as const;
      case "CANTINE_FINANCE_ANOMALY_IGNORED":
        return "IGNOREE" as const;
      default:
        return "OUVERTE" as const;
    }
  }

  private async getLatestControlAnomalyActions(tenantId: string, anomalyIds: string[]) {
    if (anomalyIds.length === 0) return new Map<string, string>();
    const rows = await this.prisma.journalAudit.findMany({
      where: {
        etablissement_id: tenantId,
        type_entite: "CONTROLE_CANTINE_FINANCE",
        id_entite: { in: anomalyIds },
        action: {
          in: [
            "CANTINE_FINANCE_ANOMALY_OPENED",
            "CANTINE_FINANCE_ANOMALY_REOPENED",
            "CANTINE_FINANCE_ANOMALY_RESOLVED",
            "CANTINE_FINANCE_ANOMALY_IGNORED",
          ],
        },
      },
      orderBy: [{ date_action: "desc" }],
      select: {
        id_entite: true,
        action: true,
      },
    });
    const latest = new Map<string, string>();
    rows.forEach((row) => {
      if (!row.id_entite || latest.has(row.id_entite)) return;
      latest.set(row.id_entite, row.action);
    });
    return latest;
  }

  private async syncControlAnomalyAudit(args: {
    tenantId: string;
    actorId: string | null;
    ip: string | null;
    anomalies: Omit<CantineControlAnomalyRow, "tracking_status">[];
  }) {
    const latestActions = await this.getLatestControlAnomalyActions(
      args.tenantId,
      args.anomalies.map((item) => item.anomaly_id),
    );

    const entries = args.anomalies
      .map((item) => {
        const latestAction = latestActions.get(item.anomaly_id) ?? null;
        if (
          latestAction === "CANTINE_FINANCE_ANOMALY_OPENED" ||
          latestAction === "CANTINE_FINANCE_ANOMALY_REOPENED"
        ) {
          return null;
        }
        const action =
          latestAction === "CANTINE_FINANCE_ANOMALY_RESOLVED" ||
          latestAction === "CANTINE_FINANCE_ANOMALY_IGNORED"
            ? "CANTINE_FINANCE_ANOMALY_REOPENED"
            : "CANTINE_FINANCE_ANOMALY_OPENED";

        return {
          etablissement_id: args.tenantId,
          acteur_utilisateur_id: args.actorId,
          action,
          type_entite: "CONTROLE_CANTINE_FINANCE",
          id_entite: item.anomaly_id,
          avant_json: null,
          apres_json: item as Prisma.InputJsonValue,
          ip: args.ip,
        };
      })
      .filter(Boolean);

    if (entries.length > 0) {
      await this.prisma.journalAudit.createMany({
        data: entries as never,
      });
      entries.forEach((entry) => {
        const anomalyId = (entry as { id_entite?: string | null }).id_entite;
        const action = (entry as { action?: string | null }).action;
        if (anomalyId && action) {
          latestActions.set(anomalyId, action);
        }
      });
    }

    return latestActions;
  }

  private async getCantineNotificationRecipientIds(tenantId: string, eleveId: string, actorId: string | null) {
    const cantinePermissionCodes = [
      "TC.CANTINE.MENUACTION",
      "TC.CANTINE.MENUACTION.LIST",
      "TC.CANTINE.MENUACTION.PARAMETRE",
      "TC.CANTINE.MENUACTION.DASHBOARD",
      "TC.CANTINE.MENUACTION.ADD",
    ];

    const [parentLinks, cantineAssignments] = await Promise.all([
      this.prisma.eleveParentTuteur.findMany({
        where: {
          eleve_id: eleveId,
          parent_tuteur: {
            etablissement_id: tenantId,
          },
        },
        select: {
          parent_tuteur: {
            select: {
              utilisateur_id: true,
            },
          },
        },
      }),
      this.prisma.utilisateurRole.findMany({
        where: {
          utilisateur: {
            etablissement_id: tenantId,
          },
          role: {
            permissions: {
              some: {
                permission: {
                  code: {
                    in: cantinePermissionCodes,
                  },
                },
              },
            },
          },
        },
        select: {
          utilisateur_id: true,
        },
      }),
    ]);

    return Array.from(
      new Set(
        [
          ...parentLinks
            .map((item) => item.parent_tuteur?.utilisateur_id)
            .filter((value): value is string => Boolean(value)),
          ...cantineAssignments
            .map((item) => item.utilisateur_id)
            .filter((value): value is string => Boolean(value)),
          ...(actorId ? [actorId] : []),
        ],
      ),
    );
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

  private async getPendingFinanceRegularization(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const records = await this.prisma.abonnementCantine.findMany({
        where: {
          eleve: { is: { etablissement_id: tenantId } },
          historiquesFormule: {
            some: {
              impact_tarifaire: true,
            },
          },
        },
        include: {
          eleve: { include: { utilisateur: { include: { profil: true } } } },
          annee: true,
          formule: true,
          facture: true,
          historiquesFormule: {
            include: {
              ancienneFormule: true,
              nouvelleFormule: true,
            },
            orderBy: { created_at: "desc" },
            take: 10,
          },
        },
        orderBy: { updated_at: "desc" },
      });
      const enriched = await this.attachFinanceMetadata(records);
      const data = enriched.filter((item) => {
        const history =
          ((item as Record<string, unknown>).historiquesFormule as Array<{
            impact_tarifaire?: boolean;
            details_json?: Record<string, unknown> | null;
          }> | undefined)?.find((entry) => {
            const details =
              entry.details_json && typeof entry.details_json === "object" && !Array.isArray(entry.details_json)
                ? entry.details_json
                : null;
            return entry.impact_tarifaire === true && details?.notification_finance === true && !details?.finance_processed_at;
          }) ?? null;
        return Boolean(history);
      });
      Response.success(res, "Abonnements cantine en attente de regularisation Finance.", data);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des regularisations cantine", 400, error as Error);
      next(error);
    }
  }

  private async getPendingFinanceConsumptionControl(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const records = await this.prisma.consommationCantine.findMany({
        where: {
          abonnement: {
            is: {
              eleve: {
                is: {
                  etablissement_id: tenantId,
                },
              },
            },
          },
          transmission_finance: true,
          finance_processed_at: null,
        },
        include: {
          abonnement: {
            include: {
              eleve: { include: { utilisateur: { include: { profil: true } } } },
              annee: true,
              formule: true,
              facture: true,
            },
          },
        },
        orderBy: [{ consommation_le: "desc" }, { created_at: "desc" }],
      });

      const abonnementIds = records.map((item) => item.abonnement_cantine_id);
      const abonnements = abonnementIds.length
        ? await this.prisma.abonnementCantine.findMany({
            where: { id: { in: abonnementIds } },
            include: {
              eleve: { include: { utilisateur: { include: { profil: true } } } },
              annee: true,
              formule: true,
              facture: true,
            },
          })
        : [];
      const enrichedAbonnements = await this.attachFinanceMetadata(abonnements);
      const abonnementById = new Map(enrichedAbonnements.map((item) => [item.id, item]));

      const data = records.map((item) => ({
        ...item,
        abonnement: abonnementById.get(item.abonnement_cantine_id) ?? item.abonnement,
      }));

      Response.success(res, "Consommations cantine en attente de controle Finance.", data);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des consommations cantine a controler", 400, error as Error);
      next(error);
    }
  }

  private async getPendingFinanceAbsenceRegularization(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const records = await this.prisma.absenceCantine.findMany({
        where: {
          abonnement: {
            is: {
              eleve: {
                is: {
                  etablissement_id: tenantId,
                },
              },
            },
          },
          transmission_finance: true,
          finance_processed_at: null,
        },
        include: {
          abonnement: {
            include: {
              eleve: { include: { utilisateur: { include: { profil: true } } } },
              annee: true,
              formule: true,
              facture: true,
            },
          },
        },
        orderBy: [{ date_repas: "desc" }, { created_at: "desc" }],
      });

      const abonnementIds = records.map((item) => item.abonnement_cantine_id);
      const abonnements = abonnementIds.length
        ? await this.prisma.abonnementCantine.findMany({
            where: { id: { in: abonnementIds } },
            include: {
              eleve: { include: { utilisateur: { include: { profil: true } } } },
              annee: true,
              formule: true,
              facture: true,
            },
          })
        : [];
      const enrichedAbonnements = await this.attachFinanceMetadata(abonnements);
      const abonnementById = new Map(enrichedAbonnements.map((item) => [item.id, item]));

      const data = records.map((item) => ({
        ...item,
        abonnement: abonnementById.get(item.abonnement_cantine_id) ?? item.abonnement,
      }));

      Response.success(res, "Absences et annulations cantine en attente de regularisation Finance.", data);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation des absences cantine a regulariser",
        400,
        error as Error,
      );
      next(error);
    }
  }

  private async getPendingFinanceSuspension(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const records = await this.prisma.abonnementCantine.findMany({
        where: {
          eleve: { is: { etablissement_id: tenantId } },
          statut: {
            notIn: ["SUSPENDU", "RESILIE", "ANNULE", "INACTIF"],
          },
        },
        include: {
          eleve: { include: { utilisateur: { include: { profil: true } } } },
          annee: true,
          formule: true,
          facture: true,
        },
        orderBy: { updated_at: "desc" },
      });
      const enriched = await this.attachFinanceMetadata(records);
      const data = enriched.filter(
        (item) =>
          ["EN_ATTENTE_REGLEMENT", "AUTORISATION_REFUSEE", "IMPAYE", "IMPAYE_SIGNALE"].includes(
            String((item as Record<string, unknown>).finance_status ?? "").toUpperCase(),
          ),
      );
      Response.success(res, "Abonnements cantine en attente de suspension Finance.", data);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des suspensions cantine Finance", 400, error as Error);
      next(error);
    }
  }

  private async getOperationalList(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const query = this.getOperationalQueryContext(req);
      const data = await this.buildOperationalList({
        tenantId,
        ...query,
      });
      Response.success(res, "Liste operationnelle cantine.", data);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation de la liste operationnelle cantine", 400, error as Error);
      next(error);
    }
  }

  private async getControlAnomalies(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const actorId = this.resolveUserId(req);
      const ip = this.getRequestIp(req);
      const query = this.getControlQueryContext(req);

      const searchFilter = query.search
        ? {
            OR: [
              { eleve: { is: { code_eleve: { contains: query.search } } } },
              {
                eleve: {
                  is: {
                    utilisateur: {
                      is: {
                        profil: {
                          is: {
                            prenom: { contains: query.search },
                          },
                        },
                      },
                    },
                  },
                },
              },
              {
                eleve: {
                  is: {
                    utilisateur: {
                      is: {
                        profil: {
                          is: {
                            nom: { contains: query.search },
                          },
                        },
                      },
                    },
                  },
                },
              },
              { formule: { is: { nom: { contains: query.search } } } },
              { annee: { is: { nom: { contains: query.search } } } },
            ],
          }
        : {};

      const subscriptions = await this.prisma.abonnementCantine.findMany({
        where: {
          eleve: { is: { etablissement_id: tenantId } },
          ...searchFilter,
        },
        include: {
          eleve: { include: { utilisateur: { include: { profil: true } } } },
          annee: true,
          formule: true,
          facture: true,
        },
        orderBy: [{ updated_at: "desc" }, { created_at: "desc" }],
      });
      const enrichedSubscriptions = await this.attachFinanceMetadata(subscriptions);
      const subscriptionById = new Map(enrichedSubscriptions.map((item) => [item.id, item]));

      const consumptionRecords = await this.prisma.consommationCantine.findMany({
        where: {
          abonnement: {
            is: {
              eleve: {
                is: {
                  etablissement_id: tenantId,
                },
              },
            },
          },
          consommation_le: {
            gte: query.periodStart,
            lte: query.periodEnd,
          },
          ...(query.search
            ? {
                OR: [
                  { abonnement: { is: { eleve: { is: { code_eleve: { contains: query.search } } } } } },
                  {
                    abonnement: {
                      is: {
                        eleve: {
                          is: {
                            utilisateur: {
                              is: {
                                profil: {
                                  is: {
                                    prenom: { contains: query.search },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                  {
                    abonnement: {
                      is: {
                        eleve: {
                          is: {
                            utilisateur: {
                              is: {
                                profil: {
                                  is: {
                                    nom: { contains: query.search },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                  { abonnement: { is: { formule: { is: { nom: { contains: query.search } } } } } },
                ],
              }
            : {}),
        },
        include: {
          abonnement: {
            include: {
              eleve: { include: { utilisateur: { include: { profil: true } } } },
              annee: true,
              formule: true,
              facture: true,
            },
          },
        },
        orderBy: [{ consommation_le: "desc" }, { created_at: "desc" }],
      });

      const missingSubscriptionIds = Array.from(
        new Set(
          consumptionRecords
            .map((item) => item.abonnement_cantine_id)
            .filter((id) => !subscriptionById.has(id)),
        ),
      );
      if (missingSubscriptionIds.length > 0) {
        const missingSubscriptions = await this.prisma.abonnementCantine.findMany({
          where: { id: { in: missingSubscriptionIds } },
          include: {
            eleve: { include: { utilisateur: { include: { profil: true } } } },
            annee: true,
            formule: true,
            facture: true,
          },
        });
        const enrichedMissing = await this.attachFinanceMetadata(missingSubscriptions);
        enrichedMissing.forEach((item) => {
          subscriptionById.set(item.id, item);
        });
      }

      const consumptionCountBySubscription = new Map<string, number>();
      const dailyConsumptionCount = new Map<string, number>();

      consumptionRecords.forEach((item) => {
        consumptionCountBySubscription.set(
          item.abonnement_cantine_id,
          (consumptionCountBySubscription.get(item.abonnement_cantine_id) ?? 0) + 1,
        );
        const dayKey = this.toDateKey(item.consommation_le);
        const aggregateKey = `${item.abonnement_cantine_id}::${dayKey}`;
        dailyConsumptionCount.set(aggregateKey, (dailyConsumptionCount.get(aggregateKey) ?? 0) + 1);
      });

      const anomalies: Omit<CantineControlAnomalyRow, "tracking_status">[] = [];

      consumptionRecords.forEach((item) => {
        const subscription = subscriptionById.get(item.abonnement_cantine_id) ?? item.abonnement ?? null;
        const eleveLabel =
          [
            subscription?.eleve?.utilisateur?.profil?.prenom,
            subscription?.eleve?.utilisateur?.profil?.nom,
          ]
            .filter(Boolean)
            .join(" ")
            .trim() || subscription?.eleve?.code_eleve || "Eleve";
        const financeAuthorizedAtService = this.isCantineFinanceAuthorized(item.finance_status_snapshot);
        const accessAuthorizedAtService = (item.statut_acces ?? "").toUpperCase() === "AUTORISE";

        if (!financeAuthorizedAtService || !accessAuthorizedAtService) {
          anomalies.push({
            anomaly_id: this.buildCantineControlAnomalyId({
              code: "REPAS_SANS_AUTORISATION_ACTIVE",
              abonnementCantineId: item.abonnement_cantine_id,
              consommationCantineId: item.id,
              eleveId: subscription?.eleve_id ?? null,
              anneeScolaireId: subscription?.annee_scolaire_id ?? null,
              scopeKey: this.toDateKey(item.consommation_le),
            }),
            code: "REPAS_SANS_AUTORISATION_ACTIVE",
            gravite: "HIGH",
            abonnement_cantine_id: item.abonnement_cantine_id,
            consommation_cantine_id: item.id,
            eleve_id: subscription?.eleve_id ?? null,
            eleve_label: eleveLabel,
            code_eleve: subscription?.eleve?.code_eleve ?? null,
            annee_scolaire_id: subscription?.annee_scolaire_id ?? null,
            annee_label: subscription?.annee?.nom ?? null,
            formule_cantine_id: subscription?.formule_cantine_id ?? null,
            formule_label: subscription?.formule?.nom ?? null,
            formule_type: subscription?.formule?.type_formule ?? null,
            finance_status: item.finance_status_snapshot ?? null,
            service_status: subscription?.statut ?? null,
            access_status: item.statut_acces ?? null,
            motif:
              "Un repas servi a ete trace alors que l'autorisation d'acces ou le feu vert financier n'etait pas actif.",
            evaluation_date: query.referenceDate,
            period_start: query.periodStart,
            period_end: query.periodEnd,
            consommation_le: item.consommation_le,
            consommation_count: 1,
            allowed_count: 1,
          });
        }
      });

      dailyConsumptionCount.forEach((count, aggregateKey) => {
        const [subscriptionId, dateKey] = aggregateKey.split("::");
        const subscription = subscriptionById.get(subscriptionId);
        if (!subscription) return;
        const allowedCount = Math.max(1, Number(subscription.formule?.max_repas_par_jour ?? 1));
        if (count <= allowedCount) return;
        const eleveLabel =
          [
            subscription.eleve?.utilisateur?.profil?.prenom,
            subscription.eleve?.utilisateur?.profil?.nom,
          ]
            .filter(Boolean)
            .join(" ")
            .trim() || subscription.eleve?.code_eleve || "Eleve";

        anomalies.push({
          anomaly_id: this.buildCantineControlAnomalyId({
            code: "CONSOMMATION_SUPERIEURE_AUX_DROITS",
            abonnementCantineId: subscription.id,
            eleveId: subscription.eleve_id,
            anneeScolaireId: subscription.annee_scolaire_id,
            scopeKey: dateKey,
          }),
          code: "CONSOMMATION_SUPERIEURE_AUX_DROITS",
          gravite: "MEDIUM",
          abonnement_cantine_id: subscription.id,
          consommation_cantine_id: null,
          eleve_id: subscription.eleve_id,
          eleve_label: eleveLabel,
          code_eleve: subscription.eleve?.code_eleve ?? null,
          annee_scolaire_id: subscription.annee_scolaire_id,
          annee_label: subscription.annee?.nom ?? null,
          formule_cantine_id: subscription.formule_cantine_id,
          formule_label: subscription.formule?.nom ?? null,
          formule_type: subscription.formule?.type_formule ?? null,
          finance_status:
            (subscription as typeof subscription & { finance_status?: string | null }).finance_status ?? null,
          service_status: subscription.statut ?? null,
          access_status:
            (subscription as typeof subscription & { access_status?: string | null }).access_status ?? null,
          motif:
            "Le nombre de repas traces sur une journee depasse le plafond autorise par la formule cantine.",
          evaluation_date: query.referenceDate,
          period_start: query.periodStart,
          period_end: query.periodEnd,
          consommation_le: new Date(`${dateKey}T00:00:00.000Z`),
          consommation_count: count,
          allowed_count: allowedCount,
        });
      });

      enrichedSubscriptions.forEach((item) => {
        const currentFinanceStatus =
          (item as typeof item & { finance_status?: string | null }).finance_status ?? null;
        const currentAccessStatus =
          (item as typeof item & { access_status?: string | null }).access_status ?? null;
        const serviceStart = item.date_effet ? this.toStartOfDay(new Date(item.date_effet)) : null;
        const serviceEnd = item.annee?.date_fin ? this.toEndOfDay(new Date(item.annee.date_fin)) : null;
        const overlapsWindow =
          (!serviceStart || serviceStart.getTime() <= query.periodEnd.getTime()) &&
          (!serviceEnd || serviceEnd.getTime() >= query.periodStart.getTime());

        if (!overlapsWindow) return;
        if (!this.isCantineFinanceAuthorized(currentFinanceStatus)) return;
        if ((currentAccessStatus ?? "").toUpperCase() !== "AUTORISE") return;
        if ((consumptionCountBySubscription.get(item.id) ?? 0) > 0) return;

        const eleveLabel =
          [
            item.eleve?.utilisateur?.profil?.prenom,
            item.eleve?.utilisateur?.profil?.nom,
          ]
            .filter(Boolean)
            .join(" ")
            .trim() || item.eleve?.code_eleve || "Eleve";

        anomalies.push({
          anomaly_id: this.buildCantineControlAnomalyId({
            code: "PAYE_SANS_CONSOMMATION",
            abonnementCantineId: item.id,
            eleveId: item.eleve_id,
            anneeScolaireId: item.annee_scolaire_id,
            scopeKey: `${this.toDateKey(query.periodStart)}::${this.toDateKey(query.periodEnd)}`,
          }),
          code: "PAYE_SANS_CONSOMMATION",
          gravite: "MEDIUM",
          abonnement_cantine_id: item.id,
          consommation_cantine_id: null,
          eleve_id: item.eleve_id,
          eleve_label: eleveLabel,
          code_eleve: item.eleve?.code_eleve ?? null,
          annee_scolaire_id: item.annee_scolaire_id,
          annee_label: item.annee?.nom ?? null,
          formule_cantine_id: item.formule_cantine_id,
          formule_label: item.formule?.nom ?? null,
          formule_type: item.formule?.type_formule ?? null,
          finance_status: currentFinanceStatus,
          service_status: item.statut ?? null,
          access_status: currentAccessStatus,
          motif:
            "Le service cantine est finance et autorise sur la fenetre retenue, mais aucune consommation n'a ete tracee.",
          evaluation_date: query.referenceDate,
          period_start: query.periodStart,
          period_end: query.periodEnd,
          consommation_le: null,
          consommation_count: 0,
          allowed_count: this.getControlMaxMealsPerDay(item),
        });
      });

      const anomalyPriority: Record<CantineControlAnomalyCode, number> = {
        REPAS_SANS_AUTORISATION_ACTIVE: 0,
        PAYE_SANS_CONSOMMATION: 1,
        CONSOMMATION_SUPERIEURE_AUX_DROITS: 2,
      };
      anomalies.sort((left, right) => {
        const priority = anomalyPriority[left.code] - anomalyPriority[right.code];
        if (priority !== 0) return priority;
        return left.eleve_label.localeCompare(right.eleve_label);
      });

      const latestActions = await this.syncControlAnomalyAudit({
        tenantId,
        actorId,
        ip,
        anomalies,
      });

      const rows: CantineControlAnomalyRow[] = anomalies.map((item) => ({
        ...item,
        tracking_status: this.mapControlAnomalyTrackingStatus(latestActions.get(item.anomaly_id) ?? null),
      }));

      const summary: CantineControlAnomalySummary = {
        total: anomalies.length,
        repas_sans_autorisation_active: anomalies.filter(
          (item) => item.code === "REPAS_SANS_AUTORISATION_ACTIVE",
        ).length,
        payes_sans_consommation: anomalies.filter((item) => item.code === "PAYE_SANS_CONSOMMATION")
          .length,
        consommations_superieures_aux_droits: anomalies.filter(
          (item) => item.code === "CONSOMMATION_SUPERIEURE_AUX_DROITS",
        ).length,
      };

      await this.prisma.journalAudit.create({
        data: {
          etablissement_id: tenantId,
          acteur_utilisateur_id: actorId,
          action: "CANTINE_FINANCE_ANOMALIES_REFRESHED",
          type_entite: "CONTROLE_CANTINE_FINANCE",
          id_entite: tenantId,
          avant_json: null,
          apres_json: {
            filters: {
              reference_date: query.referenceDate.toISOString(),
              period_start: query.periodStart.toISOString(),
              period_end: query.periodEnd.toISOString(),
              search: query.search ?? null,
            },
            summary,
          } as Prisma.InputJsonValue,
          ip,
        } as never,
      });

      Response.success(res, "Anomalies de rapprochement cantine/Finance.", {
        rows,
        summary,
      });
    } catch (error) {
      Response.error(res, "Erreur lors du rapprochement cantine et Finance", 400, error as Error);
      next(error);
    }
  }

  private async markControlAnomaly(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const actorId = this.resolveUserId(req);
      const ip = this.getRequestIp(req);
      const anomalyId =
        typeof req.body?.anomaly_id === "string" && req.body.anomaly_id.trim()
          ? req.body.anomaly_id.trim()
          : "";
      const decision =
        typeof req.body?.decision === "string" ? req.body.decision.trim().toUpperCase() : "";
      const note =
        typeof req.body?.note === "string" && req.body.note.trim() ? req.body.note.trim() : null;

      if (!anomalyId) {
        throw new Error("L'identifiant de l'anomalie cantine est obligatoire.");
      }
      if (!["RESOLVED", "IGNORED"].includes(decision)) {
        throw new Error("La decision d'anomalie cantine est invalide.");
      }

      await this.prisma.journalAudit.create({
        data: {
          etablissement_id: tenantId,
          acteur_utilisateur_id: actorId,
          action:
            decision === "RESOLVED"
              ? "CANTINE_FINANCE_ANOMALY_RESOLVED"
              : "CANTINE_FINANCE_ANOMALY_IGNORED",
          type_entite: "CONTROLE_CANTINE_FINANCE",
          id_entite: anomalyId,
          avant_json: null,
          apres_json: {
            anomaly_id: anomalyId,
            decision,
            note,
          } as Prisma.InputJsonValue,
          ip,
        } as never,
      });

      Response.success(
        res,
        decision === "RESOLVED" ? "Anomalie cantine marquee comme resolue." : "Anomalie cantine ignoree.",
        { anomaly_id: anomalyId, decision },
      );
    } catch (error) {
      Response.error(res, "Erreur lors de la mise a jour de l'anomalie cantine", 400, error as Error);
      next(error);
    }
  }

  private async signalFinanceSuspension(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const actorId = (req as Request & { user?: { sub?: string } }).user?.sub ?? null;
      const payload = this.normalizeFinanceSuspensionPayload(req.body);
      const existing = await this.getScopedRecord(req.params.id, tenantId);
      if (!existing) throw new Error("Abonnement cantine introuvable.");

      const currentFinanceStatus =
        typeof (existing as Record<string, unknown>).finance_status === "string"
          ? String((existing as Record<string, unknown>).finance_status).toUpperCase()
          : null;
      const blockingFinanceStatus =
        payload.finance_status === "EN_ATTENTE_REGLEMENT"
          ? "IMPAYE_SIGNALE"
          : payload.finance_status ??
            (currentFinanceStatus === "EN_ATTENTE_REGLEMENT" ? "IMPAYE_SIGNALE" : currentFinanceStatus);
      const blockingReason = ["EN_ATTENTE_REGLEMENT", "AUTORISATION_REFUSEE", "IMPAYE", "IMPAYE_SIGNALE"].includes(
        (blockingFinanceStatus ?? "").toUpperCase(),
      );

      if (!blockingReason) {
        throw new Error("La suspension cantine ne peut etre signee que sur un statut financier bloquant.");
      }

      if ((existing.statut ?? "").toUpperCase() === "SUSPENDU") {
        throw new Error("Cet abonnement cantine est deja suspendu.");
      }

      const recipientIds = await this.getCantineNotificationRecipientIds(tenantId, existing.eleve_id, actorId);

      const result = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.abonnementCantine.update({
          where: { id: existing.id },
          data: { statut: "SUSPENDU" },
          include: {
            eleve: { include: { utilisateur: { include: { profil: true } } } },
            annee: true,
            formule: true,
            facture: true,
          },
        });

        await tx.journalAudit.create({
          data: {
            etablissement_id: tenantId,
            acteur_utilisateur_id: actorId,
            action: "CANTINE_SUSPENSION_FINANCIERE",
            type_entite: "ABONNEMENT_CANTINE",
            id_entite: existing.id,
            avant_json: {
              statut: existing.statut ?? null,
              finance_status: currentFinanceStatus,
            } as Prisma.InputJsonValue,
            apres_json: {
              statut: "SUSPENDU",
              finance_status: blockingFinanceStatus,
              source: payload.source,
              motif: payload.motif,
            } as Prisma.InputJsonValue,
            date_action: new Date(),
          },
        });

        await tx.operationFinanciere.create({
          data: {
            etablissement_id: tenantId,
            abonnement_cantine_id: existing.id,
            facture_id: existing.facture_id ?? null,
            cree_par_utilisateur_id: actorId,
            type: "SUSPENSION_CANTINE",
            montant: 0,
            motif: payload.motif ?? "Suspension cantine suite a un signal Finance",
            details_json: {
              source: payload.source,
              finance_status: blockingFinanceStatus,
            } as Prisma.InputJsonValue,
          },
        });

        if (recipientIds.length > 0) {
          await tx.notification.createMany({
            data: recipientIds.map((utilisateur_id) => ({
              utilisateur_id,
              type: "CANTINE_SUSPENSION_FINANCIERE",
              payload_json: {
                abonnement_cantine_id: existing.id,
                eleve_id: existing.eleve_id,
                formule_cantine_id: existing.formule_cantine_id,
                finance_status: blockingFinanceStatus,
                motif: payload.motif,
                source: payload.source,
              } as Prisma.InputJsonValue,
            })),
          });
        }

        return updated;
      });

      Response.success(res, "Suspension cantine transmise par Finance.", result);
    } catch (error) {
      Response.error(res, "Erreur lors du signal de suspension cantine Finance", 400, error as Error);
      next(error);
    }
  }

  private async reportAbsence(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const actorId = (req as Request & { user?: { sub?: string } }).user?.sub ?? null;
      const payload = this.normalizeAbsencePayload(req.body);
      const existing = await this.getScopedRecord(req.params.id, tenantId);
      if (!existing) throw new Error("Abonnement cantine introuvable.");

      const policy = this.getAbsenceRegularizationPolicy(existing);

      const result = await this.prisma.$transaction(async (tx) => {
        const absence = await tx.absenceCantine.create({
          data: {
            abonnement_cantine_id: existing.id,
            type_evenement: payload.type_evenement,
            date_repas: payload.date_repas,
            etat_metier: policy.ouvre_droit_regularisation
              ? "EN_ATTENTE_REGULARISATION_FINANCE"
              : "SIGNALEE",
            note: payload.note,
            statut_acces_snapshot:
              typeof (existing as Record<string, unknown>).access_status === "string"
                ? String((existing as Record<string, unknown>).access_status)
                : null,
            finance_status_snapshot:
              typeof (existing as Record<string, unknown>).finance_status === "string"
                ? String((existing as Record<string, unknown>).finance_status)
                : null,
            ouvre_droit_regularisation: policy.ouvre_droit_regularisation,
            mode_regularisation_suggere: policy.mode_regularisation_suggere,
            transmission_finance: policy.ouvre_droit_regularisation,
            details_json: {
              source: "CANTINE_MODULE",
              statut_service_snapshot: existing.statut ?? null,
              formule_cantine_id: existing.formule_cantine_id,
              formule_nom: existing.formule?.nom ?? null,
            } as Prisma.InputJsonValue,
          },
        });

        await tx.journalAudit.create({
          data: {
            etablissement_id: tenantId,
            acteur_utilisateur_id: actorId,
            action: "CANTINE_ABSENCE_RECORDED",
            type_entite: "ABSENCE_CANTINE",
            id_entite: absence.id,
            apres_json: {
              abonnement_cantine_id: existing.id,
              type_evenement: payload.type_evenement,
              date_repas: payload.date_repas,
              note: payload.note,
              ouvre_droit_regularisation: policy.ouvre_droit_regularisation,
              mode_regularisation_suggere: policy.mode_regularisation_suggere,
              transmission_finance: policy.ouvre_droit_regularisation,
            } as Prisma.InputJsonValue,
            date_action: payload.date_repas,
          },
        });

        return absence;
      });

      const refreshed = await this.getScopedRecord(existing.id, tenantId);
      Response.success(
        res,
        policy.ouvre_droit_regularisation
          ? "Absence ou annulation cantine enregistree et transmise a Finance pour regularisation."
          : "Absence ou annulation cantine enregistree.",
        {
          abonnement: refreshed,
          absence: result,
        },
      );
    } catch (error) {
      Response.error(res, "Erreur lors de l'enregistrement de l'absence cantine", 400, error as Error);
      next(error);
    }
  }

  private async processFinanceAbsenceRegularization(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const actorId = (req as Request & { user?: { sub?: string } }).user?.sub ?? null;
      const payload = this.normalizeAbsenceFinancePayload(req.body);
      const existing = await this.prisma.absenceCantine.findFirst({
        where: {
          id: req.params.absenceId,
          abonnement: {
            is: {
              eleve: {
                is: {
                  etablissement_id: tenantId,
                },
              },
            },
          },
        },
        include: {
          abonnement: {
            include: {
              eleve: { include: { utilisateur: { include: { profil: true } } } },
              annee: true,
              formule: true,
              facture: true,
            },
          },
        },
      });
      if (!existing) throw new Error("Absence cantine introuvable.");
      if (!existing.transmission_finance) {
        throw new Error("Cette absence cantine n'est pas soumise a une regularisation Finance.");
      }
      if (existing.finance_processed_at) {
        throw new Error("Cette absence cantine a deja ete traitee par Finance.");
      }

      const result = await this.prisma.$transaction(async (tx) => {
        if (!existing.abonnement?.formule_cantine_id) {
          throw new Error("La formule de cantine liee a cette absence est introuvable.");
        }
        const formule = await this.getFormuleWithFinanceContext(
          existing.abonnement.formule_cantine_id,
          tenantId,
        ).catch(() => null);
        const regularizationAmount = Number(formule?.frais?.montant ?? 0);
        let creditResult:
          | Awaited<ReturnType<typeof regularizeServiceSubscriptionFacture>>
          | null = null;

        if (
          payload.decision_finance !== "REFUS_REGULARISATION" &&
          existing.abonnement?.facture_id &&
          formule?.catalogue_frais_id &&
          regularizationAmount > 0
        ) {
          creditResult = await regularizeServiceSubscriptionFacture(tx, {
            tenantId,
            factureId: existing.abonnement.facture_id,
            eleveId: existing.abonnement.eleve_id,
            anneeScolaireId: existing.abonnement.annee_scolaire_id,
            catalogueFraisId: formule.catalogue_frais_id,
            libellePrefix: "Cantine -",
            serviceLabel: formule.nom ? `cantine ${formule.nom}` : "cantine",
            createdByUtilisateurId: actorId,
            motif: `Regularisation Finance apres ${existing.type_evenement.toLowerCase()} de repas cantine`,
            montantOverride: regularizationAmount,
          });

          if (creditResult.avoir) {
            await tx.operationFinanciere.create({
              data: {
                etablissement_id: tenantId,
                facture_id: existing.abonnement.facture_id,
                cree_par_utilisateur_id: actorId,
                type: "AVOIR_FACTURE",
                montant: creditResult.montant_regularise,
                motif: `Avoir ${payload.decision_finance.toLowerCase()} suite a ${existing.type_evenement.toLowerCase()} cantine`,
                details_json: {
                  facture_avoir_id: creditResult.avoir.id,
                  numero_avoir: creditResult.avoir.numero_facture,
                  montant_applique: creditResult.montant_applique,
                  montant_non_affecte: Math.max(
                    0,
                    creditResult.montant_regularise - creditResult.montant_applique,
                  ),
                  decision_finance: payload.decision_finance,
                  absence_cantine_id: existing.id,
                } as Prisma.InputJsonValue,
              },
            });
          }
        }

        const updated = await tx.absenceCantine.update({
          where: { id: existing.id },
          data: {
            finance_processed_at: new Date(),
            decision_finance: payload.decision_finance,
            etat_metier:
              payload.decision_finance === "REFUS_REGULARISATION"
                ? "CLOTUREE_SANS_REGULARISATION"
                : "REGULARISATION_TRAITEE",
            details_json: {
              ...(existing.details_json &&
              typeof existing.details_json === "object" &&
              !Array.isArray(existing.details_json)
                ? (existing.details_json as Record<string, unknown>)
                : {}),
              finance_reviewed_by: actorId,
              finance_reviewed_at: new Date().toISOString(),
              finance_note: payload.note,
              etat_metier:
                payload.decision_finance === "REFUS_REGULARISATION"
                  ? "CLOTUREE_SANS_REGULARISATION"
                  : "REGULARISATION_TRAITEE",
              montant_regularisation: creditResult?.montant_regularise ?? 0,
              montant_applique: creditResult?.montant_applique ?? 0,
              facture_avoir_id: creditResult?.avoir?.id ?? null,
              numero_avoir: creditResult?.avoir?.numero_facture ?? null,
            } as Prisma.InputJsonValue,
          },
        });

        await tx.operationFinanciere.create({
          data: {
            etablissement_id: tenantId,
            abonnement_cantine_id: existing.abonnement_cantine_id,
            facture_id: existing.abonnement?.facture_id ?? null,
            cree_par_utilisateur_id: actorId,
            type: "CANTINE_REGULARISATION_ABSENCE",
            montant: creditResult?.montant_regularise ?? 0,
            motif: `Regularisation Finance apres ${existing.type_evenement.toLowerCase()} de repas cantine`,
            details_json: {
              absence_cantine_id: existing.id,
              decision_finance: payload.decision_finance,
              type_evenement: existing.type_evenement,
              date_repas: existing.date_repas,
              mode_regularisation_suggere: existing.mode_regularisation_suggere,
              etat_metier:
                payload.decision_finance === "REFUS_REGULARISATION"
                  ? "CLOTUREE_SANS_REGULARISATION"
                  : "REGULARISATION_TRAITEE",
              facture_avoir_id: creditResult?.avoir?.id ?? null,
              numero_avoir: creditResult?.avoir?.numero_facture ?? null,
              montant_regularisation: creditResult?.montant_regularise ?? 0,
              montant_applique: creditResult?.montant_applique ?? 0,
              note: payload.note,
            } as Prisma.InputJsonValue,
          },
        });

        await tx.journalAudit.create({
          data: {
            etablissement_id: tenantId,
            acteur_utilisateur_id: actorId,
            action: "CANTINE_ABSENCE_FINANCE_PROCESSED",
            type_entite: "ABSENCE_CANTINE",
            id_entite: updated.id,
            avant_json: existing.details_json ?? Prisma.JsonNull,
            apres_json: updated.details_json ?? Prisma.JsonNull,
            date_action: new Date(),
          },
        });

        return updated;
      });

      Response.success(res, "Regularisation Finance de l'absence cantine enregistree.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la regularisation Finance de l'absence cantine", 400, error as Error);
      next(error);
    }
  }

  private async processFinanceConsumptionControl(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const actorId = (req as Request & { user?: { sub?: string } }).user?.sub ?? null;
      const existing = await this.prisma.consommationCantine.findFirst({
        where: {
          id: req.params.consommationId,
          abonnement: {
            is: {
              eleve: {
                is: {
                  etablissement_id: tenantId,
                },
              },
            },
          },
        },
        include: {
          abonnement: {
            include: {
              eleve: { include: { utilisateur: { include: { profil: true } } } },
              annee: true,
              formule: true,
              facture: true,
            },
          },
        },
      });
      if (!existing) throw new Error("Consommation cantine introuvable.");
      if (!existing.transmission_finance) {
        throw new Error("Cette consommation cantine n'est pas soumise a un controle Finance.");
      }
      if (existing.finance_processed_at) {
        throw new Error("Cette consommation cantine a deja ete controlee par Finance.");
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.consommationCantine.update({
          where: { id: existing.id },
          data: {
            finance_processed_at: new Date(),
            details_json: {
              ...(existing.details_json && typeof existing.details_json === "object" && !Array.isArray(existing.details_json)
                ? (existing.details_json as Record<string, unknown>)
                : {}),
              finance_reviewed_by: actorId,
              finance_reviewed_at: new Date().toISOString(),
            } as Prisma.InputJsonValue,
          },
        });

        await tx.journalAudit.create({
          data: {
            etablissement_id: tenantId,
            acteur_utilisateur_id: actorId,
            action: "CANTINE_CONSUMPTION_FINANCE_PROCESSED",
            type_entite: "CONSOMMATION_CANTINE",
            id_entite: updated.id,
            avant_json: existing.details_json ?? Prisma.JsonNull,
            apres_json: updated.details_json ?? Prisma.JsonNull,
            date_action: new Date(),
          },
        });

        return updated;
      });

      Response.success(res, "Consommation cantine marquee comme controlee par Finance.", result);
    } catch (error) {
      Response.error(res, "Erreur lors du controle Finance de la consommation cantine", 400, error as Error);
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

  private async changeFormula(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = await this.resolveTenantIdForWrite(req);
      const existing = await this.getScopedRecord(req.params.id, tenantId);
      if (!existing) throw new Error("Abonnement cantine introuvable.");

      const payload = this.normalizeChangeFormulaPayload(req.body);
      if (payload.formule_cantine_id === existing.formule_cantine_id) {
        throw new Error("La nouvelle formule doit etre differente de la formule en cours.");
      }

      const [currentFormule, nextFormule] = await Promise.all([
        this.getFormuleWithFinanceContext(existing.formule_cantine_id, tenantId),
        this.getFormuleWithFinanceContext(payload.formule_cantine_id, tenantId),
      ]);

      const impactTarifaire = this.hasFormulaTariffImpact(currentFormule, nextFormule);
      const factureActive = Boolean(existing.facture_id && (existing.facture?.statut ?? "").toUpperCase() !== "ANNULEE");
      const nextStatus =
        impactTarifaire && factureActive
          ? "EN_ATTENTE_REGLEMENT"
          : existing.statut ?? "EN_ATTENTE_VALIDATION_FINANCIERE";

      await this.prisma.$transaction(async (tx) => {
        await tx.abonnementCantine.update({
          where: { id: existing.id },
          data: {
            formule_cantine_id: nextFormule.id,
            statut: nextStatus,
          },
        });

        await tx.$executeRaw(
          Prisma.sql`UPDATE abonnements_cantine SET date_effet = ${payload.date_effet} WHERE id = ${existing.id}`,
        );

        await tx.historiqueFormuleCantine.create({
          data: {
            abonnement_cantine_id: existing.id,
            ancienne_formule_cantine_id: currentFormule.id,
            nouvelle_formule_cantine_id: nextFormule.id,
            date_effet: payload.date_effet,
            impact_tarifaire: impactTarifaire,
            ancien_statut: existing.statut ?? null,
            nouveau_statut: nextStatus,
            details_json: {
              ancienne_formule_nom: currentFormule.nom,
              nouvelle_formule_nom: nextFormule.nom,
              ancienne_formule_type: currentFormule.type_formule,
              nouvelle_formule_type: nextFormule.type_formule,
              ancien_catalogue_frais_id: currentFormule.catalogue_frais_id ?? null,
              nouveau_catalogue_frais_id: nextFormule.catalogue_frais_id ?? null,
              ancien_montant: currentFormule.frais?.montant ?? null,
              nouveau_montant: nextFormule.frais?.montant ?? null,
              notification_finance: impactTarifaire && factureActive,
              finance_processed_at: null,
              facture_active_avant_changement: factureActive,
            },
          },
        });

        if (impactTarifaire && factureActive) {
          await tx.operationFinanciere.create({
            data: {
              etablissement_id: tenantId,
              abonnement_cantine_id: existing.id,
              facture_id: existing.facture_id ?? null,
              cree_par_utilisateur_id: (req as Request & { user?: { sub?: string } }).user?.sub ?? null,
              type: "CANTINE_CHANGEMENT_FORMULE",
              montant: Number(nextFormule.frais?.montant ?? 0) - Number(currentFormule.frais?.montant ?? 0),
              motif: "Changement de formule cantine avec regularisation Finance",
              details_json: {
                ancienne_formule_id: currentFormule.id,
                nouvelle_formule_id: nextFormule.id,
                date_effet: payload.date_effet,
              },
            },
          });
        }
      });

      const result = await this.getScopedRecord(existing.id, tenantId);
      Response.success(
        res,
        impactTarifaire && factureActive
          ? "Formule cantine modifiee. Regularisation transmise a Finance."
          : "Formule cantine mise a jour.",
        result,
      );
    } catch (error) {
      Response.error(res, "Erreur lors du changement de formule cantine", 400, error as Error);
      next(error);
    }
  }

  private async processFinanceRegularization(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedRecord(req.params.id, tenantId);
      if (!existing) throw new Error("Abonnement cantine introuvable.");

      const pendingHistory = this.getLatestPendingFormulaHistory(existing);
      if (!pendingHistory) {
        throw new Error("Aucune regularisation Finance de formule cantine n'est en attente.");
      }

      if (!existing.facture_id) {
        throw new Error("Aucune facture active n'est rattachee a cet abonnement cantine.");
      }

      const oldFormule = await this.getFormuleWithFinanceContext(
        pendingHistory.ancienne_formule_cantine_id,
        tenantId,
      );
      const newFormule = await this.getFormuleWithFinanceContext(
        pendingHistory.nouvelle_formule_cantine_id,
        tenantId,
      );

      if (!newFormule.catalogue_frais_id) {
        throw new Error("La nouvelle formule de cantine n'est reliee a aucun frais catalogue.");
      }
      const nextCatalogueFraisId = newFormule.catalogue_frais_id;

      const result = await this.prisma.$transaction(async (tx) => {
        const regularization = await regularizeServiceSubscriptionFacture(tx, {
          tenantId,
          factureId: existing.facture_id as string,
          eleveId: existing.eleve_id,
          anneeScolaireId: existing.annee_scolaire_id,
          catalogueFraisId: oldFormule.catalogue_frais_id ?? null,
          libellePrefix: "Cantine -",
          serviceLabel: oldFormule.nom ? `cantine ${oldFormule.nom}` : "cantine",
          createdByUtilisateurId: (req as Request & { user?: { sub?: string } }).user?.sub ?? null,
          motif: "Regularisation apres changement de formule cantine",
        });

        const billing = await createServiceSubscriptionFacture(tx, {
          tenantId,
          eleveId: existing.eleve_id,
          anneeScolaireId: existing.annee_scolaire_id,
          catalogueFraisId: nextCatalogueFraisId,
          allowedScopes: ["GENERAL", "CANTINE"],
          libelle: `Cantine - ${newFormule.nom ?? "service"}`,
          modePaiement: "COMPTANT",
          nombreTranches: 1,
          jourPaiementMensuel: null,
          createdByUtilisateurId: (req as Request & { user?: { sub?: string } }).user?.sub ?? null,
          dateEcheance: pendingHistory.date_effet ?? ((existing as Record<string, unknown>).date_effet as Date | null | undefined) ?? null,
        });

        await tx.abonnementCantine.update({
          where: { id: existing.id },
          data: {
            facture_id: billing.facture.id,
            statut: (billing.facture.statut ?? "").toUpperCase() === "PAYEE" ? "ACTIF" : "EN_ATTENTE_REGLEMENT",
          },
        });

        const historyDetails =
          pendingHistory.details_json && typeof pendingHistory.details_json === "object" && !Array.isArray(pendingHistory.details_json)
            ? (pendingHistory.details_json as Record<string, unknown>)
            : {};

        await tx.historiqueFormuleCantine.update({
          where: { id: pendingHistory.id },
          data: {
            nouveau_statut: (billing.facture.statut ?? "").toUpperCase() === "PAYEE" ? "ACTIF" : "EN_ATTENTE_REGLEMENT",
            details_json: {
              ...historyDetails,
              finance_processed_at: new Date().toISOString(),
              regularization_facture_id: existing.facture_id,
              regularization_avoir_id: regularization.avoir?.id ?? null,
              nouvelle_facture_id: billing.facture.id,
              regularization_amount: regularization.montant_regularise,
              new_billing_amount: billing.facture.total_montant,
            },
          },
        });

        await tx.operationFinanciere.create({
          data: {
            etablissement_id: tenantId,
            abonnement_cantine_id: existing.id,
            facture_id: billing.facture.id,
            cree_par_utilisateur_id: (req as Request & { user?: { sub?: string } }).user?.sub ?? null,
            type: "CANTINE_REGULARISATION_FORMULE",
            montant: billing.facture.total_montant,
            motif: "Regularisation Finance apres changement de formule cantine",
            details_json: {
              ancienne_formule_id: oldFormule.id,
              nouvelle_formule_id: newFormule.id,
              ancienne_facture_id: existing.facture_id,
              nouvelle_facture_id: billing.facture.id,
              avoir_id: regularization.avoir?.id ?? null,
            },
          },
        });

        return tx.abonnementCantine.findFirst({
          where: { id: existing.id },
          include: {
            eleve: { include: { utilisateur: { include: { profil: true } } } },
            annee: true,
            formule: true,
            facture: true,
            historiquesFormule: {
              include: {
                ancienneFormule: true,
                nouvelleFormule: true,
              },
              orderBy: { created_at: "desc" },
              take: 20,
            },
          },
        });
      });

      Response.success(res, "Regularisation cantine generee par Finance.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la regularisation de formule cantine", 400, error as Error);
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
      const tenantId = this.resolveTenantId(req);
      const payload = this.normalizeConsumptionPayload(req.body);
      const existing = await this.getScopedRecord(req.params.id, tenantId);
      if (!existing) throw new Error("Abonnement cantine introuvable.");

      const financeStatus =
        typeof (existing as Record<string, unknown>).finance_status === "string"
          ? String((existing as Record<string, unknown>).finance_status)
          : null;
      const decision = this.deriveAccessDecision({
        statut: String(existing.statut ?? "").toUpperCase(),
        financeStatus,
        dateEffet: existing.date_effet ?? null,
        validityEnd: existing.annee?.date_fin ?? null,
        formuleType: existing.formule?.type_formule ?? null,
        soldePrepaye: Number(existing.solde_prepaye ?? 0),
        soldeMinAlerte: Number(existing.solde_min_alerte ?? 0),
        referenceDate: payload.consommation_le,
      });

      if (decision.access_status !== "AUTORISE") {
        throw new Error("Ce repas ne peut pas etre enregistre car l'acces cantine n'est pas autorise.");
      }

      const actorId = (req as Request & { user?: { sub?: string } }).user?.sub ?? null;
      const transmissionFinance = this.getConsumptionTransmissionRequirement(existing);

      const transactionResult = await this.prisma.$transaction(async (tx) => {
        const consommation = await tx.consommationCantine.create({
          data: {
            abonnement_cantine_id: existing.id,
            type_repas: payload.type_repas,
            note: payload.note,
            consommation_le: payload.consommation_le,
            statut_acces: decision.access_status,
            motif_acces: decision.access_reason,
            finance_status_snapshot: financeStatus,
            transmission_finance: transmissionFinance,
            details_json: {
              formule_cantine_id: existing.formule_cantine_id,
              formule_nom: existing.formule?.nom ?? null,
              formule_type: existing.formule?.type_formule ?? null,
              eleve_id: existing.eleve_id,
              annee_scolaire_id: existing.annee_scolaire_id,
              access_validity_start: decision.validity_start?.toISOString?.() ?? null,
              access_validity_end: decision.validity_end?.toISOString?.() ?? null,
            } as Prisma.InputJsonValue,
          },
        });

        const audit = await tx.journalAudit.create({
          data: {
            etablissement_id: tenantId,
            acteur_utilisateur_id: actorId,
            action: "CANTINE_MEAL_RECORDED",
            type_entite: "CONSOMMATION_CANTINE",
            id_entite: consommation.id,
            avant_json: Prisma.JsonNull,
            apres_json: {
              abonnement_cantine_id: existing.id,
              eleve_id: existing.eleve_id,
              type_repas: payload.type_repas,
              note: payload.note,
              consommation_le: payload.consommation_le,
              statut_acces: decision.access_status,
              motif_acces: decision.access_reason,
              finance_status: financeStatus,
              transmission_finance: transmissionFinance,
            } as Prisma.InputJsonValue,
            date_action: payload.consommation_le,
          },
        });

        return { consommation, audit };
      });

      const refreshed = await this.getScopedRecord(existing.id, tenantId);
      Response.success(res, "Repas cantine enregistre.", {
        abonnement: refreshed,
        consommation: transactionResult.consommation,
        trace_id: transactionResult.audit.id,
      });
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
      const requestedFormuleId =
        typeof req.body?.formule_cantine_id === "string" ? req.body.formule_cantine_id.trim() : null;
      if (requestedFormuleId && requestedFormuleId !== existing.formule_cantine_id) {
        throw new Error("Utilise l'action dediee de changement de formule cantine.");
      }
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
