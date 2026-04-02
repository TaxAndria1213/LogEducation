import { Application, NextFunction, Request, Response as R, Router } from "express";
import { randomUUID } from "crypto";
import { Prisma, PrismaClient, type AbonnementTransport } from "@prisma/client";
import Response from "../../../common/app/response";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import AbonnementTransportModel from "../models/abonnement_transport.model";
import {
  createServiceSubscriptionFacture,
  regularizeServiceSubscriptionFacture,
} from "../../finance_shared/utils/service_subscription_finance";
import { roundMoney, toMoney } from "../../finance_shared/utils/echeance_paiement";

type AbonnementTransportPayload = {
  eleve_id: string;
  annee_scolaire_id: string;
  ligne_transport_id: string;
  arret_transport_id: string | null;
  zone_transport: string | null;
  statut: string;
  date_debut_service: Date | null;
  date_fin_service: Date | null;
  prorata_ratio: number | null;
};

type LigneTransportSettings = {
  zones: string[];
  zone_tarifs: Record<string, number>;
  inscriptions_ouvertes: boolean;
  prorata_mode: "MONTH" | "SCHOOL_YEAR";
  access_rules: {
    bloquer_si_a_facturer: boolean;
    bloquer_si_en_attente_reglement: boolean;
    bloquer_si_suspension_financiere: boolean;
    autoriser_avant_date_debut: boolean;
    validation_humaine_suspension_financiere: boolean;
  };
};

type ChangeTransportLinePayload = {
  ligne_transport_id: string;
  arret_transport_id: string | null;
  zone_transport: string;
  date_effet: Date;
};

type UpdateTransportPeriodPayload = {
  date_debut_service: Date | null;
  date_fin_service: Date | null;
};

type AffectationStatusRule = {
  code: string;
  nextStatus: string;
};

type AffectationHistoryDetails = {
  actor_id?: string | null;
  old_line_label?: string | null;
  new_line_label?: string | null;
  notification_finance?: boolean;
  reason?: string | null;
  previous_facture_id?: string | null;
  old_catalogue_frais_id?: string | null;
  new_catalogue_frais_id?: string | null;
  prorata_ratio?: number | null;
  old_prorata_ratio?: number | null;
  new_prorata_ratio?: number | null;
  old_effective_amount?: number | null;
  new_effective_amount?: number | null;
  finance_processed_at?: string | null;
  finance_regularisation?: {
    montant_avoir?: number;
    montant_nouvelle_facture?: number;
    ancienne_facture_id?: string | null;
    nouvelle_facture_id?: string | null;
    avoir_id?: string | null;
  } | null;
};

type TransportAffectationHistoryRow = {
  id: string;
  abonnement_transport_id: string;
  ancienne_ligne_transport_id: string;
  ancien_arret_transport_id: string | null;
  ancienne_zone_transport: string | null;
  nouvelle_ligne_transport_id: string;
  nouvel_arret_transport_id: string | null;
  nouvelle_zone_transport: string | null;
  date_effet: Date;
  impact_tarifaire: boolean | number;
  ancien_statut: string | null;
  nouveau_statut: string | null;
  details_json: Prisma.JsonValue | null;
  created_at: Date;
  updated_at: Date;
};

type AbonnementTransportScopedRecord = Awaited<ReturnType<AbonnementTransportApp["getScopedRecord"]>>;
type EnrichedTransportSubscription = NonNullable<AbonnementTransportScopedRecord>;
type TransportOperationalRow = EnrichedTransportSubscription & {
  operational_status: "ACTIF" | "SUSPENDU" | "EN_ATTENTE" | "RADIE";
  access_for_date: "AUTORISE" | "SUSPENDU" | "EN_ATTENTE" | "EXPIRE";
  finance_authorized: boolean;
  evaluation_date: Date;
  latest_usage_at: Date | null;
  usage_count_in_window: number;
  used_in_window: boolean;
};
type TransportOperationalSummary = {
  actifs: number;
  suspendus: number;
  en_attente: number;
  radies: number;
  transportes_non_finances: number;
  finances_non_transportables: number;
};
type TransportControlAnomalyRow = {
  anomaly_id: string;
  code:
    | "TRANSPORTE_SANS_DROIT_FINANCIER"
    | "PAYE_SANS_AFFECTATION_TRANSPORT"
    | "SUSPENDU_AVEC_USAGE_REEL";
  gravite: "HIGH" | "MEDIUM";
  abonnement_transport_id: string | null;
  eleve_id: string | null;
  eleve_label: string;
  code_eleve: string | null;
  annee_scolaire_id: string | null;
  annee_label: string | null;
  ligne_transport_id: string | null;
  ligne_label: string | null;
  arret_label: string | null;
  zone_transport: string | null;
  finance_status: string | null;
  service_status: string | null;
  operational_status: string | null;
  facture_id: string | null;
  facture_numero: string | null;
  motif: string;
  evaluation_date: Date | null;
  tracking_status: "OUVERTE" | "RESOLUE" | "IGNOREE";
};
type TransportControlAnomalySummary = {
  total: number;
  transportes_sans_droit_financier: number;
  payes_sans_affectation_transport: number;
  suspendus_encore_planifies: number;
};
type OperationalQueryContext = {
  referenceDate: Date;
  periodStart: Date | null;
  periodEnd: Date | null;
  ligneTransportId: string | null;
  operationalStatusFilter: string | null;
  search: string | null;
};

class AbonnementTransportApp {
  public app: Application;
  public router: Router;
  private abonnementTransport: AbonnementTransportModel;
  private prisma: PrismaClient;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.abonnementTransport = new AbonnementTransportModel();
    this.prisma = new PrismaClient();
    this.routes();
  }

  public routes(): Router {
    this.router.post("/", this.create.bind(this));
    this.router.get("/", this.getAll.bind(this));
    this.router.get("/operational-list", this.getOperationalList.bind(this));
    this.router.get("/control-anomalies", this.getControlAnomalies.bind(this));
    this.router.post("/control-anomalies/mark", this.markControlAnomaly.bind(this));
    this.router.get("/pending-finance-billing", this.getPendingFinanceBilling.bind(this));
    this.router.get("/:id", this.getOne.bind(this));
    this.router.post("/:id/approve-request", this.approveRequest.bind(this));
    this.router.post("/:id/finance-suspension-signal", this.signalFinanceSuspension.bind(this));
    this.router.post("/:id/approve-finance-suspension", this.approveFinanceSuspension.bind(this));
    this.router.post("/:id/reject-finance-suspension", this.rejectFinanceSuspension.bind(this));
    this.router.post("/:id/link-finance-facture", this.linkFinanceFacture.bind(this));
    this.router.post("/:id/process-finance-billing", this.processFinanceBilling.bind(this));
    this.router.post(
      "/:id/process-finance-regularization",
      this.processFinanceRegularization.bind(this),
    );
    this.router.post("/:id/update-period", this.updatePeriod.bind(this));
    this.router.post("/:id/change-line", this.changeLine.bind(this));
    this.router.post("/:id/record-usage", this.recordUsage.bind(this));
    this.router.delete("/:id", this.delete.bind(this));
    this.router.put("/:id", this.update.bind(this));
    return this.router;
  }

  private getAffectationStatusRule(
    currentStatus: string | null | undefined,
    impactTarifaire: boolean,
  ): AffectationStatusRule {
    const normalized = (currentStatus ?? "").toUpperCase();

    if (!impactTarifaire) {
      if (
        [
          "EN_ATTENTE_VALIDATION_INTERNE",
          "EN_ATTENTE_VALIDATION_FINANCIERE",
          "EN_ATTENTE_REGLEMENT",
          "EN_ATTENTE_SUSPENSION_FINANCIERE",
          "ACTIF",
          "SUSPENDU",
          "SUSPENDU_FINANCE",
          "INACTIF",
          "ANNULE",
          "RESILIE",
        ].includes(normalized)
      ) {
        return {
          code: `KEEP_${normalized}`,
          nextStatus: normalized,
        };
      }

      return {
        code: "KEEP_DEFAULT_ACTIF",
        nextStatus: "ACTIF",
      };
    }

    if (normalized === "EN_ATTENTE_VALIDATION_INTERNE") {
      return {
        code: "IMPACT_KEEP_INTERNAL_VALIDATION",
        nextStatus: "EN_ATTENTE_VALIDATION_INTERNE",
      };
    }

    if (["SUSPENDU", "INACTIF", "ANNULE", "RESILIE"].includes(normalized)) {
      return {
        code: `IMPACT_KEEP_OPERATIONAL_${normalized}`,
        nextStatus: normalized,
      };
    }

    return {
      code: "IMPACT_REQUIRE_FINANCE_VALIDATION",
      nextStatus: "EN_ATTENTE_VALIDATION_FINANCIERE",
    };
  }

  private async resolveTenantIdForWrite(req: Request): Promise<string> {
    try {
      return this.resolveTenantId(req);
    } catch (error) {
      const eleveId =
        typeof req.body?.eleve_id === "string" ? req.body.eleve_id.trim() : "";
      const ligneId =
        typeof req.body?.ligne_transport_id === "string"
          ? req.body.ligne_transport_id.trim()
          : "";

      if (eleveId) {
        const eleve = await this.prisma.eleve.findUnique({
          where: { id: eleveId },
          select: { etablissement_id: true },
        });
        if (eleve?.etablissement_id) return eleve.etablissement_id;
      }

      if (ligneId) {
        const ligne = await this.prisma.ligneTransport.findUnique({
          where: { id: ligneId },
          select: { etablissement_id: true },
        });
        if (ligne?.etablissement_id) return ligne.etablissement_id;
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

    if (candidates.length === 0) {
      throw new Error("Aucun etablissement actif n'a ete fourni.");
    }

    if (new Set(candidates).size > 1) {
      throw new Error("Conflit d'etablissement detecte pour l'abonnement transport.");
    }

    return candidates[0];
  }

  private normalizePayload(raw: Partial<AbonnementTransport>): AbonnementTransportPayload {
    const eleve_id = typeof raw.eleve_id === "string" ? raw.eleve_id.trim() : "";
    const annee_scolaire_id =
      typeof raw.annee_scolaire_id === "string" ? raw.annee_scolaire_id.trim() : "";
    const ligne_transport_id =
      typeof raw.ligne_transport_id === "string" ? raw.ligne_transport_id.trim() : "";
    const arret_transport_id =
      typeof raw.arret_transport_id === "string" && raw.arret_transport_id.trim()
        ? raw.arret_transport_id.trim()
        : null;
    const zone_transport =
      typeof (raw as Record<string, unknown>).zone_transport === "string" &&
      String((raw as Record<string, unknown>).zone_transport).trim()
        ? String((raw as Record<string, unknown>).zone_transport).trim()
        : null;
    const requestedStatus =
      typeof raw.statut === "string" && raw.statut.trim()
        ? raw.statut.trim().toUpperCase()
        : "EN_ATTENTE_VALIDATION_INTERNE";
    const dateDebutRaw =
      typeof (raw as Record<string, unknown>).date_debut_service === "string" &&
      String((raw as Record<string, unknown>).date_debut_service).trim()
        ? String((raw as Record<string, unknown>).date_debut_service).trim()
        : null;
    const dateFinRaw =
      typeof (raw as Record<string, unknown>).date_fin_service === "string" &&
      String((raw as Record<string, unknown>).date_fin_service).trim()
        ? String((raw as Record<string, unknown>).date_fin_service).trim()
        : null;
    const date_debut_service = dateDebutRaw ? new Date(dateDebutRaw) : null;
    const date_fin_service = dateFinRaw ? new Date(dateFinRaw) : null;
    const statut = [
      "EN_ATTENTE_VALIDATION_INTERNE",
      "EN_ATTENTE_VALIDATION_FINANCIERE",
      "EN_ATTENTE_REGLEMENT",
      "EN_ATTENTE_SUSPENSION_FINANCIERE",
      "ACTIF",
      "SUSPENDU",
      "SUSPENDU_FINANCE",
      "INACTIF",
      "ANNULE",
      "RESILIE",
    ].includes(requestedStatus)
      ? requestedStatus
      : "EN_ATTENTE_VALIDATION_FINANCIERE";

    if (!eleve_id || !annee_scolaire_id || !ligne_transport_id) {
      throw new Error("L'eleve, l'annee scolaire et la ligne de transport sont requis.");
    }

    if (date_debut_service && Number.isNaN(date_debut_service.getTime())) {
      throw new Error("La date de debut du transport est invalide.");
    }
    if (date_fin_service && Number.isNaN(date_fin_service.getTime())) {
      throw new Error("La date de fin du transport est invalide.");
    }
    if (date_debut_service && date_fin_service && date_fin_service < date_debut_service) {
      throw new Error("La date de fin du transport doit etre posterieure a la date de debut.");
    }

    return {
      eleve_id,
      annee_scolaire_id,
      ligne_transport_id,
      arret_transport_id,
      zone_transport,
      statut,
      date_debut_service,
      date_fin_service,
      prorata_ratio: null,
    };
  }

  private normalizeChangeLinePayload(raw: Record<string, unknown>): ChangeTransportLinePayload {
    const ligne_transport_id =
      typeof raw.ligne_transport_id === "string" && raw.ligne_transport_id.trim()
        ? raw.ligne_transport_id.trim()
        : "";
    const arret_transport_id =
      typeof raw.arret_transport_id === "string" && raw.arret_transport_id.trim()
        ? raw.arret_transport_id.trim()
        : null;
    const zone_transport =
      typeof raw.zone_transport === "string" && raw.zone_transport.trim()
        ? raw.zone_transport.trim()
        : "";
    const dateEffetRaw =
      typeof raw.date_effet === "string" && raw.date_effet.trim()
        ? raw.date_effet.trim()
        : "";
    const date_effet = new Date(dateEffetRaw || new Date().toISOString());
    if (!ligne_transport_id) {
      throw new Error("La nouvelle ligne de transport est obligatoire.");
    }
    if (!zone_transport) {
      throw new Error("La nouvelle zone de transport est obligatoire.");
    }
    if (Number.isNaN(date_effet.getTime())) {
      throw new Error("La date d'effet du changement de circuit est invalide.");
    }

    return {
      ligne_transport_id,
      arret_transport_id,
      zone_transport,
      date_effet,
    };
  }

  private normalizeUpdatePeriodPayload(raw: Record<string, unknown>): UpdateTransportPeriodPayload {
    const dateDebutRaw =
      typeof raw.date_debut_service === "string" && raw.date_debut_service.trim()
        ? raw.date_debut_service.trim()
        : "";
    const dateFinRaw =
      typeof raw.date_fin_service === "string" && raw.date_fin_service.trim()
        ? raw.date_fin_service.trim()
        : "";

    const date_debut_service = dateDebutRaw ? new Date(dateDebutRaw) : null;
    const date_fin_service = dateFinRaw ? new Date(dateFinRaw) : null;

    if (date_debut_service && Number.isNaN(date_debut_service.getTime())) {
      throw new Error("La date de debut du service transport est invalide.");
    }
    if (date_fin_service && Number.isNaN(date_fin_service.getTime())) {
      throw new Error("La date de fin du service transport est invalide.");
    }
    if (date_debut_service && date_fin_service && date_fin_service < date_debut_service) {
      throw new Error("La date de fin du service transport doit etre posterieure a la date de debut.");
    }

    return {
      date_debut_service,
      date_fin_service,
    };
  }

  private normalizeProrataMode(value: unknown): "MONTH" | "SCHOOL_YEAR" {
    return value === "SCHOOL_YEAR" || value === "ANNEE_SCOLAIRE" ? "SCHOOL_YEAR" : "MONTH";
  }

  private daysInMonth(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  }

  private diffDaysInclusive(start: Date, end: Date) {
    const diff = end.getTime() - start.getTime();
    if (diff < 0) return 0;
    return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
  }

  private toDateKey(value?: Date | string | null) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
  }

  private computeProrataRatio(
    startDate: Date | null,
    endDate: Date | null,
    options?: {
      mode?: "MONTH" | "SCHOOL_YEAR";
      periodStart?: Date | null;
      periodEnd?: Date | null;
    },
  ) {
    if (!startDate && !endDate) return null;
    const mode = this.normalizeProrataMode(options?.mode);
    if (mode === "SCHOOL_YEAR" && options?.periodStart && options?.periodEnd) {
      const periodStart = options.periodStart;
      const periodEnd = options.periodEnd;
      const effectiveStart = startDate && startDate > periodStart ? startDate : periodStart;
      const effectiveEnd = endDate && endDate < periodEnd ? endDate : periodEnd;
      const totalDays = this.diffDaysInclusive(periodStart, periodEnd);
      const activeDays = this.diffDaysInclusive(effectiveStart, effectiveEnd);
      if (totalDays <= 0 || effectiveEnd < effectiveStart) return 0;
      return Number((activeDays / totalDays).toFixed(4));
    }
    const anchor = startDate ?? endDate ?? new Date();
    const monthStart = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), this.daysInMonth(anchor)));
    const effectiveStart = startDate && startDate > monthStart ? startDate : monthStart;
    const effectiveEnd = endDate && endDate < monthEnd ? endDate : monthEnd;
    const activeDays = this.diffDaysInclusive(effectiveStart, effectiveEnd);
    return Number((activeDays / this.daysInMonth(anchor)).toFixed(4));
  }

  private computeProrataRatioForLine(args: {
    startDate: Date | null;
    endDate: Date | null;
    lineSettings?: LigneTransportSettings | null;
    schoolYearStart?: Date | null;
    schoolYearEnd?: Date | null;
  }) {
    return this.computeProrataRatio(args.startDate, args.endDate, {
      mode: args.lineSettings?.prorata_mode ?? "MONTH",
      periodStart: args.schoolYearStart ?? null,
      periodEnd: args.schoolYearEnd ?? null,
    });
  }

  private buildScopedWhere(existingWhere: Record<string, unknown>, tenantId: string) {
    const scope = { eleve: { is: { etablissement_id: tenantId } } };
    if (!existingWhere || Object.keys(existingWhere).length === 0) return scope;
    return { AND: [existingWhere, scope] };
  }

  private normalizeDateInput(value: unknown): Date | null {
    if (typeof value !== "string" || !value.trim()) return null;
    const date = new Date(value.trim());
    if (Number.isNaN(date.getTime())) return null;
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  private getOperationalQueryContext(req: Request): OperationalQueryContext {
    const today = new Date();
    return {
      referenceDate:
        this.normalizeDateInput(req.query.reference_date) ??
        new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())),
      periodStart: this.normalizeDateInput(req.query.period_start),
      periodEnd: this.normalizeDateInput(req.query.period_end),
      ligneTransportId:
        typeof req.query.ligne_transport_id === "string" && req.query.ligne_transport_id.trim()
          ? req.query.ligne_transport_id.trim()
          : null,
      operationalStatusFilter:
        typeof req.query.operational_status === "string" && req.query.operational_status.trim()
          ? req.query.operational_status.trim().toUpperCase()
          : null,
      search:
        typeof req.query.search === "string" && req.query.search.trim()
          ? req.query.search.trim()
          : null,
    };
  }

  private getUsageWindowBounds(args: {
    referenceDate: Date;
    periodStart: Date | null;
    periodEnd: Date | null;
  }) {
    if (args.periodStart || args.periodEnd) {
      const rawStart = args.periodStart ?? args.periodEnd ?? args.referenceDate;
      const rawEnd = args.periodEnd ?? args.periodStart ?? args.referenceDate;
      return {
        start: rawStart <= rawEnd ? rawStart : rawEnd,
        end: rawEnd >= rawStart ? rawEnd : rawStart,
      };
    }
    return {
      start: args.referenceDate,
      end: args.referenceDate,
    };
  }

  private getEligibilityAccessForDate(
    record: {
      statut?: string | null;
      finance_status?: string | null;
      date_debut_service?: Date | null;
      date_fin_service?: Date | null;
      line_settings?: LigneTransportSettings | null;
    },
    referenceDate: Date,
  ) {
    const statut = (record.statut ?? "").toUpperCase();
    const financeStatus = (record.finance_status ?? "").toUpperCase();
    const rules = record.line_settings?.access_rules ?? {
      bloquer_si_a_facturer: true,
      bloquer_si_en_attente_reglement: true,
      bloquer_si_suspension_financiere: true,
      autoriser_avant_date_debut: false,
      validation_humaine_suspension_financiere: false,
    };
    const startDate = record.date_debut_service ? new Date(record.date_debut_service) : null;
    const endDate = record.date_fin_service ? new Date(record.date_fin_service) : null;

    if (endDate && endDate < referenceDate) return "EXPIRE";
    if (["RESILIE", "ANNULE", "INACTIF"].includes(statut) || financeStatus === "RESILIE") {
      return "EXPIRE";
    }
    if (
      statut === "SUSPENDU" ||
      statut === "SUSPENDU_FINANCE" ||
      (financeStatus === "SUSPENDU" && rules.bloquer_si_suspension_financiere)
    ) {
      return "SUSPENDU";
    }
    if (startDate && startDate > referenceDate && !rules.autoriser_avant_date_debut) {
      return "EN_ATTENTE";
    }
    if (financeStatus === "A_FACTURER" && rules.bloquer_si_a_facturer) {
      return "EN_ATTENTE";
    }
    if (financeStatus === "EN_ATTENTE_REGLEMENT" && rules.bloquer_si_en_attente_reglement) {
      return "EN_ATTENTE";
    }
    if (
      [
        "EN_ATTENTE_VALIDATION_INTERNE",
        "EN_ATTENTE_VALIDATION_FINANCIERE",
        "EN_ATTENTE_REGLEMENT",
        "EN_ATTENTE_SUSPENSION_FINANCIERE",
      ].includes(statut)
    ) {
      return "EN_ATTENTE";
    }
    return "AUTORISE";
  }

  private getOperationalStatusForDate(
    record: {
      statut?: string | null;
      finance_status?: string | null;
      date_debut_service?: Date | null;
      date_fin_service?: Date | null;
      line_settings?: LigneTransportSettings | null;
    },
    referenceDate: Date,
  ): "ACTIF" | "SUSPENDU" | "EN_ATTENTE" | "RADIE" {
    const statut = (record.statut ?? "").toUpperCase();
    if (["RESILIE", "ANNULE", "INACTIF"].includes(statut)) {
      return "RADIE";
    }
    const accessStatus = this.getEligibilityAccessForDate(record, referenceDate);
    if (accessStatus === "AUTORISE") return "ACTIF";
    if (accessStatus === "SUSPENDU") return "SUSPENDU";
    if (accessStatus === "EN_ATTENTE") return "EN_ATTENTE";
    return "RADIE";
  }

  private getOperationalEvaluationDate(
    record: {
      date_debut_service?: Date | null;
      date_fin_service?: Date | null;
    },
    referenceDate: Date,
    periodStart: Date | null,
    periodEnd: Date | null,
  ) {
    const startDate = record.date_debut_service ? new Date(record.date_debut_service) : null;
    const endDate = record.date_fin_service ? new Date(record.date_fin_service) : null;

    if (periodStart || periodEnd) {
      const rawWindowStart = periodStart ?? periodEnd ?? referenceDate;
      const rawWindowEnd = periodEnd ?? periodStart ?? referenceDate;
      const windowStart = rawWindowStart <= rawWindowEnd ? rawWindowStart : rawWindowEnd;
      const windowEnd = rawWindowEnd >= rawWindowStart ? rawWindowEnd : rawWindowStart;
      const overlapStart = startDate && startDate > windowStart ? startDate : windowStart;
      const overlapEnd = endDate && endDate < windowEnd ? endDate : windowEnd;
      if (overlapStart > overlapEnd) return null;
      if (referenceDate < overlapStart) return overlapStart;
      if (referenceDate > overlapEnd) return overlapEnd;
      return referenceDate;
    }

    const effectiveStart = startDate ?? referenceDate;
    const effectiveEnd = endDate ?? referenceDate;
    if (effectiveStart <= referenceDate && effectiveEnd >= referenceDate) {
      return referenceDate;
    }
    return null;
  }

  private isFinanceAuthorized(financeStatus?: string | null) {
    const normalized = (financeStatus ?? "").toUpperCase();
    return normalized === "REGLE" || normalized === "ACTIF";
  }

  private parseLigneTransportSettings(value: unknown): LigneTransportSettings {
    const emptySettings: LigneTransportSettings = {
      zones: [],
      zone_tarifs: {},
      inscriptions_ouvertes: true,
      prorata_mode: "MONTH",
      access_rules: {
        bloquer_si_a_facturer: true,
        bloquer_si_en_attente_reglement: true,
        bloquer_si_suspension_financiere: true,
        autoriser_avant_date_debut: false,
        validation_humaine_suspension_financiere: false,
      },
    };
    if (!value || typeof value !== "object" || Array.isArray(value)) return emptySettings;

    const raw = value as Record<string, unknown>;
    const zones = Array.isArray(raw.zones)
      ? raw.zones
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter((item): item is string => Boolean(item))
      : [];
    const zone_tarifs =
      raw.zone_tarifs && typeof raw.zone_tarifs === "object" && !Array.isArray(raw.zone_tarifs)
        ? Object.entries(raw.zone_tarifs as Record<string, unknown>).reduce<Record<string, number>>(
            (acc, [key, value]) => {
              const label = key.trim();
              const amount = Number(value);
              if (label && Number.isFinite(amount) && amount >= 0) {
                acc[label] = amount;
              }
              return acc;
            },
            {},
          )
        : {};

    return {
      zones,
      zone_tarifs,
      inscriptions_ouvertes: raw.inscriptions_ouvertes !== false,
      prorata_mode: this.normalizeProrataMode(raw.prorata_mode),
      access_rules: {
        bloquer_si_a_facturer:
          raw.bloquer_si_a_facturer === false || raw.bloquer_si_a_facturer === "false"
            ? false
            : true,
        bloquer_si_en_attente_reglement:
          raw.bloquer_si_en_attente_reglement === false ||
          raw.bloquer_si_en_attente_reglement === "false"
            ? false
            : true,
        bloquer_si_suspension_financiere:
          raw.bloquer_si_suspension_financiere === false ||
          raw.bloquer_si_suspension_financiere === "false"
            ? false
            : true,
        autoriser_avant_date_debut:
          raw.autoriser_avant_date_debut === true || raw.autoriser_avant_date_debut === "true",
        validation_humaine_suspension_financiere:
          raw.validation_humaine_suspension_financiere === true ||
          raw.validation_humaine_suspension_financiere === "true",
      },
    };
  }

  private resolveTransportAmount(args: {
    ligne: {
      catalogue_frais_id?: string | null;
      infos_vehicule_json?: unknown;
      frais?: { montant?: unknown } | null;
    };
    zone: string | null;
    ratio?: number | null;
  }) {
    const settings = this.parseLigneTransportSettings(args.ligne.infos_vehicule_json);
    const baseAmount =
      args.zone && settings.zone_tarifs[args.zone] != null
        ? settings.zone_tarifs[args.zone]
        : toMoney(args.ligne.frais?.montant);
    const ratio = args.ratio != null && Number.isFinite(args.ratio) ? Number(args.ratio) : 1;
    return roundMoney(baseAmount * Math.min(1, Math.max(0, ratio)));
  }

  private deriveFinanceStatus(record: {
    statut?: string | null;
    a_facturer?: boolean | null;
    facture_id?: string | null;
    facture?: { statut?: string | null } | null;
  }) {
    const statut = (record.statut ?? "").toUpperCase();
    const factureStatut = (record.facture?.statut ?? "").toUpperCase();
    if (record.a_facturer) return "A_FACTURER";
    if (statut === "EN_ATTENTE_VALIDATION_INTERNE") return "VALIDATION_INTERNE";
    if (statut === "EN_ATTENTE_SUSPENSION_FINANCIERE") return "SUSPENSION_SIGNALEE";
    if (["EN_ATTENTE_VALIDATION_FINANCIERE", "EN_ATTENTE_REGLEMENT"].includes(statut)) {
      if (factureStatut === "PAYEE") return "REGLE";
      return "EN_ATTENTE_REGLEMENT";
    }
    if (statut === "ACTIF") {
      if (factureStatut === "PAYEE") return "REGLE";
      if (["EMISE", "PARTIELLE", "EN_RETARD"].includes(factureStatut)) return "EN_ATTENTE_REGLEMENT";
      return record.facture_id ? "ACTIF" : "ACTIF";
    }
    if (["SUSPENDU", "SUSPENDU_FINANCE"].includes(statut)) return "SUSPENDU";
    if (statut === "RESILIE") return "RESILIE";
    return "NON_RENSEIGNE";
  }

  private deriveAccessStatus(record: {
    statut?: string | null;
    finance_status?: string | null;
    date_debut_service?: Date | null;
    date_fin_service?: Date | null;
    line_settings?: LigneTransportSettings | null;
  }) {
    const statut = (record.statut ?? "").toUpperCase();
    const financeStatus = (record.finance_status ?? "").toUpperCase();
    const rules = record.line_settings?.access_rules ?? {
      bloquer_si_a_facturer: true,
      bloquer_si_en_attente_reglement: true,
      bloquer_si_suspension_financiere: true,
      autoriser_avant_date_debut: false,
      validation_humaine_suspension_financiere: false,
    };
    const today = new Date();
    const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const startDate = record.date_debut_service ? new Date(record.date_debut_service) : null;
    const endDate = record.date_fin_service ? new Date(record.date_fin_service) : null;

    if (endDate && endDate < todayUtc) return "EXPIRE";
    if (["RESILIE", "ANNULE", "INACTIF"].includes(statut) || financeStatus === "RESILIE") {
      return "EXPIRE";
    }
    if (
      statut === "SUSPENDU" ||
      statut === "SUSPENDU_FINANCE" ||
      (financeStatus === "SUSPENDU" && rules.bloquer_si_suspension_financiere)
    ) {
      return "SUSPENDU";
    }
    if (startDate && startDate > todayUtc && !rules.autoriser_avant_date_debut) {
      return "EN_ATTENTE";
    }
    if (financeStatus === "A_FACTURER" && rules.bloquer_si_a_facturer) {
      return "EN_ATTENTE";
    }
    if (financeStatus === "EN_ATTENTE_REGLEMENT" && rules.bloquer_si_en_attente_reglement) {
      return "EN_ATTENTE";
    }
    if (
      [
        "EN_ATTENTE_VALIDATION_INTERNE",
        "EN_ATTENTE_VALIDATION_FINANCIERE",
        "EN_ATTENTE_REGLEMENT",
        "EN_ATTENTE_SUSPENSION_FINANCIERE",
      ].includes(statut) ||
      ["VALIDATION_INTERNE", "SUSPENSION_SIGNALEE"].includes(financeStatus)
    ) {
      return "EN_ATTENTE";
    }
    if (statut === "ACTIF" && ["REGLE", "ACTIF"].includes(financeStatus)) {
      return "AUTORISE";
    }
    return "EN_ATTENTE";
  }

  private parseHistoryDetails(value: unknown): AffectationHistoryDetails {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const raw = value as Record<string, unknown>;
    return {
      actor_id:
        typeof raw.actor_id === "string" && raw.actor_id.trim() ? raw.actor_id.trim() : null,
      old_line_label:
        typeof raw.old_line_label === "string" && raw.old_line_label.trim()
          ? raw.old_line_label.trim()
          : null,
      new_line_label:
        typeof raw.new_line_label === "string" && raw.new_line_label.trim()
          ? raw.new_line_label.trim()
          : null,
      notification_finance: raw.notification_finance === true,
      reason: typeof raw.reason === "string" ? raw.reason.trim() : null,
      previous_facture_id:
        typeof raw.previous_facture_id === "string" && raw.previous_facture_id.trim()
          ? raw.previous_facture_id.trim()
          : null,
      old_catalogue_frais_id:
        typeof raw.old_catalogue_frais_id === "string" && raw.old_catalogue_frais_id.trim()
          ? raw.old_catalogue_frais_id.trim()
          : null,
      new_catalogue_frais_id:
        typeof raw.new_catalogue_frais_id === "string" && raw.new_catalogue_frais_id.trim()
          ? raw.new_catalogue_frais_id.trim()
          : null,
      prorata_ratio:
        typeof raw.prorata_ratio === "number"
          ? raw.prorata_ratio
          : raw.prorata_ratio != null
            ? Number(raw.prorata_ratio)
            : null,
      old_prorata_ratio:
        typeof raw.old_prorata_ratio === "number"
          ? raw.old_prorata_ratio
          : raw.old_prorata_ratio != null
            ? Number(raw.old_prorata_ratio)
            : null,
      new_prorata_ratio:
        typeof raw.new_prorata_ratio === "number"
          ? raw.new_prorata_ratio
          : raw.new_prorata_ratio != null
            ? Number(raw.new_prorata_ratio)
            : null,
      old_effective_amount:
        typeof raw.old_effective_amount === "number"
          ? raw.old_effective_amount
          : raw.old_effective_amount != null
            ? Number(raw.old_effective_amount)
            : null,
      new_effective_amount:
        typeof raw.new_effective_amount === "number"
          ? raw.new_effective_amount
          : raw.new_effective_amount != null
            ? Number(raw.new_effective_amount)
            : null,
      finance_processed_at:
        typeof raw.finance_processed_at === "string" && raw.finance_processed_at.trim()
          ? raw.finance_processed_at.trim()
          : null,
      finance_regularisation:
        raw.finance_regularisation &&
        typeof raw.finance_regularisation === "object" &&
        !Array.isArray(raw.finance_regularisation)
          ? (raw.finance_regularisation as AffectationHistoryDetails["finance_regularisation"])
          : null,
    };
  }

  private async getLatestAffectationHistoryRows(subscriptionIds: string[]) {
    if (subscriptionIds.length === 0) return new Map<string, TransportAffectationHistoryRow>();
    const rows = await this.prisma.$queryRaw<TransportAffectationHistoryRow[]>(
      Prisma.sql`SELECT
        id,
        abonnement_transport_id,
        ancienne_ligne_transport_id,
        ancien_arret_transport_id,
        ancienne_zone_transport,
        nouvelle_ligne_transport_id,
        nouvel_arret_transport_id,
        nouvelle_zone_transport,
        date_effet,
        impact_tarifaire,
        ancien_statut,
        nouveau_statut,
        details_json,
        created_at,
        updated_at
      FROM historiques_affectation_transport
      WHERE abonnement_transport_id IN (${Prisma.join(subscriptionIds)})
      ORDER BY created_at DESC`,
    );
    const latestBySubscription = new Map<string, TransportAffectationHistoryRow>();
    rows.forEach((row) => {
      if (!latestBySubscription.has(row.abonnement_transport_id)) {
        latestBySubscription.set(row.abonnement_transport_id, row);
      }
    });
    return latestBySubscription;
  }

  private async getAffectationHistoryRows(
    subscriptionIds: string[],
    limitPerSubscription?: number | null,
  ) {
    if (subscriptionIds.length === 0) {
      return new Map<string, TransportAffectationHistoryRow[]>();
    }
    const rows = await this.prisma.$queryRaw<TransportAffectationHistoryRow[]>(
      Prisma.sql`SELECT
        id,
        abonnement_transport_id,
        ancienne_ligne_transport_id,
        ancien_arret_transport_id,
        ancienne_zone_transport,
        nouvelle_ligne_transport_id,
        nouvel_arret_transport_id,
        nouvelle_zone_transport,
        date_effet,
        impact_tarifaire,
        ancien_statut,
        nouveau_statut,
        details_json,
        created_at,
        updated_at
      FROM historiques_affectation_transport
      WHERE abonnement_transport_id IN (${Prisma.join(subscriptionIds)})
      ORDER BY created_at DESC`,
    );
    const grouped = new Map<string, TransportAffectationHistoryRow[]>();
    rows.forEach((row) => {
      const current = grouped.get(row.abonnement_transport_id) ?? [];
      if (limitPerSubscription == null || current.length < limitPerSubscription) {
        current.push(row);
        grouped.set(row.abonnement_transport_id, current);
      }
    });
    return grouped;
  }

  private async getLatestFinancialReactivationDates(subscriptionIds: string[]) {
    if (subscriptionIds.length === 0) return new Map<string, Date>();

    const rows = await this.prisma.journalAudit.findMany({
      where: {
        type_entite: "ABONNEMENT_TRANSPORT",
        action: "TRANSPORT_REACTIVATION_FINANCIERE",
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

  private async getTransportUsageStats(args: {
    tenantId: string;
    subscriptionIds: string[];
    windowStart: Date;
    windowEnd: Date;
  }) {
    const empty = new Map<
      string,
      {
        latestUsageAt: Date | null;
        usageCountInWindow: number;
        usedInWindow: boolean;
      }
    >();
    if (args.subscriptionIds.length === 0) return empty;

    const rows = await this.prisma.journalAudit.findMany({
      where: {
        etablissement_id: args.tenantId,
        type_entite: "ABONNEMENT_TRANSPORT",
        action: "TRANSPORT_USAGE_RECORDED",
        id_entite: { in: args.subscriptionIds },
      },
      orderBy: [{ date_action: "desc" }],
      select: {
        id_entite: true,
        date_action: true,
        apres_json: true,
      },
    });

    const usageBySubscription = new Map<
      string,
      {
        latestUsageAt: Date | null;
        usageCountInWindow: number;
        usedInWindow: boolean;
      }
    >();

    rows.forEach((row) => {
      if (!row.id_entite) return;
      const payload =
        row.apres_json && typeof row.apres_json === "object" && !Array.isArray(row.apres_json)
          ? (row.apres_json as Record<string, unknown>)
          : null;
      const usageDateFromPayload =
        payload && typeof payload.usage_date === "string"
          ? this.normalizeDateInput(payload.usage_date)
          : null;
      const effectiveDate = usageDateFromPayload ?? row.date_action;
      const effectiveDay = new Date(
        Date.UTC(
          effectiveDate.getUTCFullYear(),
          effectiveDate.getUTCMonth(),
          effectiveDate.getUTCDate(),
        ),
      );

      const current = usageBySubscription.get(row.id_entite) ?? {
        latestUsageAt: null,
        usageCountInWindow: 0,
        usedInWindow: false,
      };

      if (!current.latestUsageAt || effectiveDate > current.latestUsageAt) {
        current.latestUsageAt = effectiveDate;
      }

      if (effectiveDay >= args.windowStart && effectiveDay <= args.windowEnd) {
        current.usageCountInWindow += 1;
        current.usedInWindow = true;
      }

      usageBySubscription.set(row.id_entite, current);
    });

    return usageBySubscription;
  }

  private async ensureScopedRelations(data: AbonnementTransportPayload, tenantId: string, excludeId?: string) {
    const [eleve, annee, ligne] = await Promise.all([
      this.prisma.eleve.findFirst({
        where: { id: data.eleve_id, etablissement_id: tenantId },
        select: { id: true },
      }),
      this.prisma.anneeScolaire.findFirst({
        where: { id: data.annee_scolaire_id, etablissement_id: tenantId },
        select: { id: true, date_debut: true, date_fin: true },
      }),
      this.prisma.ligneTransport.findFirst({
        where: { id: data.ligne_transport_id, etablissement_id: tenantId },
        select: { id: true, infos_vehicule_json: true },
      }),
    ]);

    if (!eleve) throw new Error("L'eleve selectionne n'appartient pas a cet etablissement.");
    if (!annee) throw new Error("L'annee scolaire selectionnee n'appartient pas a cet etablissement.");
    if (!ligne) throw new Error("La ligne de transport selectionnee n'appartient pas a cet etablissement.");

    const lineSettings = this.parseLigneTransportSettings(ligne.infos_vehicule_json);
    if (!lineSettings.inscriptions_ouvertes) {
      throw new Error("Le service transport n'est pas ouvert pour cette ligne sur la periode courante.");
    }
    if (!data.zone_transport) {
      throw new Error("La zone de transport est obligatoire.");
    }
    if (lineSettings.zones.length === 0) {
      throw new Error("Cette ligne de transport n'a aucune zone parametree.");
    }
    if (!lineSettings.zones.includes(data.zone_transport)) {
      throw new Error("La zone selectionnee n'est pas parametree pour cette ligne de transport.");
    }

    if (data.date_debut_service) {
      if (data.date_debut_service < annee.date_debut || data.date_debut_service > annee.date_fin) {
        throw new Error("La date de debut du transport doit etre incluse dans l'annee scolaire.");
      }
    }

    if (data.date_fin_service) {
      if (data.date_fin_service < annee.date_debut || data.date_fin_service > annee.date_fin) {
        throw new Error("La date de fin du transport doit etre incluse dans l'annee scolaire.");
      }
    }

    if (data.arret_transport_id) {
      const arret = await this.prisma.arretTransport.findFirst({
        where: { id: data.arret_transport_id, ligne_transport_id: data.ligne_transport_id },
        select: { id: true },
      });
      if (!arret) {
        throw new Error("L'arret selectionne n'appartient pas a la ligne de transport.");
      }
    }

    const duplicate = await this.prisma.abonnementTransport.findFirst({
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
      throw new Error("Un abonnement transport existe deja pour cet eleve sur cette annee scolaire.");
    }

    return {
      annee,
      ligne,
      lineSettings,
    };
  }

  private async attachFinanceMetadata<T extends { id: string }>(records: T[]) {
    if (records.length === 0) return records.map((item) => ({ ...item, facture_id: null, facture: null }));
    const ids = records.map((item) => item.id);
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        facture_id: string | null;
        zone_transport: string | null;
        date_debut_service: Date | null;
        date_fin_service: Date | null;
        prorata_ratio: Prisma.Decimal | number | null;
        a_facturer: boolean | null;
      }>
    >(
      Prisma.sql`SELECT id, facture_id, zone_transport, date_debut_service, date_fin_service, prorata_ratio, a_facturer FROM abonnements_transport WHERE id IN (${Prisma.join(ids)})`,
    );
    const factureIdByRecord = new Map(rows.map((item) => [item.id, item.facture_id ?? null]));
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
    const rowsById = new Map(rows.map((item) => [item.id, item]));
    const latestReactivationBySubscription = await this.getLatestFinancialReactivationDates(ids);
    return records.map((item) => {
      const facture_id = factureIdByRecord.get(item.id) ?? null;
      const row = rowsById.get(item.id);
      const lineSettings = this.parseLigneTransportSettings(
        (item as { ligne?: { infos_vehicule_json?: unknown } | null }).ligne?.infos_vehicule_json,
      );
      const finance_status = this.deriveFinanceStatus({
        statut: (item as { statut?: string | null }).statut ?? null,
        a_facturer: Boolean(row?.a_facturer),
        facture_id,
        facture: facture_id ? facturesById.get(facture_id) ?? null : null,
      });
      return {
        ...item,
        facture_id,
        facture: facture_id ? facturesById.get(facture_id) ?? null : null,
        zone_transport: row?.zone_transport ?? null,
        date_debut_service: row?.date_debut_service ?? null,
        date_fin_service: row?.date_fin_service ?? null,
        prorata_ratio: row?.prorata_ratio != null ? Number(row.prorata_ratio) : null,
        a_facturer: Boolean(row?.a_facturer),
        finance_status,
        derniere_reactivation_financiere:
          latestReactivationBySubscription.get(item.id) ?? null,
        access_status: this.deriveAccessStatus({
          statut: (item as { statut?: string | null }).statut ?? null,
          finance_status,
          date_debut_service: row?.date_debut_service ?? null,
          date_fin_service: row?.date_fin_service ?? null,
          line_settings: lineSettings,
        }),
      };
    });
  }

  private async getScopedRecord(id: string, tenantId: string) {
    const record = await this.prisma.abonnementTransport.findFirst({
      where: { id, eleve: { is: { etablissement_id: tenantId } } },
      include: {
        eleve: { include: { utilisateur: { include: { profil: true } } } },
        annee: true,
        ligne: true,
        arret: true,
      },
    });
    if (!record) return null;
    const [enriched] = await this.attachFinanceMetadata([record]);
    return enriched;
  }

  private resolveUserId(req: Request) {
    return (req as Request & { user?: { sub?: string } }).user?.sub ?? null;
  }

  private buildControlAnomalyId(args: {
    code: TransportControlAnomalyRow["code"];
    abonnementTransportId?: string | null;
    eleveId?: string | null;
    anneeScolaireId?: string | null;
    factureId?: string | null;
  }) {
    return [
      "transport-finance",
      args.code,
      args.abonnementTransportId ?? "none",
      args.eleveId ?? "none",
      args.anneeScolaireId ?? "none",
      args.factureId ?? "none",
    ].join("::");
  }

  private mapControlAnomalyTrackingStatus(action?: string | null) {
    switch ((action ?? "").toUpperCase()) {
      case "TRANSPORT_FINANCE_ANOMALY_RESOLVED":
        return "RESOLUE" as const;
      case "TRANSPORT_FINANCE_ANOMALY_IGNORED":
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
        type_entite: "CONTROLE_TRANSPORT_FINANCE",
        id_entite: { in: anomalyIds },
        action: {
          in: [
            "TRANSPORT_FINANCE_ANOMALY_OPENED",
            "TRANSPORT_FINANCE_ANOMALY_REOPENED",
            "TRANSPORT_FINANCE_ANOMALY_RESOLVED",
            "TRANSPORT_FINANCE_ANOMALY_IGNORED",
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
    anomalies: Omit<TransportControlAnomalyRow, "tracking_status">[];
  }) {
    const latestActions = await this.getLatestControlAnomalyActions(
      args.tenantId,
      args.anomalies.map((item) => item.anomaly_id),
    );

    const entries = args.anomalies
      .map((item) => {
        const latestAction = latestActions.get(item.anomaly_id) ?? null;
        if (
          latestAction === "TRANSPORT_FINANCE_ANOMALY_OPENED" ||
          latestAction === "TRANSPORT_FINANCE_ANOMALY_REOPENED"
        ) {
          return null;
        }
        const action =
          latestAction === "TRANSPORT_FINANCE_ANOMALY_RESOLVED" ||
          latestAction === "TRANSPORT_FINANCE_ANOMALY_IGNORED"
            ? "TRANSPORT_FINANCE_ANOMALY_REOPENED"
            : "TRANSPORT_FINANCE_ANOMALY_OPENED";

        return {
          etablissement_id: args.tenantId,
          acteur_utilisateur_id: args.actorId,
          action,
          type_entite: "CONTROLE_TRANSPORT_FINANCE",
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

  private getRequestIp(req: Request) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) {
      return forwarded.split(",")[0]?.trim() ?? null;
    }
    return req.ip ?? null;
  }

  private async writeAuditLog(
    tx: Prisma.TransactionClient,
    args: {
      tenantId: string;
      actorId: string | null;
      action: string;
      entityId: string;
      before: Prisma.InputJsonValue | null;
      after: Prisma.InputJsonValue | null;
      ip?: string | null;
    },
  ) {
    await tx.journalAudit.create({
      data: {
        etablissement_id: args.tenantId,
        acteur_utilisateur_id: args.actorId,
        action: args.action,
        type_entite: "ABONNEMENT_TRANSPORT",
        id_entite: args.entityId,
        avant_json: args.before,
        apres_json: args.after,
        ip: args.ip ?? null,
      } as never,
    });
  }

  private async notifyTransportSuspension(
    tx: Prisma.TransactionClient,
    args: {
      tenantId: string;
      eleveId: string;
      abonnementTransportId: string;
      ligneTransportId: string;
      factureId?: string | null;
      actorId?: string | null;
      type:
        | "TRANSPORT_SUSPENSION_SIGNALEE"
        | "TRANSPORT_SUSPENSION_ACTIVEE"
        | "TRANSPORT_SUSPENSION_REJETEE";
      payload: Record<string, unknown>;
    },
  ) {
    const transportPermissionCodes = [
      "TC.TRANSPORT.MENUACTION",
      "TC.TRANSPORT.MENUACTION.LIST",
      "TC.TRANSPORT.MENUACTION.PARAMETRE",
      "TC.TRANSPORT.MENUACTION.DASHBOARD",
      "TC.TRANSPORT.MENUACTION.ADD",
    ];

    const parentLinks = await tx.eleveParentTuteur.findMany({
      where: {
        eleve_id: args.eleveId,
        parent_tuteur: {
          etablissement_id: args.tenantId,
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
          etablissement_id: args.tenantId,
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
          ...(args.actorId ? [args.actorId] : []),
        ],
      ),
    );

    if (recipientIds.length === 0) return;

    await tx.notification.createMany({
      data: recipientIds.map((utilisateur_id) => ({
        utilisateur_id,
        type: args.type,
        payload_json: {
          abonnement_transport_id: args.abonnementTransportId,
          eleve_id: args.eleveId,
          ligne_transport_id: args.ligneTransportId,
          facture_id: args.factureId ?? null,
          ...args.payload,
        } as Prisma.InputJsonValue,
      })),
    });
  }

  private ensureMutable(existing: NonNullable<AbonnementTransportScopedRecord>) {
    if (existing?.facture && (existing.facture.statut ?? "").toUpperCase() !== "ANNULEE") {
      throw new Error(
        `Cet abonnement transport est deja facture par ${existing.facture.numero_facture}. Regularisez d'abord la facture liee.`,
      );
    }
  }

  private async updateOperationalStatus(
    id: string,
    statut: "ACTIF" | "SUSPENDU" | "INACTIF",
  ) {
    return this.prisma.abonnementTransport.update({
      where: { id },
      data: { statut },
    });
  }

  private async terminateSubscription(
    tenantId: string,
    existing: NonNullable<AbonnementTransportScopedRecord>,
    actorId: string | null,
  ) {
    if ((existing.statut ?? "").toUpperCase() === "RESILIE") {
      return existing;
    }

    if (!existing.facture_id) {
      return this.abonnementTransport.delete(existing.id);
    }

    return this.prisma.$transaction(async (tx) => {
      await regularizeServiceSubscriptionFacture(tx, {
        tenantId,
        factureId: existing.facture_id as string,
        eleveId: existing.eleve_id,
        anneeScolaireId: existing.annee_scolaire_id,
        catalogueFraisId: existing.ligne?.catalogue_frais_id ?? null,
        libellePrefix: "Transport -",
        serviceLabel: existing.ligne?.nom
          ? `transport ${existing.ligne.nom}`
          : "transport",
        createdByUtilisateurId: actorId,
        motif: "Resiliation abonnement transport",
      });

      return tx.abonnementTransport.update({
        where: { id: existing.id },
        data: {
          statut: "RESILIE",
        },
      });
    });
  }

  private async create(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = await this.resolveTenantIdForWrite(req);
      const data = this.normalizePayload({
        ...req.body,
        statut: "EN_ATTENTE_VALIDATION_INTERNE",
      });
      const { annee, lineSettings } = await this.ensureScopedRelations(data, tenantId);
      data.prorata_ratio = this.computeProrataRatioForLine({
        startDate: data.date_debut_service,
        endDate: data.date_fin_service,
        lineSettings,
        schoolYearStart: annee.date_debut,
        schoolYearEnd: annee.date_fin,
      });
      const result = await this.prisma.$transaction(async (tx) => {
        const abonnement = await tx.abonnementTransport.create({
          data: {
            eleve_id: data.eleve_id,
            annee_scolaire_id: data.annee_scolaire_id,
            ligne_transport_id: data.ligne_transport_id,
            arret_transport_id: data.arret_transport_id,
            statut: data.statut,
          },
        });

        await tx.$executeRaw(
          Prisma.sql`UPDATE abonnements_transport
            SET zone_transport = ${data.zone_transport},
                date_debut_service = ${data.date_debut_service},
                date_fin_service = ${data.date_fin_service},
                prorata_ratio = ${data.prorata_ratio}
            WHERE id = ${abonnement.id}`,
        );

        return abonnement;
      });
      Response.success(
        res,
        "Abonnement transport cree en attente de validation interne.",
        result,
      );
    } catch (error) {
      Response.error(res, "Erreur lors de la creation de l'abonnement transport", 400, error as Error);
      next(error);
    }
  }

  private async approveRequest(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedRecord(req.params.id, tenantId);
      if (!existing) throw new Error("Abonnement transport introuvable.");
      const currentStatus = (existing.statut ?? "").toUpperCase();
      if (currentStatus !== "EN_ATTENTE_VALIDATION_INTERNE") {
        throw new Error("Seules les demandes en attente interne peuvent etre validees.");
      }
      Response.success(
        res,
        "Demande transport validee et transmise a Finance.",
        await this.prisma.$transaction(async (tx) => {
          const updated = await tx.abonnementTransport.update({
            where: { id: existing.id },
            data: { statut: "EN_ATTENTE_VALIDATION_FINANCIERE" },
          });
          await tx.$executeRaw(
            Prisma.sql`UPDATE abonnements_transport SET a_facturer = ${true} WHERE id = ${existing.id}`,
          );
          return updated;
        }),
      );
    } catch (error) {
      Response.error(res, "Erreur lors de la validation de la demande transport", 400, error as Error);
      next(error);
    }
  }

  private async signalFinanceSuspension(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = await this.resolveTenantIdForWrite(req);
      const actorId = this.resolveUserId(req);
      const existing = await this.getScopedRecord(req.params.id, tenantId);
      if (!existing) throw new Error("Abonnement transport introuvable.");

      const currentStatus = (existing.statut ?? "").toUpperCase();
      if (["RESILIE", "ANNULE", "INACTIF"].includes(currentStatus)) {
        throw new Error("Cet abonnement transport ne peut plus etre suspendu pour impaye.");
      }
      if (["SUSPENDU_FINANCE", "EN_ATTENTE_SUSPENSION_FINANCIERE"].includes(currentStatus)) {
        throw new Error("Une suspension financiere est deja en cours pour cet abonnement.");
      }

      const financeStatus = ((existing as { finance_status?: string | null }).finance_status ?? "").toUpperCase();
      const latestHistoryBySubscription = await this.getLatestAffectationHistoryRows([existing.id]);
      const latestHistory = latestHistoryBySubscription.get(existing.id) ?? null;
      const latestHistoryDetails = this.parseHistoryDetails(latestHistory?.details_json ?? null);
      const regularizationPending =
        latestHistory?.impact_tarifaire === true &&
        latestHistoryDetails.notification_finance === true &&
        !latestHistoryDetails.finance_processed_at;

      if (financeStatus !== "EN_ATTENTE_REGLEMENT" && !regularizationPending) {
        throw new Error(
          "La suspension transport pour impaye requiert un dossier en attente de reglement ou une regularisation Finance non soldee.",
        );
      }

      const lineSettings = this.parseLigneTransportSettings(existing.ligne?.infos_vehicule_json);
      const requiresHumanValidation =
        lineSettings.access_rules.validation_humaine_suspension_financiere === true;
      const nextStatus = requiresHumanValidation
        ? "EN_ATTENTE_SUSPENSION_FINANCIERE"
        : "SUSPENDU_FINANCE";
      const motif =
        typeof req.body?.motif === "string" && req.body.motif.trim()
          ? req.body.motif.trim()
          : "Impayé signale par Finance";
      const source =
        typeof req.body?.source === "string" && req.body.source.trim()
          ? req.body.source.trim()
          : "FINANCE";
      const ip = this.getRequestIp(req);

      const updated = await this.prisma.$transaction(async (tx) => {
        const result = await tx.abonnementTransport.update({
          where: { id: existing.id },
          data: {
            statut: nextStatus,
          },
        });

        await this.writeAuditLog(tx, {
          tenantId,
          actorId,
          action: requiresHumanValidation
            ? "TRANSPORT_SUSPENSION_FINANCIERE_SIGNALEE"
            : "TRANSPORT_SUSPENSION_FINANCIERE_ACTIVEE",
          entityId: existing.id,
          before: {
            statut: existing.statut ?? null,
            finance_status: (existing as { finance_status?: string | null }).finance_status ?? null,
          } as Prisma.InputJsonValue,
          after: {
            statut: nextStatus,
            finance_status: requiresHumanValidation ? "SUSPENSION_SIGNALEE" : "SUSPENDU",
            source,
            motif,
            previous_statut: existing.statut ?? null,
            previous_finance_status: (existing as { finance_status?: string | null }).finance_status ?? null,
            regularization_pending: regularizationPending,
          } as Prisma.InputJsonValue,
          ip,
        });

        await this.notifyTransportSuspension(tx, {
          tenantId,
          eleveId: existing.eleve_id,
          abonnementTransportId: existing.id,
          ligneTransportId: existing.ligne_transport_id,
          factureId: existing.facture_id ?? null,
          actorId,
          type: requiresHumanValidation
            ? "TRANSPORT_SUSPENSION_SIGNALEE"
            : "TRANSPORT_SUSPENSION_ACTIVEE",
          payload: {
            statut: nextStatus,
            source,
            motif,
            validation_humaine: requiresHumanValidation,
            previous_statut: existing.statut ?? null,
            previous_finance_status: (existing as { finance_status?: string | null }).finance_status ?? null,
            regularization_pending: regularizationPending,
          },
        });

        return result;
      });

      Response.success(
        res,
        requiresHumanValidation
          ? "Suspension transport signee par Finance et en attente de validation."
          : "Suspension transport activee depuis Finance.",
        updated,
      );
    } catch (error) {
      Response.error(res, "Erreur lors du signal de suspension transport par Finance", 400, error as Error);
      next(error);
    }
  }

  private async approveFinanceSuspension(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = await this.resolveTenantIdForWrite(req);
      const actorId = this.resolveUserId(req);
      const existing = await this.getScopedRecord(req.params.id, tenantId);
      if (!existing) throw new Error("Abonnement transport introuvable.");
      if ((existing.statut ?? "").toUpperCase() !== "EN_ATTENTE_SUSPENSION_FINANCIERE") {
        throw new Error("Aucune suspension financiere en attente de validation n'existe pour cet abonnement.");
      }

      const motif =
        typeof req.body?.motif === "string" && req.body.motif.trim()
          ? req.body.motif.trim()
          : "Validation de la suspension transport par le responsable";
      const ip = this.getRequestIp(req);

      const updated = await this.prisma.$transaction(async (tx) => {
        const result = await tx.abonnementTransport.update({
          where: { id: existing.id },
          data: {
            statut: "SUSPENDU_FINANCE",
          },
        });

        await this.writeAuditLog(tx, {
          tenantId,
          actorId,
          action: "TRANSPORT_SUSPENSION_FINANCIERE_VALIDEE",
          entityId: existing.id,
          before: {
            statut: existing.statut ?? null,
          } as Prisma.InputJsonValue,
          after: {
            statut: "SUSPENDU_FINANCE",
            motif,
          } as Prisma.InputJsonValue,
          ip,
        });

        await this.notifyTransportSuspension(tx, {
          tenantId,
          eleveId: existing.eleve_id,
          abonnementTransportId: existing.id,
          ligneTransportId: existing.ligne_transport_id,
          factureId: existing.facture_id ?? null,
          actorId,
          type: "TRANSPORT_SUSPENSION_ACTIVEE",
          payload: {
            statut: "SUSPENDU_FINANCE",
            motif,
            source: "VALIDATION_TRANSPORT",
          },
        });

        return result;
      });

      Response.success(res, "Suspension transport validee.", updated);
    } catch (error) {
      Response.error(res, "Erreur lors de la validation de la suspension transport", 400, error as Error);
      next(error);
    }
  }

  private async rejectFinanceSuspension(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = await this.resolveTenantIdForWrite(req);
      const actorId = this.resolveUserId(req);
      const existing = await this.getScopedRecord(req.params.id, tenantId);
      if (!existing) throw new Error("Abonnement transport introuvable.");
      if ((existing.statut ?? "").toUpperCase() !== "EN_ATTENTE_SUSPENSION_FINANCIERE") {
        throw new Error("Aucune suspension financiere en attente de validation n'existe pour cet abonnement.");
      }

      const motif =
        typeof req.body?.motif === "string" && req.body.motif.trim()
          ? req.body.motif.trim()
          : "Suspension transport rejetee par le responsable";
      const ip = this.getRequestIp(req);

      const updated = await this.prisma.$transaction(async (tx) => {
        const latestSignalAudit = await tx.journalAudit.findFirst({
          where: {
            etablissement_id: tenantId,
            id_entite: existing.id,
            action: "TRANSPORT_SUSPENSION_FINANCIERE_SIGNALEE",
          },
          orderBy: { date_action: "desc" },
          select: {
            avant_json: true,
          },
        });

        const previousStatusRaw =
          latestSignalAudit?.avant_json &&
          typeof latestSignalAudit.avant_json === "object" &&
          !Array.isArray(latestSignalAudit.avant_json) &&
          typeof (latestSignalAudit.avant_json as Record<string, unknown>).statut === "string"
            ? String((latestSignalAudit.avant_json as Record<string, unknown>).statut).trim().toUpperCase()
            : "";
        const restoredStatus = [
          "EN_ATTENTE_VALIDATION_INTERNE",
          "EN_ATTENTE_VALIDATION_FINANCIERE",
          "EN_ATTENTE_REGLEMENT",
          "ACTIF",
          "SUSPENDU",
          "INACTIF",
          "ANNULE",
          "RESILIE",
        ].includes(previousStatusRaw)
          ? previousStatusRaw
          : "EN_ATTENTE_REGLEMENT";

        const result = await tx.abonnementTransport.update({
          where: { id: existing.id },
          data: {
            statut: restoredStatus,
          },
        });

        await this.writeAuditLog(tx, {
          tenantId,
          actorId,
          action: "TRANSPORT_SUSPENSION_FINANCIERE_REJETEE",
          entityId: existing.id,
          before: {
            statut: existing.statut ?? null,
          } as Prisma.InputJsonValue,
          after: {
            statut: restoredStatus,
            motif,
          } as Prisma.InputJsonValue,
          ip,
        });

        await this.notifyTransportSuspension(tx, {
          tenantId,
          eleveId: existing.eleve_id,
          abonnementTransportId: existing.id,
          ligneTransportId: existing.ligne_transport_id,
          factureId: existing.facture_id ?? null,
          actorId,
          type: "TRANSPORT_SUSPENSION_REJETEE",
          payload: {
            statut: restoredStatus,
            motif,
            source: "VALIDATION_TRANSPORT",
          },
        });

        return result;
      });

      Response.success(res, "Suspension transport rejetee.", updated);
    } catch (error) {
      Response.error(res, "Erreur lors du rejet de la suspension transport", 400, error as Error);
      next(error);
    }
  }

  private async getPendingFinanceBilling(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const result = await this.prisma.abonnementTransport.findMany({
        where: {
          eleve: { is: { etablissement_id: tenantId } },
          statut: { in: ["EN_ATTENTE_VALIDATION_FINANCIERE", "EN_ATTENTE_REGLEMENT"] },
        },
        include: {
          eleve: { include: { utilisateur: { include: { profil: true } } } },
          annee: true,
          ligne: true,
          arret: true,
        },
        orderBy: [{ created_at: "desc" }],
      });
      const [enriched, latestHistories] = await Promise.all([
        this.attachFinanceMetadata(result),
        this.getLatestAffectationHistoryRows(result.map((item) => item.id)),
      ]);
      Response.success(
        res,
        "Abonnements transport en attente de traitement Finance.",
        enriched
          .map((item) => ({
            ...item,
            historiquesAffectation: latestHistories.has(item.id)
              ? [latestHistories.get(item.id)]
              : [],
          }))
          .filter((item) => (item as Record<string, unknown>).finance_status === "A_FACTURER"),
      );
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des demandes transport a facturer", 400, error as Error);
      next(error);
    }
  }

  private async buildOperationalList(args: {
    tenantId: string;
    referenceDate: Date;
    periodStart: Date | null;
    periodEnd: Date | null;
    ligneTransportId?: string | null;
    operationalStatusFilter?: string | null;
    search?: string | null;
  }): Promise<{
    rows: TransportOperationalRow[];
    summary: TransportOperationalSummary;
  }> {
    const usageWindow = this.getUsageWindowBounds({
      referenceDate: args.referenceDate,
      periodStart: args.periodStart ?? null,
      periodEnd: args.periodEnd ?? null,
    });
    const where: Prisma.AbonnementTransportWhereInput = {
      eleve: { is: { etablissement_id: args.tenantId } },
      ...(args.ligneTransportId ? { ligne_transport_id: args.ligneTransportId } : {}),
      ...(args.search
        ? {
            OR: [
              { zone_transport: { contains: args.search } },
              { eleve: { is: { code_eleve: { contains: args.search } } } },
              {
                eleve: {
                  is: {
                    utilisateur: {
                      is: {
                        profil: {
                          is: {
                            prenom: { contains: args.search },
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
                            nom: { contains: args.search },
                          },
                        },
                      },
                    },
                  },
                },
              },
              { ligne: { is: { nom: { contains: args.search } } } },
              { arret: { is: { nom: { contains: args.search } } } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.abonnementTransport.findMany({
      where,
      include: {
        eleve: { include: { utilisateur: { include: { profil: true } } } },
        annee: true,
        ligne: true,
        arret: true,
      },
      orderBy: [{ ligne_transport_id: "asc" }, { created_at: "desc" }],
    });

    const enriched = await this.attachFinanceMetadata(rows);
    const usageStatsBySubscription = await this.getTransportUsageStats({
      tenantId: args.tenantId,
      subscriptionIds: enriched.map((item) => item.id),
      windowStart: usageWindow.start,
      windowEnd: usageWindow.end,
    });
    const operationalRows = enriched
      .map((item) => {
        const financeStatus =
          (item as typeof item & { finance_status?: string | null }).finance_status ?? null;
        const lineSettings = this.parseLigneTransportSettings(item.ligne?.infos_vehicule_json);
        const evaluationDate = this.getOperationalEvaluationDate(
          {
            date_debut_service: item.date_debut_service ?? null,
            date_fin_service: item.date_fin_service ?? null,
          },
          args.referenceDate,
          args.periodStart ?? null,
          args.periodEnd ?? null,
        );
        if (!evaluationDate) return null;

        const accessForDate = this.getEligibilityAccessForDate(
          {
            statut: item.statut ?? null,
            finance_status: financeStatus,
            date_debut_service: item.date_debut_service ?? null,
            date_fin_service: item.date_fin_service ?? null,
            line_settings: lineSettings,
          },
          evaluationDate,
        );
        const operationalStatus = this.getOperationalStatusForDate(
          {
            statut: item.statut ?? null,
            finance_status: financeStatus,
            date_debut_service: item.date_debut_service ?? null,
            date_fin_service: item.date_fin_service ?? null,
            line_settings: lineSettings,
          },
          evaluationDate,
        );
        if (args.operationalStatusFilter && operationalStatus !== args.operationalStatusFilter) {
          return null;
        }
        const usageStats = usageStatsBySubscription.get(item.id) ?? {
          latestUsageAt: null,
          usageCountInWindow: 0,
          usedInWindow: false,
        };

        return {
          ...item,
          operational_status: operationalStatus,
          access_for_date: accessForDate,
          finance_authorized: this.isFinanceAuthorized(financeStatus),
          evaluation_date: evaluationDate,
          latest_usage_at: usageStats.latestUsageAt,
          usage_count_in_window: usageStats.usageCountInWindow,
          used_in_window: usageStats.usedInWindow,
        } as TransportOperationalRow;
      })
      .filter((item): item is TransportOperationalRow => Boolean(item))
      .sort((left, right) => {
        const leftName = [left.eleve?.utilisateur?.profil?.prenom, left.eleve?.utilisateur?.profil?.nom]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const rightName = [right.eleve?.utilisateur?.profil?.prenom, right.eleve?.utilisateur?.profil?.nom]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return leftName.localeCompare(rightName);
      });

    const summary: TransportOperationalSummary = {
      actifs: operationalRows.filter((item) => item.operational_status === "ACTIF").length,
      suspendus: operationalRows.filter((item) => item.operational_status === "SUSPENDU").length,
      en_attente: operationalRows.filter((item) => item.operational_status === "EN_ATTENTE").length,
      radies: operationalRows.filter((item) => item.operational_status === "RADIE").length,
      transportes_non_finances: operationalRows.filter(
        (item) => item.operational_status === "ACTIF" && !item.finance_authorized,
      ).length,
      finances_non_transportables: operationalRows.filter(
        (item) => item.finance_authorized && item.operational_status !== "ACTIF",
      ).length,
    };

    return {
      rows: operationalRows,
      summary,
    };
  }

  private async getOperationalList(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const query = this.getOperationalQueryContext(req);
      const { rows, summary } = await this.buildOperationalList({
        tenantId,
        ...query,
      });
      Response.success(res, "Liste operationnelle transport.", {
        rows,
        summary,
      });
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation de la liste operationnelle transport", 400, error as Error);
      next(error);
    }
  }

  private async getControlAnomalies(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const actorId = this.resolveUserId(req);
      const ip = this.getRequestIp(req);
      const query = this.getOperationalQueryContext(req);
      const { rows: operationalRows } = await this.buildOperationalList({
        tenantId,
        ...query,
      });

      const operationalAssignmentKeys = new Set(
        operationalRows
          .filter((item) => item.operational_status !== "RADIE")
          .map((item) => `${item.eleve_id}::${item.annee_scolaire_id}`),
      );

      const anomalies: Omit<TransportControlAnomalyRow, "tracking_status">[] = [];

      operationalRows.forEach((item) => {
        const eleveLabel = [
          item.eleve?.utilisateur?.profil?.prenom,
          item.eleve?.utilisateur?.profil?.nom,
        ]
          .filter(Boolean)
          .join(" ")
          .trim() || item.eleve?.code_eleve || "Eleve";

        if (item.operational_status === "ACTIF" && !item.finance_authorized) {
          anomalies.push({
            anomaly_id: this.buildControlAnomalyId({
              code: "TRANSPORTE_SANS_DROIT_FINANCIER",
              abonnementTransportId: item.id,
              eleveId: item.eleve_id,
              anneeScolaireId: item.annee_scolaire_id,
              factureId: item.facture_id ?? null,
            }),
            code: "TRANSPORTE_SANS_DROIT_FINANCIER",
            gravite: "HIGH",
            abonnement_transport_id: item.id,
            eleve_id: item.eleve_id,
            eleve_label: eleveLabel,
            code_eleve: item.eleve?.code_eleve ?? null,
            annee_scolaire_id: item.annee_scolaire_id,
            annee_label: item.annee?.nom ?? null,
            ligne_transport_id: item.ligne_transport_id,
            ligne_label: item.ligne?.nom ?? null,
            arret_label: item.arret?.nom ?? null,
            zone_transport: item.zone_transport ?? null,
            finance_status:
              (item as typeof item & { finance_status?: string | null }).finance_status ?? null,
            service_status: item.statut ?? null,
            operational_status: item.operational_status,
            facture_id: item.facture_id ?? null,
            facture_numero: item.facture?.numero_facture ?? null,
            motif:
              "Eleve present dans la liste d'exploitation alors que le feu vert financier n'est pas actif.",
            evaluation_date: item.evaluation_date ?? null,
          });
        }

        if (item.operational_status === "SUSPENDU" && item.used_in_window) {
          anomalies.push({
            anomaly_id: this.buildControlAnomalyId({
              code: "SUSPENDU_AVEC_USAGE_REEL",
              abonnementTransportId: item.id,
              eleveId: item.eleve_id,
              anneeScolaireId: item.annee_scolaire_id,
              factureId: item.facture_id ?? null,
            }),
            code: "SUSPENDU_AVEC_USAGE_REEL",
            gravite: "MEDIUM",
            abonnement_transport_id: item.id,
            eleve_id: item.eleve_id,
            eleve_label: eleveLabel,
            code_eleve: item.eleve?.code_eleve ?? null,
            annee_scolaire_id: item.annee_scolaire_id,
            annee_label: item.annee?.nom ?? null,
            ligne_transport_id: item.ligne_transport_id,
            ligne_label: item.ligne?.nom ?? null,
            arret_label: item.arret?.nom ?? null,
            zone_transport: item.zone_transport ?? null,
            finance_status:
              (item as typeof item & { finance_status?: string | null }).finance_status ?? null,
            service_status: item.statut ?? null,
            operational_status: item.operational_status,
            facture_id: item.facture_id ?? null,
            facture_numero: item.facture?.numero_facture ?? null,
            motif:
              "Un usage transport reel a ete enregistre pour un eleve actuellement suspendu.",
            evaluation_date: item.evaluation_date ?? null,
          });
        }
      });

      const paidTransportLines = await this.prisma.factureLigne.findMany({
        where: {
          frais: { is: { usage_scope: "TRANSPORT" } },
          facture: {
            is: {
              etablissement_id: tenantId,
              statut: "PAYEE",
              nature: { not: "AVOIR" },
              ...(query.search
                ? {
                    OR: [
                      { numero_facture: { contains: query.search } },
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
                    ],
                  }
                : {}),
            },
          },
        },
        include: {
          frais: {
            select: {
              nom: true,
            },
          },
          facture: {
            select: {
              id: true,
              numero_facture: true,
              statut: true,
              eleve_id: true,
              annee_scolaire_id: true,
              eleve: {
                select: {
                  id: true,
                  code_eleve: true,
                  utilisateur: {
                    select: {
                      profil: {
                        select: {
                          prenom: true,
                          nom: true,
                        },
                      },
                    },
                  },
                },
              },
              annee: {
                select: {
                  id: true,
                  nom: true,
                },
              },
            },
          },
        },
      });

      const seenPaidWithoutAssignment = new Set<string>();
      paidTransportLines.forEach((line) => {
        const invoice = line.facture;
        const key = `${invoice.eleve_id}::${invoice.annee_scolaire_id}`;
        if (operationalAssignmentKeys.has(key) || seenPaidWithoutAssignment.has(key)) return;
        seenPaidWithoutAssignment.add(key);
        const eleveLabel = [
          invoice.eleve?.utilisateur?.profil?.prenom,
          invoice.eleve?.utilisateur?.profil?.nom,
        ]
          .filter(Boolean)
          .join(" ")
          .trim() || invoice.eleve?.code_eleve || "Eleve";
        anomalies.push({
          anomaly_id: this.buildControlAnomalyId({
            code: "PAYE_SANS_AFFECTATION_TRANSPORT",
            abonnementTransportId: null,
            eleveId: invoice.eleve_id,
            anneeScolaireId: invoice.annee_scolaire_id,
            factureId: invoice.id,
          }),
          code: "PAYE_SANS_AFFECTATION_TRANSPORT",
          gravite: "HIGH",
          abonnement_transport_id: null,
          eleve_id: invoice.eleve_id,
          eleve_label: eleveLabel,
          code_eleve: invoice.eleve?.code_eleve ?? null,
          annee_scolaire_id: invoice.annee_scolaire_id,
          annee_label: invoice.annee?.nom ?? null,
          ligne_transport_id: null,
          ligne_label: null,
          arret_label: null,
          zone_transport: null,
          finance_status: "REGLE",
          service_status: null,
          operational_status: null,
          facture_id: invoice.id,
          facture_numero: invoice.numero_facture ?? null,
          motif:
            "Frais transport regles cote Finance mais aucune affectation transport exploitable n'a ete trouvee.",
          evaluation_date: query.referenceDate,
        });
      });

      const anomalyPriority: Record<TransportControlAnomalyRow["code"], number> = {
        TRANSPORTE_SANS_DROIT_FINANCIER: 0,
        PAYE_SANS_AFFECTATION_TRANSPORT: 1,
        SUSPENDU_AVEC_USAGE_REEL: 2,
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

      const rows: TransportControlAnomalyRow[] = anomalies.map((item) => ({
        ...item,
        tracking_status: this.mapControlAnomalyTrackingStatus(
          latestActions.get(item.anomaly_id) ?? null,
        ),
      }));

      const summary: TransportControlAnomalySummary = {
        total: anomalies.length,
        transportes_sans_droit_financier: anomalies.filter(
          (item) => item.code === "TRANSPORTE_SANS_DROIT_FINANCIER",
        ).length,
        payes_sans_affectation_transport: anomalies.filter(
          (item) => item.code === "PAYE_SANS_AFFECTATION_TRANSPORT",
        ).length,
        suspendus_encore_planifies: anomalies.filter(
          (item) => item.code === "SUSPENDU_AVEC_USAGE_REEL",
        ).length,
      };

      await this.prisma.journalAudit.create({
        data: {
          etablissement_id: tenantId,
          acteur_utilisateur_id: actorId,
          action: "TRANSPORT_FINANCE_ANOMALIES_REFRESHED",
          type_entite: "CONTROLE_TRANSPORT_FINANCE",
          id_entite: tenantId,
          avant_json: null,
          apres_json: {
            filters: {
              reference_date: query.referenceDate.toISOString(),
              period_start: query.periodStart?.toISOString() ?? null,
              period_end: query.periodEnd?.toISOString() ?? null,
              ligne_transport_id: query.ligneTransportId ?? null,
              operational_status: query.operationalStatusFilter ?? null,
              search: query.search ?? null,
            },
            summary,
          } as Prisma.InputJsonValue,
          ip,
        } as never,
      });

      Response.success(res, "Anomalies de rapprochement transport/Finance.", {
        rows,
        summary,
      });
    } catch (error) {
      Response.error(res, "Erreur lors du rapprochement transport et Finance", 400, error as Error);
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
        throw new Error("L'identifiant de l'anomalie est obligatoire.");
      }
      if (!["RESOLVED", "IGNORED"].includes(decision)) {
        throw new Error("La decision d'anomalie est invalide.");
      }

      await this.prisma.journalAudit.create({
        data: {
          etablissement_id: tenantId,
          acteur_utilisateur_id: actorId,
          action:
            decision === "RESOLVED"
              ? "TRANSPORT_FINANCE_ANOMALY_RESOLVED"
              : "TRANSPORT_FINANCE_ANOMALY_IGNORED",
          type_entite: "CONTROLE_TRANSPORT_FINANCE",
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
        decision === "RESOLVED" ? "Anomalie marquee comme resolue." : "Anomalie ignoree.",
        { anomaly_id: anomalyId, decision },
      );
    } catch (error) {
      Response.error(res, "Erreur lors de la mise a jour de l'anomalie", 400, error as Error);
      next(error);
    }
  }

  private async recordUsage(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = await this.resolveTenantIdForWrite(req);
      const actorId = this.resolveUserId(req);
      const ip = this.getRequestIp(req);
      const existing = await this.getScopedRecord(req.params.id, tenantId);
      if (!existing) throw new Error("Abonnement transport introuvable.");

      const usageDate =
        this.normalizeDateInput(req.body?.usage_date) ??
        new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
      const note =
        typeof req.body?.note === "string" && req.body.note.trim() ? req.body.note.trim() : null;
      const nextDay = new Date(usageDate.getTime() + 24 * 60 * 60 * 1000);

      const duplicate = await this.prisma.journalAudit.findFirst({
        where: {
          etablissement_id: tenantId,
          type_entite: "ABONNEMENT_TRANSPORT",
          id_entite: existing.id,
          action: "TRANSPORT_USAGE_RECORDED",
          date_action: {
            gte: usageDate,
            lt: nextDay,
          },
        },
        select: { id: true },
      });

      if (duplicate) {
        throw new Error("Un passage transport a deja ete enregistre pour cet abonnement a cette date.");
      }

      await this.prisma.journalAudit.create({
        data: {
          etablissement_id: tenantId,
          acteur_utilisateur_id: actorId,
          action: "TRANSPORT_USAGE_RECORDED",
          type_entite: "ABONNEMENT_TRANSPORT",
          id_entite: existing.id,
          avant_json: null,
          apres_json: {
            abonnement_transport_id: existing.id,
            eleve_id: existing.eleve_id,
            ligne_transport_id: existing.ligne_transport_id,
            usage_date: usageDate.toISOString(),
            note,
          } as Prisma.InputJsonValue,
          ip,
          date_action: usageDate,
        } as never,
      });

      Response.success(res, "Passage transport enregistre.", {
        abonnement_transport_id: existing.id,
        usage_date: usageDate,
      });
    } catch (error) {
      Response.error(res, "Erreur lors de l'enregistrement du passage transport", 400, error as Error);
      next(error);
    }
  }

  private async linkFinanceFacture(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedRecord(req.params.id, tenantId);
      if (!existing) throw new Error("Abonnement transport introuvable.");

      const factureId =
        typeof req.body?.facture_id === "string" && req.body.facture_id.trim()
          ? req.body.facture_id.trim()
          : "";
      if (!factureId) {
        throw new Error("La facture Finance est obligatoire.");
      }

      const facture = await this.prisma.facture.findFirst({
        where: {
          id: factureId,
          etablissement_id: tenantId,
          eleve_id: existing.eleve_id,
          annee_scolaire_id: existing.annee_scolaire_id,
        },
        select: { id: true, statut: true },
      });
      if (!facture) {
        throw new Error("La facture fournie n'appartient pas a cet eleve sur cette annee scolaire.");
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.abonnementTransport.update({
          where: { id: existing.id },
          data: {
            facture_id: facture.id,
            statut: (facture.statut ?? "").toUpperCase() === "PAYEE" ? "ACTIF" : "EN_ATTENTE_REGLEMENT",
          },
        });
        await tx.$executeRaw(
          Prisma.sql`UPDATE abonnements_transport SET a_facturer = ${false} WHERE id = ${existing.id}`,
        );
        return updated;
      });

      Response.success(res, "Abonnement transport lie a la facture Finance.", result);
    } catch (error) {
      Response.error(res, "Erreur lors du rattachement de la facture Finance", 400, error as Error);
      next(error);
    }
  }

  private async processFinanceBilling(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedRecord(req.params.id, tenantId);
      if (!existing) throw new Error("Abonnement transport introuvable.");

      const financeStatus = ((existing as { finance_status?: string | null }).finance_status ?? "").toUpperCase();
      if (financeStatus !== "A_FACTURER") {
        throw new Error("Cet abonnement transport n'est pas en attente de facturation Finance.");
      }
      if (!existing.ligne?.catalogue_frais_id) {
        throw new Error("La ligne de transport ne porte aucun frais catalogue facturable.");
      }

      const amount = this.resolveTransportAmount({
        ligne: existing.ligne,
        zone: existing.zone_transport ?? null,
        ratio: existing.prorata_ratio != null ? Number(existing.prorata_ratio) : null,
      });
      const actorId = (req as Request & { user?: { sub?: string } }).user?.sub ?? null;
      const emissionDate = existing.date_debut_service ? new Date(existing.date_debut_service) : new Date();

      const result = await this.prisma.$transaction(async (tx) => {
        const factureResult =
          amount > 0
            ? await createServiceSubscriptionFacture(tx, {
                tenantId,
                eleveId: existing.eleve_id,
                anneeScolaireId: existing.annee_scolaire_id,
                catalogueFraisId: existing.ligne!.catalogue_frais_id!,
                allowedScopes: ["GENERAL", "TRANSPORT"],
                libelle: `Transport - ${existing.ligne?.nom ?? "Service transport"}`,
                modePaiement: "ECHELONNE",
                nombreTranches: 1,
                createdByUtilisateurId: actorId,
                dateEmission: emissionDate,
                dateEcheance: emissionDate,
                montantOverride: amount,
              })
            : null;

        const generatedFactureStatus = (factureResult?.facture?.statut ?? "").toUpperCase();
        const nextStatus =
          factureResult?.facture?.id != null
            ? generatedFactureStatus === "PAYEE"
              ? "ACTIF"
              : "EN_ATTENTE_REGLEMENT"
            : "ACTIF";

        const updated = await tx.abonnementTransport.update({
          where: { id: existing.id },
          data: {
            facture_id: factureResult?.facture?.id ?? null,
            statut: nextStatus,
          },
        });

        await tx.$executeRaw(
          Prisma.sql`UPDATE abonnements_transport SET a_facturer = ${false} WHERE id = ${existing.id}`,
        );

        return updated;
      });

      Response.success(res, "Facturation transport generee par Finance.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la facturation transport par Finance", 400, error as Error);
      next(error);
    }
  }

  private async processFinanceRegularization(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedRecord(req.params.id, tenantId);
      if (!existing) throw new Error("Abonnement transport introuvable.");

      const latestHistoryRows = await this.prisma.$queryRaw<TransportAffectationHistoryRow[]>(
        Prisma.sql`SELECT
          id,
          abonnement_transport_id,
          ancienne_ligne_transport_id,
          ancien_arret_transport_id,
          ancienne_zone_transport,
          nouvelle_ligne_transport_id,
          nouvel_arret_transport_id,
          nouvelle_zone_transport,
          date_effet,
          impact_tarifaire,
          ancien_statut,
          nouveau_statut,
          details_json,
          created_at,
          updated_at
        FROM historiques_affectation_transport
        WHERE abonnement_transport_id = ${existing.id}
          AND impact_tarifaire = ${true}
        ORDER BY created_at DESC
        LIMIT 1`,
      );
      const latestHistory = latestHistoryRows[0] ?? null;

      if (!latestHistory) {
        throw new Error("Aucune regularisation de changement d'affectation n'est en attente pour cet abonnement.");
      }

      const historyDetails = this.parseHistoryDetails(latestHistory.details_json);
      if (historyDetails.finance_processed_at) {
        throw new Error("Cette regularisation transport a deja ete traitee par Finance.");
      }

      const [oldLine, newLine] = await Promise.all([
        this.prisma.ligneTransport.findFirst({
          where: {
            id: latestHistory.ancienne_ligne_transport_id,
            etablissement_id: tenantId,
          },
          select: {
            id: true,
            nom: true,
            catalogue_frais_id: true,
            frais: {
              select: {
                id: true,
                montant: true,
                devise: true,
              },
            },
          },
        }),
        this.prisma.ligneTransport.findFirst({
          where: {
            id: latestHistory.nouvelle_ligne_transport_id,
            etablissement_id: tenantId,
          },
          select: {
            id: true,
            nom: true,
            catalogue_frais_id: true,
            frais: {
              select: {
                id: true,
                montant: true,
                devise: true,
              },
            },
          },
        }),
      ]);

      if (!oldLine || !newLine) {
        throw new Error("Impossible de retrouver les lignes transport impliquees dans la regularisation.");
      }

      const ratioSource =
        existing.prorata_ratio != null
          ? Number(existing.prorata_ratio)
          : historyDetails.prorata_ratio != null
            ? Number(historyDetails.prorata_ratio)
            : 1;
      const effectiveRatio =
        Number.isFinite(ratioSource) && ratioSource > 0 ? Math.min(1, Math.max(0, ratioSource)) : 1;
      const oldAmount =
        historyDetails.old_effective_amount != null
          ? Number(historyDetails.old_effective_amount)
          :
        historyDetails.finance_regularisation?.montant_avoir != null
          ? Number(historyDetails.finance_regularisation.montant_avoir)
          : this.resolveTransportAmount({
              ligne: oldLine,
              zone: latestHistory.ancienne_zone_transport,
              ratio: effectiveRatio,
            });
      const newAmount =
        historyDetails.new_effective_amount != null
          ? Number(historyDetails.new_effective_amount)
          :
        historyDetails.finance_regularisation?.montant_nouvelle_facture != null
          ? Number(historyDetails.finance_regularisation.montant_nouvelle_facture)
          : this.resolveTransportAmount({
              ligne: newLine,
              zone: latestHistory.nouvelle_zone_transport,
              ratio: effectiveRatio,
            });
      const actorId = (req as Request & { user?: { sub?: string } }).user?.sub ?? null;
      const previousFactureId = historyDetails.previous_facture_id ?? null;

      const result = await this.prisma.$transaction(async (tx) => {
        const creditResult =
          previousFactureId && oldAmount > 0
            ? await regularizeServiceSubscriptionFacture(tx, {
                tenantId,
                factureId: previousFactureId,
                eleveId: existing.eleve_id,
                anneeScolaireId: existing.annee_scolaire_id,
                catalogueFraisId: oldLine.catalogue_frais_id ?? null,
                libellePrefix: "Transport -",
                serviceLabel: oldLine.nom ? `transport ${oldLine.nom}` : "transport",
                createdByUtilisateurId: actorId,
                motif: "Regularisation changement d'affectation transport",
                montantOverride: oldAmount,
              })
            : null;

        const newFactureResult =
          newLine.catalogue_frais_id && newAmount > 0
            ? await createServiceSubscriptionFacture(tx, {
                tenantId,
                eleveId: existing.eleve_id,
                anneeScolaireId: existing.annee_scolaire_id,
                catalogueFraisId: newLine.catalogue_frais_id,
                allowedScopes: ["GENERAL", "TRANSPORT"],
                libelle: `Transport - ${newLine.nom}`,
                modePaiement: "ECHELONNE",
                nombreTranches: 1,
                createdByUtilisateurId: actorId,
                dateEmission: new Date(),
                dateEcheance: latestHistory.date_effet,
                montantOverride: newAmount,
              })
            : null;

        const generatedFactureStatus = (newFactureResult?.facture?.statut ?? "").toUpperCase();
        const nextStatus =
          newFactureResult?.facture?.id != null
            ? generatedFactureStatus === "PAYEE"
              ? "ACTIF"
              : "EN_ATTENTE_REGLEMENT"
            : "ACTIF";

        await tx.abonnementTransport.update({
          where: { id: existing.id },
          data: {
            facture_id: newFactureResult?.facture?.id ?? null,
            statut: nextStatus,
          },
        });

        await tx.$executeRaw(
          Prisma.sql`UPDATE abonnements_transport SET a_facturer = ${false} WHERE id = ${existing.id}`,
        );

        await tx.$executeRaw(
          Prisma.sql`UPDATE historiques_affectation_transport
            SET details_json = ${JSON.stringify({
              ...((latestHistory.details_json &&
              typeof latestHistory.details_json === "object" &&
              !Array.isArray(latestHistory.details_json)
                ? latestHistory.details_json
                : {}) as Prisma.JsonObject),
              finance_processed_at: new Date().toISOString(),
              finance_regularisation: {
                montant_avoir: oldAmount,
                montant_nouvelle_facture: newAmount,
                ancienne_facture_id: previousFactureId,
                nouvelle_facture_id: newFactureResult?.facture?.id ?? null,
                avoir_id: creditResult?.avoir?.id ?? null,
              },
            })}
            WHERE id = ${latestHistory.id}`,
        );

        return {
          abonnement: await tx.abonnementTransport.findUnique({
            where: { id: existing.id },
          }),
          avoir: creditResult?.avoir ?? null,
          facture: newFactureResult?.facture ?? null,
          montant_avoir: oldAmount,
          montant_facture: newAmount,
        };
      });

      Response.success(res, "Regularisation transport calculee par Finance.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la regularisation transport par Finance", 400, error as Error);
      next(error);
    }
  }

  private async updatePeriod(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = await this.resolveTenantIdForWrite(req);
      const existing = await this.getScopedRecord(req.params.id, tenantId);
      if (!existing) throw new Error("Abonnement transport introuvable.");

      const payload = this.normalizeUpdatePeriodPayload(req.body as Record<string, unknown>);
      if (
        this.toDateKey(existing.date_debut_service) === this.toDateKey(payload.date_debut_service) &&
        this.toDateKey(existing.date_fin_service) === this.toDateKey(payload.date_fin_service)
      ) {
        throw new Error("La nouvelle periode d'usage doit modifier la date de debut ou la date de fin.");
      }

      const annee = await this.prisma.anneeScolaire.findFirst({
        where: {
          id: existing.annee_scolaire_id,
          etablissement_id: tenantId,
        },
        select: {
          date_debut: true,
          date_fin: true,
        },
      });
      if (!annee) throw new Error("Annee scolaire introuvable pour cet abonnement transport.");

      if (
        payload.date_debut_service &&
        (payload.date_debut_service < annee.date_debut || payload.date_debut_service > annee.date_fin)
      ) {
        throw new Error("La date de debut du service transport doit etre incluse dans l'annee scolaire.");
      }
      if (
        payload.date_fin_service &&
        (payload.date_fin_service < annee.date_debut || payload.date_fin_service > annee.date_fin)
      ) {
        throw new Error("La date de fin du service transport doit etre incluse dans l'annee scolaire.");
      }

      const oldRatio =
        existing.prorata_ratio != null
          ? Number(existing.prorata_ratio)
          : this.computeProrataRatioForLine({
              startDate: existing.date_debut_service ?? null,
              endDate: existing.date_fin_service ?? null,
              lineSettings: this.parseLigneTransportSettings(existing.ligne?.infos_vehicule_json),
              schoolYearStart: annee.date_debut,
              schoolYearEnd: annee.date_fin,
            });
      const newRatio = this.computeProrataRatioForLine({
        startDate: payload.date_debut_service,
        endDate: payload.date_fin_service,
        lineSettings: this.parseLigneTransportSettings(existing.ligne?.infos_vehicule_json),
        schoolYearStart: annee.date_debut,
        schoolYearEnd: annee.date_fin,
      });
      const oldAmount = this.resolveTransportAmount({
        ligne: existing.ligne ?? {},
        zone: existing.zone_transport ?? null,
        ratio: oldRatio,
      });
      const newAmount = this.resolveTransportAmount({
        ligne: existing.ligne ?? {},
        zone: existing.zone_transport ?? null,
        ratio: newRatio,
      });
      const impactTarifaire = oldAmount !== newAmount;
      const statusRule = this.getAffectationStatusRule(existing.statut, impactTarifaire);
      const nextStatus = statusRule.nextStatus;
      const shouldNotifyFinance =
        impactTarifaire || Boolean((existing as Record<string, unknown>).a_facturer);
      const actorId = (req as Request & { user?: { sub?: string } }).user?.sub ?? null;
      const effectDate = payload.date_fin_service ?? payload.date_debut_service ?? new Date();

      const result = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw(
          Prisma.sql`UPDATE abonnements_transport
            SET date_debut_service = ${payload.date_debut_service},
                date_fin_service = ${payload.date_fin_service},
                prorata_ratio = ${newRatio},
                facture_id = ${shouldNotifyFinance ? null : existing.facture_id},
                statut = ${nextStatus},
                a_facturer = ${shouldNotifyFinance}
            WHERE id = ${existing.id}`,
        );

        if (shouldNotifyFinance) {
          await tx.$executeRaw(
            Prisma.sql`INSERT INTO historiques_affectation_transport (
              id,
              abonnement_transport_id,
              ancienne_ligne_transport_id,
              ancien_arret_transport_id,
              ancienne_zone_transport,
              nouvelle_ligne_transport_id,
              nouvel_arret_transport_id,
              nouvelle_zone_transport,
              date_effet,
              impact_tarifaire,
              ancien_statut,
              nouveau_statut,
              details_json,
              created_at,
              updated_at
            ) VALUES (
              ${randomUUID()},
              ${existing.id},
              ${existing.ligne_transport_id},
              ${existing.arret_transport_id},
              ${existing.zone_transport},
              ${existing.ligne_transport_id},
              ${existing.arret_transport_id},
              ${existing.zone_transport},
              ${effectDate},
              ${impactTarifaire},
              ${existing.statut ?? null},
              ${nextStatus},
              ${JSON.stringify({
                actor_id: actorId,
                old_line_label: existing.ligne?.nom ?? null,
                new_line_label: existing.ligne?.nom ?? null,
                notification_finance: true,
                reason: "Mise a jour de la periode d'usage transport",
                previous_facture_id: existing.facture_id ?? null,
                old_catalogue_frais_id: existing.ligne?.catalogue_frais_id ?? null,
                new_catalogue_frais_id: existing.ligne?.catalogue_frais_id ?? null,
                status_rule: statusRule.code,
                prorata_ratio: newRatio,
                old_prorata_ratio: oldRatio,
                new_prorata_ratio: newRatio,
                old_effective_amount: oldAmount,
                new_effective_amount: newAmount,
                old_date_debut_service: existing.date_debut_service?.toISOString() ?? null,
                old_date_fin_service: existing.date_fin_service?.toISOString() ?? null,
                new_date_debut_service: payload.date_debut_service?.toISOString() ?? null,
                new_date_fin_service: payload.date_fin_service?.toISOString() ?? null,
              })}
              ,
              NOW(),
              NOW()
            )`,
          );
        }

        return tx.abonnementTransport.findUnique({
          where: { id: existing.id },
        });
      });

      Response.success(
        res,
        shouldNotifyFinance
          ? "Periode d'usage mise a jour et transmise a Finance pour regularisation."
          : "Periode d'usage transport mise a jour.",
        result,
      );
    } catch (error) {
      Response.error(res, "Erreur lors de la mise a jour de la periode transport", 400, error as Error);
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
        orderBy:
          req.query.orderBy ??
          JSON.stringify([{ created_at: "desc" }]),
      };
      const result = await getAllPaginated(scopedQuery as typeof req.query, this.abonnementTransport);
      const baseRows = (result?.data ?? []) as Array<{ id: string }>;
      const [data, historyBySubscription] = await Promise.all([
        this.attachFinanceMetadata(baseRows),
        this.getAffectationHistoryRows(baseRows.map((item) => item.id), null),
      ]);
      Response.success(res, "Abonnements transport.", {
        ...result,
        data: data.map((item) => ({
          ...item,
          historiquesAffectation: historyBySubscription.get(item.id) ?? [],
        })),
      });
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation des abonnements transport", 400, error as Error);
      next(error);
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const includeSpec = parseJSON<Record<string, unknown>>(req.query.includeSpec, {});
      const result =
        Object.keys(includeSpec).length > 0
          ? await this.prisma.abonnementTransport.findFirst({
              where: { id: req.params.id, eleve: { is: { etablissement_id: tenantId } } },
              include: includeSpec as never,
            })
          : await this.getScopedRecord(req.params.id, tenantId);
      if (!result) throw new Error("Abonnement transport introuvable.");
      Response.success(res, "Abonnement transport.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la recuperation de l'abonnement transport", 404, error as Error);
      next(error);
    }
  }

  private async update(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = await this.resolveTenantIdForWrite(req);
      const existing = await this.getScopedRecord(req.params.id, tenantId);
      if (!existing) throw new Error("Abonnement transport introuvable.");
      const requestedStatus =
        typeof req.body?.statut === "string" ? req.body.statut.trim().toUpperCase() : null;
      if (existing.facture && (existing.facture.statut ?? "").toUpperCase() !== "ANNULEE") {
        if (requestedStatus === "RESILIE") {
          const result = await this.terminateSubscription(
            tenantId,
            existing,
            (req as Request & { user?: { sub?: string } }).user?.sub ?? null,
          );
          return Response.success(res, "Abonnement transport resilie.", result);
        }
        if (requestedStatus === "SUSPENDU" || requestedStatus === "ACTIF" || requestedStatus === "INACTIF") {
          const result = await this.updateOperationalStatus(req.params.id, requestedStatus);
          return Response.success(res, "Statut operationnel du transport mis a jour.", result);
        }
        this.ensureMutable(existing);
      }
      const data = this.normalizePayload({ ...existing, ...req.body });
      const { annee, lineSettings } = await this.ensureScopedRelations(data, tenantId, req.params.id);
      data.prorata_ratio = this.computeProrataRatioForLine({
        startDate: data.date_debut_service,
        endDate: data.date_fin_service,
        lineSettings,
        schoolYearStart: annee.date_debut,
        schoolYearEnd: annee.date_fin,
      });
      const result = await this.abonnementTransport.update(req.params.id, {
        eleve_id: data.eleve_id,
        annee_scolaire_id: data.annee_scolaire_id,
        ligne_transport_id: data.ligne_transport_id,
        arret_transport_id: data.arret_transport_id,
        statut: data.statut,
      });
      await this.prisma.$executeRaw(
        Prisma.sql`UPDATE abonnements_transport
          SET zone_transport = ${data.zone_transport},
              date_debut_service = ${data.date_debut_service},
              date_fin_service = ${data.date_fin_service},
              prorata_ratio = ${data.prorata_ratio}
          WHERE id = ${req.params.id}`,
      );
      Response.success(res, "Abonnement transport mis a jour.", result);
    } catch (error) {
      Response.error(res, "Erreur lors de la mise a jour de l'abonnement transport", 400, error as Error);
      next(error);
    }
  }

  private async changeLine(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = await this.resolveTenantIdForWrite(req);
      const existing = await this.getScopedRecord(req.params.id, tenantId);
      if (!existing) throw new Error("Abonnement transport introuvable.");
      const payload = this.normalizeChangeLinePayload(req.body as Record<string, unknown>);
      if (
        payload.ligne_transport_id === existing.ligne_transport_id &&
        payload.arret_transport_id === existing.arret_transport_id &&
        payload.zone_transport === (existing.zone_transport ?? "")
      ) {
        throw new Error("La nouvelle affectation transport doit modifier le circuit, l'arret ou la zone.");
      }

      const [newLine, oldLine] = await Promise.all([
        this.prisma.ligneTransport.findFirst({
          where: { id: payload.ligne_transport_id, etablissement_id: tenantId },
          select: {
            id: true,
            nom: true,
            catalogue_frais_id: true,
            infos_vehicule_json: true,
            frais: { select: { montant: true } },
          },
        }),
        this.prisma.ligneTransport.findFirst({
          where: { id: existing.ligne_transport_id, etablissement_id: tenantId },
          select: {
            id: true,
            nom: true,
            catalogue_frais_id: true,
            infos_vehicule_json: true,
            frais: { select: { montant: true } },
          },
        }),
      ]);
      if (!newLine) throw new Error("La nouvelle ligne de transport n'appartient pas a cet etablissement.");
      if (!oldLine) throw new Error("La ligne de transport actuelle est introuvable.");

      const newLineSettings = this.parseLigneTransportSettings(newLine.infos_vehicule_json);
      if (newLineSettings.zones.length === 0) {
        throw new Error("La nouvelle ligne de transport n'a aucune zone parametree.");
      }
      if (!newLineSettings.zones.includes(payload.zone_transport)) {
        throw new Error("La nouvelle zone n'est pas parametree pour la ligne selectionnee.");
      }

      if (payload.arret_transport_id) {
        const arret = await this.prisma.arretTransport.findFirst({
          where: { id: payload.arret_transport_id, ligne_transport_id: payload.ligne_transport_id },
          select: { id: true },
        });
        if (!arret) {
          throw new Error("Le nouvel arret n'appartient pas a la ligne selectionnee.");
        }
      }

      const prorataRatio = this.computeProrataRatioForLine({
        startDate: payload.date_effet,
        endDate: existing.date_fin_service ?? null,
        lineSettings: newLineSettings,
        schoolYearStart: existing.annee?.date_debut ?? null,
        schoolYearEnd: existing.annee?.date_fin ?? null,
      });
      const oldEffectiveAmount = this.resolveTransportAmount({
        ligne: oldLine,
        zone: existing.zone_transport ?? null,
        ratio: prorataRatio,
      });
      const newEffectiveAmount = this.resolveTransportAmount({
        ligne: newLine,
        zone: payload.zone_transport,
        ratio: prorataRatio,
      });
      const impactTarifaire =
        (oldLine.catalogue_frais_id ?? "") !== (newLine.catalogue_frais_id ?? "") ||
        oldEffectiveAmount !== newEffectiveAmount;
      const statusRule = this.getAffectationStatusRule(existing.statut, impactTarifaire);
      const nextStatus = statusRule.nextStatus;
      const shouldNotifyFinance =
        impactTarifaire || Boolean((existing as Record<string, unknown>).a_facturer);
      const actorId = (req as Request & { user?: { sub?: string } }).user?.sub ?? null;

      const result = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw(
          Prisma.sql`UPDATE abonnements_transport
            SET ligne_transport_id = ${payload.ligne_transport_id},
                arret_transport_id = ${payload.arret_transport_id},
                zone_transport = ${payload.zone_transport},
                date_debut_service = ${payload.date_effet},
                prorata_ratio = ${prorataRatio},
                facture_id = ${shouldNotifyFinance ? null : existing.facture_id},
                statut = ${nextStatus},
                a_facturer = ${shouldNotifyFinance}
            WHERE id = ${existing.id}`,
        );

        await tx.$executeRaw(
          Prisma.sql`INSERT INTO historiques_affectation_transport (
            id,
            abonnement_transport_id,
            ancienne_ligne_transport_id,
            ancien_arret_transport_id,
            ancienne_zone_transport,
            nouvelle_ligne_transport_id,
            nouvel_arret_transport_id,
            nouvelle_zone_transport,
            date_effet,
            impact_tarifaire,
            ancien_statut,
            nouveau_statut,
            details_json,
            created_at,
            updated_at
          ) VALUES (
            ${randomUUID()},
            ${existing.id},
            ${existing.ligne_transport_id},
            ${existing.arret_transport_id},
            ${existing.zone_transport},
            ${payload.ligne_transport_id},
            ${payload.arret_transport_id},
            ${payload.zone_transport},
            ${payload.date_effet},
            ${impactTarifaire},
            ${existing.statut ?? null},
            ${nextStatus},
            ${JSON.stringify({
              actor_id: actorId,
              old_line_label: oldLine.nom,
              new_line_label: newLine.nom,
              notification_finance: shouldNotifyFinance,
              previous_facture_id: existing.facture_id ?? null,
              old_catalogue_frais_id: oldLine.catalogue_frais_id ?? null,
              new_catalogue_frais_id: newLine.catalogue_frais_id ?? null,
              prorata_ratio: prorataRatio,
              old_effective_amount: oldEffectiveAmount,
              new_effective_amount: newEffectiveAmount,
              status_rule: statusRule.code,
              reason: impactTarifaire
                ? "IMPACT_TARIFAIRE"
                : "SANS_IMPACT_TARIFAIRE",
            })},
            NOW(),
            NOW()
          )`,
        );

        return tx.abonnementTransport.findUnique({ where: { id: existing.id } });
      });

      Response.success(
        res,
        impactTarifaire
          ? "Affectation transport mise a jour et transmise a Finance pour regularisation."
          : "Affectation transport mise a jour sans impact financier detecte.",
        result,
      );
    } catch (error) {
      Response.error(res, "Erreur lors du changement de circuit transport", 400, error as Error);
      next(error);
    }
  }

  private async delete(req: Request, res: R, next: NextFunction) {
    try {
      const tenantId = this.resolveTenantId(req);
      const existing = await this.getScopedRecord(req.params.id, tenantId);
      if (!existing) throw new Error("Abonnement transport introuvable.");
      const result = await this.terminateSubscription(
        tenantId,
        existing,
        (req as Request & { user?: { sub?: string } }).user?.sub ?? null,
      );
      Response.success(
        res,
        existing.facture_id ? "Abonnement transport resilie et regularise." : "Abonnement transport supprime.",
        result,
      );
    } catch (error) {
      Response.error(res, "Erreur lors de la suppression de l'abonnement transport", 400, error as Error);
      next(error);
    }
  }
}

export default AbonnementTransportApp;
