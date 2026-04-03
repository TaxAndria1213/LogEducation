import { useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiBell,
  FiCalendar,
  FiCreditCard,
  FiDollarSign,
  FiFileText,
  FiLayers,
  FiPercent,
  FiRepeat,
  FiTruck,
} from "react-icons/fi";
import FinanceModuleLayout from "../components/FinanceModuleLayout";
import { FinanceControlBanner, FinanceMetricCard } from "../components/financeUi";
import { hasAccess } from "../../../components/components.build";
import { useAuth } from "../../../hooks/useAuth";
import { useInfo } from "../../../hooks/useInfo";
import CatalogueFraisService, {
  getCatalogueFraisDisplayLabel,
  type CatalogueFraisWithRelations,
} from "../../../services/catalogueFrais.service";
import FactureService, {
  getFactureDisplayLabel,
  getFactureSecondaryLabel,
  getFactureStudentLabel,
  type FactureWithRelations,
} from "../../../services/facture.service";
import PlanPaiementEleveService, {
  getPlanPaiementDisplayLabel,
  getPlanPaiementEcheances,
  getPlanPaiementSecondaryLabel,
  type PlanEcheance,
  type PlanPaiementEleveWithRelations,
} from "../../../services/planPaiementEleve.service";
import PaiementService, {
  getPaiementDisplayLabel,
  getPaiementMethodLabel,
  getPaiementReconciliationStatusLabel,
  getPaiementSecondaryLabel,
  type PaiementWithRelations,
} from "../../../services/paiement.service";
import FinanceRelanceService, {
  type FinanceRelanceHistoryItem,
} from "../../../services/financeRelance.service";
import FacturationRecurrenteService, {
  type FacturationRecurrenteHistoryItem,
  type FacturationRecurrenteReadiness,
} from "../../../services/facturationRecurrente.service";
import RemiseService, {
  getRemiseDisplayLabel,
  getRemiseTypeLabel,
  type RemiseWithRelations,
} from "../../../services/remise.service";
import AbonnementTransportService, {
  getAbonnementTransportDisplayLabel,
  getAbonnementTransportFinanceStatusLabel,
  getTransportControlAnomalyLabel,
  getTransportControlTrackingLabel,
  type AbonnementTransportWithRelations,
  type TransportControlAnomalyRow,
  type TransportControlAnomalySummary,
} from "../../../services/abonnementTransport.service";
import AbonnementCantineService, {
  type AbsenceCantineWithRelations,
  type CantineControlAnomalyRow,
  type CantineControlAnomalySummary,
  type ConsommationCantineWithRelations,
  getCantineAbsenceEventLabel,
  getAbonnementCantineFinanceStatusLabel,
  getAbonnementCantineDisplayLabel,
  getCantineControlAnomalyLabel,
  getCantineControlTrackingLabel,
  type AbonnementCantineWithRelations,
} from "../../../services/abonnementCantine.service";
import { getCantineAbsenceRegularizationModeLabel } from "../../../services/formuleCantine.service";
import NotFound from "../../NotFound";
import type { componentId } from "../../../types/types";

type DashboardEcheance = {
  id: string;
  factureId?: string | null;
  planPaiementId?: string | null;
  eleveLabel: string;
  secondaryLabel: string;
  libelle: string;
  date: string;
  montant: number;
  montantRestant: number;
  devise: string;
  mode: string;
  statut: string;
};

type DashboardOverdueStudent = {
  id: string;
  eleveLabel: string;
  secondaryLabel: string;
  devise: string;
  totalRestant: number;
  echeancesCount: number;
  facturesCount: number;
  oldestDate: string;
};

type DashboardInscriptionRelation = {
  annee_scolaire_id?: string | null;
  classe?: {
    id: string;
    nom?: string | null;
    niveau?: {
      id: string;
      nom?: string | null;
    } | null;
  } | null;
};

type DashboardFactureRecord = FactureWithRelations & {
  eleve?: (NonNullable<FactureWithRelations["eleve"]> & {
    inscriptions?: DashboardInscriptionRelation[] | null;
  }) | null;
};

type DashboardPaiementRecord = PaiementWithRelations & {
  facture?: (NonNullable<PaiementWithRelations["facture"]> & {
    eleve?: {
      id: string;
      code_eleve?: string | null;
      utilisateur?: {
        profil?: {
          prenom?: string | null;
          nom?: string | null;
        } | null;
      } | null;
      inscriptions?: DashboardInscriptionRelation[] | null;
    } | null;
  }) | null;
};

type DashboardDailyReceipt = {
  dayKey: string;
  count: number;
  total: number;
  cash: number;
  bank: number;
  electronic: number;
  family: number;
};

type DashboardChannelSummary = {
  key: string;
  label: string;
  count: number;
  total: number;
};

type DashboardEducationReportRow = {
  key: string;
  label: string;
  niveauLabel?: string;
  totalFacture: number;
  totalEncaisse: number;
  restant: number;
  invoicesCount: number;
  studentsCount: number;
};

type DashboardAgeingBucket = {
  key: string;
  label: string;
  count: number;
  total: number;
};

type TransportHistoryDetails = {
  notification_finance?: boolean;
  reason?: string | null;
  finance_processed_at?: string | null;
};

type FinanceDashboardTab = "synthese" | "retards" | "activite" | "automatisation" | "reporting";

type ServiceBillingRequestRow =
  | {
      kind: "TRANSPORT";
      key: string;
      subscription: AbonnementTransportWithRelations;
      requiresRegularization: boolean;
    }
  | {
      kind: "CANTINE";
      key: string;
      subscription: AbonnementCantineWithRelations;
      requiresRegularization: false;
    };

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "message" in error.response.data &&
    typeof error.response.data.message === "string"
  ) {
    return error.response.data.message;
  }
  return "Impossible de charger le tableau de bord finance.";
}

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function isActivePaiementStatus(value?: string | null) {
  return (value ?? "ENREGISTRE").toUpperCase() === "ENREGISTRE";
}

function formatMoney(value: number, devise = "MGA") {
  return `${value.toLocaleString("fr-FR")} ${devise}`;
}

function formatDate(value?: string | Date | null) {
  if (!value) return "Date non renseignee";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date non renseignee";
  return parsed.toLocaleDateString("fr-FR");
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function diffInDays(from: Date, to: Date) {
  const diff = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function isOverdueEcheance(item: DashboardEcheance, today: Date) {
  if (item.montantRestant <= 0) return false;
  if (item.statut === "PAYEE" || item.statut === "ANNULEE") return false;
  const date = startOfDay(new Date(item.date));
  if (Number.isNaN(date.getTime())) return false;
  return date < today;
}

function toDayKey(value?: string | Date | null) {
  if (!value) return "Sans date";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Sans date";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDayKeyLabel(dayKey: string) {
  if (dayKey === "Sans date") return dayKey;
  return formatDate(`${dayKey}T00:00:00`);
}

function getPaymentChannel(method?: string | null) {
  switch ((method ?? "").toLowerCase()) {
    case "cash":
      return "cash";
    case "famille":
      return "family";
    case "bank":
    case "virement":
    case "cheque":
    case "card":
      return "bank";
    case "mobile_money":
      return "electronic";
    default:
      return "other";
  }
}

function getLatestTransportHistory(item: AbonnementTransportWithRelations) {
  return item.historiquesAffectation?.[0] ?? null;
}

function getTransportHistoryDetails(item: AbonnementTransportWithRelations): TransportHistoryDetails {
  const history = getLatestTransportHistory(item);
  if (!history?.details_json || typeof history.details_json !== "object" || Array.isArray(history.details_json)) {
    return {};
  }
  const raw = history.details_json as Record<string, unknown>;
  return {
    notification_finance: raw.notification_finance === true,
    reason: typeof raw.reason === "string" ? raw.reason : null,
    finance_processed_at:
      typeof raw.finance_processed_at === "string" ? raw.finance_processed_at : null,
  };
}

function extractControlPayload<TRow, TSummary extends object>(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return {
      rows: [] as TRow[],
      summary: {} as Partial<TSummary>,
    };
  }

  const record = payload as Record<string, unknown>;
  const source =
    record.data && typeof record.data === "object" && !Array.isArray(record.data)
      ? (record.data as Record<string, unknown>)
      : record;

  return {
    rows: Array.isArray(source.rows) ? (source.rows as TRow[]) : ([] as TRow[]),
    summary:
      source.summary && typeof source.summary === "object"
        ? (source.summary as Partial<TSummary>)
        : ({} as Partial<TSummary>),
  };
}

function getTransportControlAnomalyTone(code: TransportControlAnomalyRow["code"]) {
  switch (code) {
    case "TRANSPORTE_SANS_DROIT_FINANCIER":
      return "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900";
    case "PAYE_SANS_AFFECTATION_TRANSPORT":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "SUSPENDU_AVEC_USAGE_REEL":
    default:
      return "border-rose-200 bg-rose-50 text-rose-900";
  }
}

function getTransportControlTrackingTone(status: TransportControlAnomalyRow["tracking_status"]) {
  switch (status) {
    case "RESOLUE":
      return "bg-emerald-100 text-emerald-800";
    case "IGNOREE":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-white/70 text-slate-800";
  }
}

function getInscriptionForYear(
  inscriptions?: DashboardInscriptionRelation[] | null,
  anneeId?: string | null,
) {
  if (!Array.isArray(inscriptions) || inscriptions.length === 0) return null;
  const normalizedYear = typeof anneeId === "string" ? anneeId.trim() : "";
  if (normalizedYear) {
    const matching = inscriptions.find(
      (item) => (item?.annee_scolaire_id ?? "").toString().trim() === normalizedYear,
    );
    if (matching) return matching;
  }
  return inscriptions[0] ?? null;
}

function getFactureEducationContext(facture: DashboardFactureRecord) {
  const inscription = getInscriptionForYear(
    facture.eleve?.inscriptions,
    facture.annee?.id ?? facture.annee_scolaire_id,
  );
  return {
    classeId: inscription?.classe?.id ?? null,
    classeLabel: inscription?.classe?.nom?.trim() || "Classe non renseignee",
    niveauId: inscription?.classe?.niveau?.id ?? null,
    niveauLabel: inscription?.classe?.niveau?.nom?.trim() || "Niveau non renseigne",
  };
}

export default function FinanceDashboardIndex() {
  const { user, roles, etablissement_id } = useAuth();
  const { info } = useInfo();
  const [factures, setFactures] = useState<DashboardFactureRecord[]>([]);
  const [paiements, setPaiements] = useState<DashboardPaiementRecord[]>([]);
  const [plans, setPlans] = useState<PlanPaiementEleveWithRelations[]>([]);
  const [catalogueFrais, setCatalogueFrais] = useState<CatalogueFraisWithRelations[]>([]);
  const [remises, setRemises] = useState<RemiseWithRelations[]>([]);
  const [pendingTransportBilling, setPendingTransportBilling] = useState<AbonnementTransportWithRelations[]>([]);
  const [transportSubscriptions, setTransportSubscriptions] = useState<AbonnementTransportWithRelations[]>([]);
  const [transportControlAnomalies, setTransportControlAnomalies] = useState<TransportControlAnomalyRow[]>([]);
  const [transportControlSummary, setTransportControlSummary] = useState<TransportControlAnomalySummary>({
    total: 0,
    transportes_sans_droit_financier: 0,
    payes_sans_affectation_transport: 0,
    suspendus_encore_planifies: 0,
  });
  const [pendingCantineBilling, setPendingCantineBilling] = useState<AbonnementCantineWithRelations[]>([]);
  const [pendingCantineRegularization, setPendingCantineRegularization] = useState<AbonnementCantineWithRelations[]>([]);
  const [pendingCantineSuspension, setPendingCantineSuspension] = useState<AbonnementCantineWithRelations[]>([]);
  const [pendingCantineConsumptionControl, setPendingCantineConsumptionControl] = useState<ConsommationCantineWithRelations[]>([]);
  const [pendingCantineAbsenceRegularization, setPendingCantineAbsenceRegularization] = useState<AbsenceCantineWithRelations[]>([]);
  const [cantineControlAnomalies, setCantineControlAnomalies] = useState<CantineControlAnomalyRow[]>([]);
  const [cantineControlSummary, setCantineControlSummary] = useState<CantineControlAnomalySummary>({
    total: 0,
    repas_sans_autorisation_active: 0,
    payes_sans_consommation: 0,
    consommations_superieures_aux_droits: 0,
  });
  const [relances, setRelances] = useState<FinanceRelanceHistoryItem[]>([]);
  const [facturationsRecurrentes, setFacturationsRecurrentes] = useState<FacturationRecurrenteHistoryItem[]>([]);
  const [recurringReadiness, setRecurringReadiness] = useState<FacturationRecurrenteReadiness | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [sendingRelanceId, setSendingRelanceId] = useState<string | null>(null);
  const [isGeneratingRecurring, setIsGeneratingRecurring] = useState(false);
  const [linkingTransportId, setLinkingTransportId] = useState<string | null>(null);
  const [processingTransportBillingId, setProcessingTransportBillingId] = useState<string | null>(null);
  const [processingCantineBillingId, setProcessingCantineBillingId] = useState<string | null>(null);
  const [processingCantineRegularizationId, setProcessingCantineRegularizationId] = useState<string | null>(null);
  const [signalingCantineSuspensionId, setSignalingCantineSuspensionId] = useState<string | null>(null);
  const [processingCantineConsumptionId, setProcessingCantineConsumptionId] = useState<string | null>(null);
  const [processingCantineAbsenceId, setProcessingCantineAbsenceId] = useState<string | null>(null);
  const [busyTransportAnomalyId, setBusyTransportAnomalyId] = useState<string | null>(null);
  const [busyCantineAnomalyId, setBusyCantineAnomalyId] = useState<string | null>(null);
  const [processingTransportRegularizationId, setProcessingTransportRegularizationId] = useState<string | null>(null);
  const [signalingTransportSuspensionId, setSignalingTransportSuspensionId] = useState<string | null>(null);
  const [transportFactureSelection, setTransportFactureSelection] = useState<Record<string, string>>({});
  const [cantineAbsenceDecisionSelection, setCantineAbsenceDecisionSelection] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<FinanceDashboardTab>("retards");

  const canAccess = useMemo(() => {
    if (!user || !roles) return false;
    return [
      "FIN.CATALOGUEFRAIS.MENUACTION.DASHBOARD",
      "FIN.REMISES.MENUACTION.DASHBOARD",
      "FIN.FACTURES.MENUACTION.DASHBOARD",
      "FIN.PAIEMENTS.MENUACTION.DASHBOARD",
      "FIN.PLANSPAIEMENT.MENUACTION.DASHBOARD",
    ].some((code) => hasAccess(user, roles, code as componentId));
  }, [roles, user]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!etablissement_id || !canAccess) {
        if (active) setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      try {
        const factureService = new FactureService();
        const paiementService = new PaiementService();
        const planService = new PlanPaiementEleveService();
        const catalogueService = new CatalogueFraisService();
        const remiseService = new RemiseService();
        const relanceService = new FinanceRelanceService();
        const recurringService = new FacturationRecurrenteService();
        const transportService = new AbonnementTransportService();
        const cantineService = new AbonnementCantineService();

        const [
          facturesResult,
          paiementsResult,
          plansResult,
          catalogueResult,
          remisesResult,
          relancesResult,
          recurringHistoryResult,
          recurringReadinessResult,
          pendingTransportResult,
          transportSubscriptionsResult,
          transportControlAnomaliesResult,
          pendingCantineResult,
          pendingCantineRegularizationResult,
          pendingCantineSuspensionResult,
          pendingCantineConsumptionControlResult,
          pendingCantineAbsenceRegularizationResult,
          cantineControlAnomaliesResult,
        ] =
          await Promise.all([
            factureService.getForEtablissement(etablissement_id, {
              page: 1,
              take: 500,
              includeSpec: JSON.stringify({
                eleve: {
                  include: {
                    utilisateur: { include: { profil: true } },
                    inscriptions: {
                      include: {
                        classe: {
                          include: {
                            niveau: true,
                          },
                        },
                      },
                    },
                  },
                },
                annee: true,
                lignes: { include: { frais: true } },
                paiements: true,
                echeances: {
                  orderBy: [{ ordre: "asc" }, { date_echeance: "asc" }],
                  include: { affectations: true },
                },
              }),
            }),
            paiementService.getForEtablissement(etablissement_id, {
              page: 1,
              take: 500,
              includeSpec: JSON.stringify({
                facture: {
                  include: {
                    eleve: {
                      include: {
                        utilisateur: { include: { profil: true } },
                        inscriptions: {
                          include: {
                            classe: {
                              include: {
                                niveau: true,
                              },
                            },
                          },
                        },
                      },
                    },
                    annee: true,
                  },
                },
              }),
            }),
            planService.getForEtablissement(etablissement_id, {
              page: 1,
              take: 400,
              includeSpec: JSON.stringify({
                eleve: { include: { utilisateur: { include: { profil: true } } } },
                annee: true,
                remise: true,
                echeances: {
                  orderBy: [{ ordre: "asc" }, { date_echeance: "asc" }],
                },
              }),
            }),
            catalogueService.getForEtablissement(etablissement_id, {
              page: 1,
              take: 200,
            }),
            remiseService.getForEtablissement(etablissement_id, {
              page: 1,
              take: 200,
            }),
            relanceService.getHistory({
              take: 20,
            }),
            recurringService.getHistory({
              take: 20,
            }),
            recurringService.getReadiness({}),
            transportService.getPendingFinanceBilling(etablissement_id),
            transportService.getForEtablissement(etablissement_id, {
              page: 1,
              take: 500,
              includeSpec: JSON.stringify({
                eleve: { include: { utilisateur: { include: { profil: true } } } },
                annee: true,
                ligne: true,
                arret: true,
                facture: true,
              }),
            }),
            transportService.getControlAnomalies(etablissement_id),
            cantineService.getPendingFinanceBilling(etablissement_id),
            cantineService.getPendingFinanceRegularization(etablissement_id),
            cantineService.getPendingFinanceSuspension(etablissement_id),
            cantineService.getPendingFinanceConsumptionControl(etablissement_id),
            cantineService.getPendingFinanceAbsenceRegularization(etablissement_id),
            cantineService.getControlAnomalies(etablissement_id),
          ]);

        if (!active) return;

        setFactures(
          facturesResult?.status.success ? ((facturesResult.data.data as DashboardFactureRecord[]) ?? []) : [],
        );
        setPaiements(
          paiementsResult?.status.success ? ((paiementsResult.data.data as DashboardPaiementRecord[]) ?? []) : [],
        );
        setPlans(
          plansResult?.status.success ? ((plansResult.data.data as PlanPaiementEleveWithRelations[]) ?? []) : [],
        );
        setCatalogueFrais(
          catalogueResult?.status.success
            ? ((catalogueResult.data.data as CatalogueFraisWithRelations[]) ?? [])
            : [],
        );
        setRemises(
          remisesResult?.status.success ? ((remisesResult.data.data as RemiseWithRelations[]) ?? []) : [],
        );
        setPendingTransportBilling(
          pendingTransportResult?.status.success
            ? ((pendingTransportResult.data as AbonnementTransportWithRelations[]) ?? [])
            : [],
        );
        setTransportSubscriptions(
          transportSubscriptionsResult?.status.success
            ? ((transportSubscriptionsResult.data.data as AbonnementTransportWithRelations[]) ?? [])
            : [],
        );
        const transportAnomaliesPayload = extractControlPayload<
          TransportControlAnomalyRow,
          TransportControlAnomalySummary
        >(transportControlAnomaliesResult?.status.success ? transportControlAnomaliesResult.data : null);
        setTransportControlAnomalies(transportAnomaliesPayload.rows);
        setTransportControlSummary({
          total: transportAnomaliesPayload.summary?.total ?? 0,
          transportes_sans_droit_financier:
            transportAnomaliesPayload.summary?.transportes_sans_droit_financier ?? 0,
          payes_sans_affectation_transport:
            transportAnomaliesPayload.summary?.payes_sans_affectation_transport ?? 0,
          suspendus_encore_planifies:
            transportAnomaliesPayload.summary?.suspendus_encore_planifies ?? 0,
        });
        setPendingCantineBilling(
          pendingCantineResult?.status.success
            ? ((pendingCantineResult.data as AbonnementCantineWithRelations[]) ?? [])
            : [],
        );
        setPendingCantineRegularization(
          pendingCantineRegularizationResult?.status.success
            ? ((pendingCantineRegularizationResult.data as AbonnementCantineWithRelations[]) ?? [])
            : [],
        );
        setPendingCantineSuspension(
          pendingCantineSuspensionResult?.status.success
            ? ((pendingCantineSuspensionResult.data as AbonnementCantineWithRelations[]) ?? [])
            : [],
        );
        setPendingCantineConsumptionControl(
          pendingCantineConsumptionControlResult?.status.success
            ? ((pendingCantineConsumptionControlResult.data as ConsommationCantineWithRelations[]) ?? [])
            : [],
        );
        setPendingCantineAbsenceRegularization(
          pendingCantineAbsenceRegularizationResult?.status.success
            ? ((pendingCantineAbsenceRegularizationResult.data as AbsenceCantineWithRelations[]) ?? [])
            : [],
        );
        const cantineAnomaliesPayload = extractControlPayload<
          CantineControlAnomalyRow,
          CantineControlAnomalySummary
        >(cantineControlAnomaliesResult?.status.success ? cantineControlAnomaliesResult.data : null);
        setCantineControlAnomalies(cantineAnomaliesPayload.rows);
        setCantineControlSummary({
          total: cantineAnomaliesPayload?.summary?.total ?? 0,
          repas_sans_autorisation_active:
            cantineAnomaliesPayload?.summary?.repas_sans_autorisation_active ?? 0,
          payes_sans_consommation: cantineAnomaliesPayload?.summary?.payes_sans_consommation ?? 0,
          consommations_superieures_aux_droits:
            cantineAnomaliesPayload?.summary?.consommations_superieures_aux_droits ?? 0,
        });
        setRelances(
          relancesResult?.status.success
            ? ((relancesResult.data as FinanceRelanceHistoryItem[]) ?? [])
            : [],
        );
        setFacturationsRecurrentes(
          recurringHistoryResult?.status.success
            ? ((recurringHistoryResult.data as FacturationRecurrenteHistoryItem[]) ?? [])
            : [],
        );
        setRecurringReadiness(
          recurringReadinessResult?.status.success
            ? ((recurringReadinessResult.data as FacturationRecurrenteReadiness) ?? null)
            : null,
        );
      } catch (error) {
        if (!active) return;
        setErrorMessage(getErrorMessage(error));
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [canAccess, etablissement_id]);

  const totalFacture = useMemo(
    () =>
      factures
        .filter((item) => (item.statut ?? "").toUpperCase() !== "ANNULEE")
        .reduce((sum, item) => sum + toNumber(item.total_montant), 0),
    [factures],
  );

  const totalEncaisse = useMemo(
    () =>
      paiements
        .filter((item) => isActivePaiementStatus(item.statut))
        .reduce((sum, item) => sum + toNumber(item.montant), 0),
    [paiements],
  );
  const activePaiementsCount = useMemo(
    () => paiements.filter((item) => isActivePaiementStatus(item.statut)).length,
    [paiements],
  );
  const reversedPaiementsCount = useMemo(
    () => paiements.filter((item) => !isActivePaiementStatus(item.statut)).length,
    [paiements],
  );

  const partiallyPaidInvoices = useMemo(
    () => factures.filter((item) => (item.statut ?? "").toUpperCase() === "PARTIELLE").length,
    [factures],
  );

  // const paidInvoices = useMemo(
  //   () => factures.filter((item) => (item.statut ?? "").toUpperCase() === "PAYEE").length,
  //   [factures],
  // );

  // const collectionRate = totalFacture > 0 ? Math.min(100, (totalEncaisse / totalFacture) * 100) : 0;

  const echeances = useMemo<DashboardEcheance[]>(() => {
    const factureRows = factures.flatMap((facture) =>
      (facture.echeances ?? []).map((echeance, index) => ({
        id: echeance.id,
        factureId: facture.id,
        planPaiementId: echeance.plan_paiement_id ?? null,
        eleveLabel: getFactureStudentLabel(facture),
        secondaryLabel: getFactureSecondaryLabel(facture),
        libelle: echeance.libelle?.trim() || `Tranche ${Number(echeance.ordre ?? index + 1)}`,
        date:
          echeance.date_echeance instanceof Date
            ? echeance.date_echeance.toISOString()
            : String(echeance.date_echeance),
        montant: toNumber(echeance.montant_prevu),
        montantRestant: Math.max(0, toNumber(echeance.montant_restant)),
        devise: (echeance.devise ?? facture.devise ?? "MGA").toString(),
        mode: echeance.plan_paiement_id ? "ECHELONNE" : "FACTURE",
        statut: (echeance.statut ?? "A_VENIR").toString().toUpperCase(),
      })),
    );

    const planOnlyRows = plans.flatMap((plan) => {
      const devise = plan.plan_json?.devise ?? "MGA";
      const mode = (plan.plan_json?.mode_paiement ?? "NON_RENSEIGNE").toString();
      const eleveLabel = getPlanPaiementDisplayLabel(plan);
      const secondaryLabel = getPlanPaiementSecondaryLabel(plan);
      return getPlanPaiementEcheances(plan)
        .filter((echeance: PlanEcheance) => !echeance.facture_id)
        .map((echeance: PlanEcheance, index) => ({
          id: echeance.id ?? `${plan.id}-${index}`,
          factureId: null,
          planPaiementId: plan.id,
          eleveLabel,
          secondaryLabel,
          libelle: echeance.libelle?.trim() || `Tranche ${index + 1}`,
          date: echeance.date,
          montant: toNumber(echeance.montant),
          montantRestant: Math.max(0, toNumber(echeance.remaining_amount ?? echeance.montant ?? 0)),
          devise,
          mode,
          statut: (echeance.statut ?? "A_VENIR").toString().toUpperCase(),
        }));
    });

    return [...factureRows, ...planOnlyRows];
  }, [factures, plans]);

  const openEcheances = useMemo(
    () =>
      echeances.filter(
        (item) =>
          item.montantRestant > 0 &&
          item.statut !== "PAYEE" &&
          item.statut !== "ANNULEE",
      ),
    [echeances],
  );

  const today = useMemo(() => startOfDay(new Date()), []);
  const nextThirtyDays = useMemo(() => addDays(today, 30), [today]);

  const overdueEcheances = useMemo(
    () =>
      openEcheances
        .filter((item) => isOverdueEcheance(item, today))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [openEcheances, today],
  );

  const impactedOverdueInvoices = useMemo(
    () => new Set(overdueEcheances.map((item) => item.factureId).filter(Boolean)).size,
    [overdueEcheances],
  );

  const overdueStudents = useMemo<DashboardOverdueStudent[]>(() => {
    const grouped = new Map<string, DashboardOverdueStudent>();

    overdueEcheances.forEach((item) => {
      const key = `${item.eleveLabel}__${item.secondaryLabel}`;
      const current = grouped.get(key);

      if (!current) {
        grouped.set(key, {
          id: key,
          eleveLabel: item.eleveLabel,
          secondaryLabel: item.secondaryLabel,
          devise: item.devise,
          totalRestant: item.montantRestant,
          echeancesCount: 1,
          facturesCount: item.factureId ? 1 : 0,
          oldestDate: item.date,
        });
        return;
      }

      current.totalRestant += item.montantRestant;
      current.echeancesCount += 1;
      if (item.factureId) {
        current.facturesCount += 1;
      }
      if (new Date(item.date).getTime() < new Date(current.oldestDate).getTime()) {
        current.oldestDate = item.date;
      }
    });

    return [...grouped.values()].sort(
      (a, b) =>
        b.totalRestant - a.totalRestant ||
        new Date(a.oldestDate).getTime() - new Date(b.oldestDate).getTime(),
    );
  }, [overdueEcheances]);

  const resteARecouvrer = useMemo(
    () => openEcheances.reduce((sum, item) => sum + item.montantRestant, 0),
    [openEcheances],
  );

  const upcomingEcheances = useMemo(
    () =>
      openEcheances
        .filter((item) => {
          const date = startOfDay(new Date(item.date));
          return (
            !Number.isNaN(date.getTime()) &&
            date >= today &&
            date <= nextThirtyDays &&
            !isOverdueEcheance(item, today)
          );
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [nextThirtyDays, openEcheances, today],
  );

  const recentFactures = useMemo(
    () =>
      [...factures]
        .sort(
          (a, b) =>
            new Date(b.date_emission ?? b.created_at ?? 0).getTime() -
            new Date(a.date_emission ?? a.created_at ?? 0).getTime(),
        )
        .slice(0, 6),
    [factures],
  );

  const recentPaiements = useMemo(
    () =>
      [...paiements]
        .sort(
          (a, b) =>
            new Date(b.paye_le ?? b.created_at ?? 0).getTime() - new Date(a.paye_le ?? a.created_at ?? 0).getTime(),
        )
        .slice(0, 6),
    [paiements],
  );

  const topFrais = useMemo(() => {
    const usage = new Map<string, { label: string; count: number; montant: number }>();
    factures.forEach((facture) => {
      facture.lignes?.forEach((ligne) => {
        const label = ligne.frais?.nom?.trim() || ligne.libelle?.trim() || "Ligne sans libelle";
        const current = usage.get(label) ?? { label, count: 0, montant: 0 };
        current.count += 1;
        current.montant += toNumber(ligne.montant);
        usage.set(label, current);
      });
    });
    return [...usage.values()].sort((a, b) => b.count - a.count || b.montant - a.montant).slice(0, 5);
  }, [factures]);

  const recurrentFraisCount = useMemo(
    () => catalogueFrais.filter((item) => Boolean(item.est_recurrent)).length,
    [catalogueFrais],
  );

  const transportBillingCandidates = useMemo(() => {
    const grouped = new Map<string, FactureWithRelations[]>();

    pendingTransportBilling.forEach((item) => {
      const key = `${item.eleve_id}::${item.annee_scolaire_id}`;
      const matching = factures.filter(
        (facture) =>
          facture.eleve_id === item.eleve_id &&
          facture.annee_scolaire_id === item.annee_scolaire_id &&
          (facture.statut ?? "").toUpperCase() !== "ANNULEE",
      );
      grouped.set(key, matching);
    });

    return grouped;
  }, [factures, pendingTransportBilling]);

  const serviceBillingRequests = useMemo<ServiceBillingRequestRow[]>(() => {
    const transportRequests: ServiceBillingRequestRow[] = pendingTransportBilling.map((item) => {
      const history = getLatestTransportHistory(item);
      const historyDetails = getTransportHistoryDetails(item);
      const requiresRegularization =
        history?.impact_tarifaire === true &&
        historyDetails.notification_finance === true &&
        !historyDetails.finance_processed_at;
      return {
        kind: "TRANSPORT",
        key: `transport::${item.id}`,
        subscription: item,
        requiresRegularization,
      };
    });

    const cantineRequests: ServiceBillingRequestRow[] = pendingCantineBilling.map((item) => ({
      kind: "CANTINE",
      key: `cantine::${item.id}`,
      subscription: item,
      requiresRegularization: false,
    }));

    return [...transportRequests, ...cantineRequests].sort((left, right) => {
      const leftLabel =
        left.kind === "TRANSPORT"
          ? getAbonnementTransportDisplayLabel(left.subscription)
          : getAbonnementCantineDisplayLabel(left.subscription);
      const rightLabel =
        right.kind === "TRANSPORT"
          ? getAbonnementTransportDisplayLabel(right.subscription)
          : getAbonnementCantineDisplayLabel(right.subscription);
      return leftLabel.localeCompare(rightLabel);
    });
  }, [pendingTransportBilling, pendingCantineBilling]);

  const transportSuspensionCandidates = useMemo(
    () =>
      transportSubscriptions.filter((item) => {
        const status = (item.statut ?? "").toUpperCase();
        const financeStatus = (item.finance_status ?? "").toUpperCase();
        const history = getLatestTransportHistory(item);
        const historyDetails = getTransportHistoryDetails(item);
        const regularizationPending =
          history?.impact_tarifaire === true &&
          historyDetails.notification_finance === true &&
          !historyDetails.finance_processed_at;
        if (["RESILIE", "ANNULE", "INACTIF"].includes(status)) return false;
        if (["SUSPENDU_FINANCE", "EN_ATTENTE_SUSPENSION_FINANCIERE"].includes(status)) return false;
        return ["EN_ATTENTE_REGLEMENT", "PARTIELLEMENT_REGLE", "IMPAYE"].includes(financeStatus) || regularizationPending;
      }),
    [transportSubscriptions],
  );

  const totalServiceControlAnomalies = useMemo(
    () => transportControlSummary.total + cantineControlSummary.total,
    [transportControlSummary.total, cantineControlSummary.total],
  );

  const remiseStats = useMemo(
    () => ({
      percent: remises.filter((item) => (item.type ?? "").toUpperCase() === "PERCENT").length,
      fixed: remises.filter((item) => (item.type ?? "").toUpperCase() === "FIXED").length,
    }),
    [remises],
  );

  const recentRelances = useMemo(
    () =>
      [...relances]
        .sort(
          (a, b) =>
            new Date(b.envoye_le ?? 0).getTime() -
            new Date(a.envoye_le ?? 0).getTime(),
        )
        .slice(0, 6),
    [relances],
  );

  const recentRecurringRuns = useMemo(
    () =>
      [...facturationsRecurrentes]
        .sort(
          (a, b) =>
            new Date(b.created_at ?? 0).getTime() -
            new Date(a.created_at ?? 0).getTime(),
        )
        .slice(0, 6),
    [facturationsRecurrentes],
  );

  const standardFactures = useMemo(
    () =>
      factures.filter(
        (item) =>
          (item.nature ?? "FACTURE").toUpperCase() !== "AVOIR" &&
          (item.statut ?? "").toUpperCase() !== "ANNULEE",
      ),
    [factures],
  );

  const dailyReceipts = useMemo<DashboardDailyReceipt[]>(() => {
    const grouped = new Map<string, DashboardDailyReceipt>();

    paiements
      .filter((item) => isActivePaiementStatus(item.statut))
      .forEach((item) => {
        const dayKey = toDayKey(item.paye_le ?? item.created_at ?? null);
        const current = grouped.get(dayKey) ?? {
          dayKey,
          count: 0,
          total: 0,
          cash: 0,
          bank: 0,
          electronic: 0,
          family: 0,
        };
        const amount = toNumber(item.montant);
        current.count += 1;
        current.total += amount;
        switch (getPaymentChannel(item.methode)) {
          case "cash":
            current.cash += amount;
            break;
          case "bank":
            current.bank += amount;
            break;
          case "electronic":
            current.electronic += amount;
            break;
          case "family":
            current.family += amount;
            break;
          default:
            break;
        }
        grouped.set(dayKey, current);
      });

    return [...grouped.values()]
      .sort((a, b) => b.dayKey.localeCompare(a.dayKey))
      .slice(0, 10);
  }, [paiements]);

  const paymentChannelStats = useMemo<DashboardChannelSummary[]>(() => {
    const grouped = new Map<string, DashboardChannelSummary>([
      ["cash", { key: "cash", label: "Caisse", count: 0, total: 0 }],
      ["bank", { key: "bank", label: "Banque", count: 0, total: 0 }],
      ["electronic", { key: "electronic", label: "Electronique", count: 0, total: 0 }],
      ["family", { key: "family", label: "Paiement famille", count: 0, total: 0 }],
    ]);

    paiements
      .filter((item) => isActivePaiementStatus(item.statut))
      .forEach((item) => {
        const key = getPaymentChannel(item.methode);
        const current = grouped.get(key);
        if (!current) return;
        current.count += 1;
        current.total += toNumber(item.montant);
      });

    return [...grouped.values()].sort((a, b) => b.total - a.total || b.count - a.count);
  }, [paiements]);

  const reconciliationStats = useMemo<DashboardChannelSummary[]>(() => {
    const grouped = new Map<string, DashboardChannelSummary>([
      ["Rapproche", { key: "Rapproche", label: "Rapproches", count: 0, total: 0 }],
      ["En attente", { key: "En attente", label: "En attente", count: 0, total: 0 }],
      ["Non renseigne", { key: "Non renseigne", label: "Non renseignes", count: 0, total: 0 }],
    ]);

    paiements.forEach((item) => {
      const status = getPaiementReconciliationStatusLabel(item);
      const current = grouped.get(status);
      if (!current) return;
      current.count += 1;
      current.total += isActivePaiementStatus(item.statut) ? toNumber(item.montant) : 0;
    });

    return [...grouped.values()].sort((a, b) => b.total - a.total || b.count - a.count);
  }, [paiements]);

  const classFinancialRows = useMemo<DashboardEducationReportRow[]>(() => {
    const grouped = new Map<string, DashboardEducationReportRow & { studentIds: Set<string> }>();

    standardFactures.forEach((facture) => {
      const context = getFactureEducationContext(facture);
      const key = context.classeId ?? `classe:${context.classeLabel}`;
      const activePaidAmount = (facture.paiements ?? [])
        .filter((item) => isActivePaiementStatus(item.statut))
        .reduce((sum, item) => sum + toNumber(item.montant), 0);
      const totalFactureAmount = toNumber(facture.total_montant);
      const current =
        grouped.get(key) ??
        {
          key,
          label: context.classeLabel,
          niveauLabel: context.niveauLabel,
          totalFacture: 0,
          totalEncaisse: 0,
          restant: 0,
          invoicesCount: 0,
          studentsCount: 0,
          studentIds: new Set<string>(),
        };

      current.totalFacture += totalFactureAmount;
      current.totalEncaisse += activePaidAmount;
      current.restant += Math.max(0, totalFactureAmount - activePaidAmount);
      current.invoicesCount += 1;
      current.studentIds.add(facture.eleve_id);
      grouped.set(key, current);
    });

    return [...grouped.values()]
      .map(({ studentIds, ...item }) => ({
        ...item,
        studentsCount: studentIds.size,
      }))
      .sort((a, b) => b.restant - a.restant || b.totalFacture - a.totalFacture)
      .slice(0, 8);
  }, [standardFactures]);

  const levelFinancialRows = useMemo<DashboardEducationReportRow[]>(() => {
    const grouped = new Map<string, DashboardEducationReportRow & { studentIds: Set<string> }>();

    standardFactures.forEach((facture) => {
      const context = getFactureEducationContext(facture);
      const key = context.niveauId ?? `niveau:${context.niveauLabel}`;
      const activePaidAmount = (facture.paiements ?? [])
        .filter((item) => isActivePaiementStatus(item.statut))
        .reduce((sum, item) => sum + toNumber(item.montant), 0);
      const totalFactureAmount = toNumber(facture.total_montant);
      const current =
        grouped.get(key) ??
        {
          key,
          label: context.niveauLabel,
          totalFacture: 0,
          totalEncaisse: 0,
          restant: 0,
          invoicesCount: 0,
          studentsCount: 0,
          studentIds: new Set<string>(),
        };

      current.totalFacture += totalFactureAmount;
      current.totalEncaisse += activePaidAmount;
      current.restant += Math.max(0, totalFactureAmount - activePaidAmount);
      current.invoicesCount += 1;
      current.studentIds.add(facture.eleve_id);
      grouped.set(key, current);
    });

    return [...grouped.values()]
      .map(({ studentIds, ...item }) => ({
        ...item,
        studentsCount: studentIds.size,
      }))
      .sort((a, b) => b.restant - a.restant || b.totalFacture - a.totalFacture)
      .slice(0, 8);
  }, [standardFactures]);

  const ageingBuckets = useMemo<DashboardAgeingBucket[]>(() => {
    const buckets: Array<DashboardAgeingBucket & { minDays: number; maxDays: number | null }> = [
      { key: "1-30", label: "1 a 30 jours", minDays: 1, maxDays: 30, count: 0, total: 0 },
      { key: "31-60", label: "31 a 60 jours", minDays: 31, maxDays: 60, count: 0, total: 0 },
      { key: "61-90", label: "61 a 90 jours", minDays: 61, maxDays: 90, count: 0, total: 0 },
      { key: "90+", label: "90+ jours", minDays: 91, maxDays: null, count: 0, total: 0 },
    ];

    overdueEcheances.forEach((item) => {
      const lateDays = diffInDays(new Date(item.date), today);
      const bucket = buckets.find(
        (candidate) =>
          lateDays >= candidate.minDays &&
          (candidate.maxDays === null || lateDays <= candidate.maxDays),
      );
      if (!bucket) return;
      bucket.count += 1;
      bucket.total += item.montantRestant;
    });

    return buckets;
  }, [overdueEcheances, today]);

  const handleSendRelance = async (echeance: DashboardEcheance) => {
    try {
      setSendingRelanceId(echeance.id);
      const relanceService = new FinanceRelanceService();
      const result = await relanceService.sendRelance({
        echeance_ids: [echeance.id],
      });

      if (!result?.status?.success) {
        throw new Error(result?.status?.message ?? "Impossible d'envoyer la relance.");
      }

      const sent = ((result.data?.sent ?? []) as FinanceRelanceHistoryItem[]).filter(Boolean);
      if (sent.length > 0) {
        setRelances((current) => {
          const next = [...sent, ...current];
          const deduped = new Map(next.map((item) => [item.id, item]));
          return [...deduped.values()];
        });
      }

      info("La relance financiere a ete envoyee.", "success");
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setSendingRelanceId(null);
    }
  };

  const handleGenerateRecurring = async () => {
    try {
      setIsGeneratingRecurring(true);
      const service = new FacturationRecurrenteService();
      const readiness = await service.getReadiness({});
      if (!readiness?.status?.success) {
        throw new Error("Impossible de verifier la preparation de la facturation recurrente.");
      }
      const readinessData = readiness.data as FacturationRecurrenteReadiness;
      setRecurringReadiness(readinessData);
      if (!readinessData.ready) {
        throw new Error(
          readinessData.issues
            .filter((item) => item.severity === "error")
            .map((item) => item.message)
            .join(" "),
        );
      }
      const result = await service.generate({
        date_reference: today,
      });

      if (!result?.status?.success) {
        throw new Error(result?.status?.message ?? "Impossible de generer la facturation recurrente.");
      }

      const history = await service.getHistory({ take: 20 });
      if (history?.status?.success) {
        setFacturationsRecurrentes(
          Array.isArray(history.data) ? (history.data as FacturationRecurrenteHistoryItem[]) : [],
        );
      }
      const refreshedReadiness = await service.getReadiness({});
      if (refreshedReadiness?.status?.success) {
        setRecurringReadiness(refreshedReadiness.data as FacturationRecurrenteReadiness);
      }

      const createdCount = Array.isArray(result.data?.created) ? result.data.created.length : 0;
      const skippedCount = Array.isArray(result.data?.skipped) ? result.data.skipped.length : 0;
      info(
        `Facturation recurrente lancee: ${createdCount} facture(s) creee(s), ${skippedCount} ignoree(s).`,
        "success",
      );
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setIsGeneratingRecurring(false);
    }
  };

  // const financeRoleNames = (roles ?? [])
  //   .map((assignment) => assignment.role?.nom?.trim())
  //   .filter(Boolean) as string[];

  // const financePersonaLabel =
  //   financeRoleNames.find((roleName) =>
  //     ["DIRECTION", "COMPTABLE", "CAISSIER", "SECRETAIRE", "AUDITEUR"].includes(roleName.toUpperCase()),
  //   ) ?? "Equipe finance";

  const pendingReconciliationCount = reconciliationStats
    .filter((item) => item.key !== "Rapproche")
    .reduce((sum, item) => sum + item.count, 0);

  const dashboardViews = [
    { id: "synthese", label: "Synthese", helper: `${openEcheances.length} ouvertes`, onClick: () => setActiveTab("synthese"), active: activeTab === "synthese" },
    { id: "retards", label: "Retards", helper: `${overdueStudents.length} eleves`, onClick: () => setActiveTab("retards"), active: activeTab === "retards", tone: overdueEcheances.length > 0 ? ("primary" as const) : undefined },
    { id: "activite", label: "Activite", helper: `${recentPaiements.length} paiements`, onClick: () => setActiveTab("activite"), active: activeTab === "activite" },
    { id: "reporting", label: "Reporting", helper: `${dailyReceipts.length} jour(s)`, onClick: () => setActiveTab("reporting"), active: activeTab === "reporting" },
    { id: "automatisation", label: "Automatisation", helper: `${recurrentFraisCount} recurrents`, onClick: () => setActiveTab("automatisation"), active: activeTab === "automatisation" },
  ];

  const refreshTransportFinanceData = async () => {
    const service = new AbonnementTransportService();
    const [refreshedPending, refreshedSubscriptions, refreshedAnomalies] = await Promise.all([
      service.getPendingFinanceBilling(etablissement_id ?? ""),
      service.getForEtablissement(etablissement_id ?? "", {
        page: 1,
        take: 500,
        includeSpec: JSON.stringify({
          eleve: { include: { utilisateur: { include: { profil: true } } } },
          annee: true,
          ligne: true,
          arret: true,
          facture: true,
        }),
      }),
      service.getControlAnomalies(etablissement_id ?? ""),
    ]);
    setPendingTransportBilling(
      refreshedPending?.status.success
        ? ((refreshedPending.data as AbonnementTransportWithRelations[]) ?? [])
        : [],
    );
    setTransportSubscriptions(
      refreshedSubscriptions?.status.success
        ? ((refreshedSubscriptions.data.data as AbonnementTransportWithRelations[]) ?? [])
        : [],
    );
    const anomaliesPayload = extractControlPayload<
      TransportControlAnomalyRow,
      TransportControlAnomalySummary
    >(refreshedAnomalies?.status.success ? refreshedAnomalies.data : null);
    setTransportControlAnomalies(anomaliesPayload.rows);
    setTransportControlSummary({
      total: anomaliesPayload.summary?.total ?? 0,
      transportes_sans_droit_financier:
        anomaliesPayload.summary?.transportes_sans_droit_financier ?? 0,
      payes_sans_affectation_transport:
        anomaliesPayload.summary?.payes_sans_affectation_transport ?? 0,
      suspendus_encore_planifies: anomaliesPayload.summary?.suspendus_encore_planifies ?? 0,
    });
  };

  const refreshCantineFinanceData = async () => {
    const service = new AbonnementCantineService();
    const [
      refreshedPending,
      refreshedRegularization,
      refreshedSuspension,
      refreshedConsumptionControl,
      refreshedAbsenceRegularization,
      refreshedAnomalies,
    ] = await Promise.all([
      service.getPendingFinanceBilling(etablissement_id ?? ""),
      service.getPendingFinanceRegularization(etablissement_id ?? ""),
      service.getPendingFinanceSuspension(etablissement_id ?? ""),
      service.getPendingFinanceConsumptionControl(etablissement_id ?? ""),
      service.getPendingFinanceAbsenceRegularization(etablissement_id ?? ""),
      service.getControlAnomalies(etablissement_id ?? ""),
    ]);
    setPendingCantineBilling(
      refreshedPending?.status.success
        ? ((refreshedPending.data as AbonnementCantineWithRelations[]) ?? [])
        : [],
    );
    setPendingCantineRegularization(
      refreshedRegularization?.status.success
        ? ((refreshedRegularization.data as AbonnementCantineWithRelations[]) ?? [])
        : [],
    );
    setPendingCantineSuspension(
      refreshedSuspension?.status.success
        ? ((refreshedSuspension.data as AbonnementCantineWithRelations[]) ?? [])
        : [],
    );
    setPendingCantineConsumptionControl(
      refreshedConsumptionControl?.status.success
        ? ((refreshedConsumptionControl.data as ConsommationCantineWithRelations[]) ?? [])
        : [],
    );
    setPendingCantineAbsenceRegularization(
      refreshedAbsenceRegularization?.status.success
        ? ((refreshedAbsenceRegularization.data as AbsenceCantineWithRelations[]) ?? [])
        : [],
    );
    const anomaliesPayload = extractControlPayload<
      CantineControlAnomalyRow,
      CantineControlAnomalySummary
    >(refreshedAnomalies?.status.success ? refreshedAnomalies.data : null);
    setCantineControlAnomalies(anomaliesPayload.rows);
    setCantineControlSummary({
      total: anomaliesPayload?.summary?.total ?? 0,
      repas_sans_autorisation_active: anomaliesPayload?.summary?.repas_sans_autorisation_active ?? 0,
      payes_sans_consommation: anomaliesPayload?.summary?.payes_sans_consommation ?? 0,
      consommations_superieures_aux_droits:
        anomaliesPayload?.summary?.consommations_superieures_aux_droits ?? 0,
    });
  };

  const handleLinkTransportFacture = async (item: AbonnementTransportWithRelations) => {
    const factureId = transportFactureSelection[item.id];
    if (!factureId) {
      info("Selectionne d'abord une facture Finance pour ce service transport.", "error");
      return;
    }

    try {
      setLinkingTransportId(item.id);
      await new AbonnementTransportService().linkFinanceFacture(item.id, factureId);
      info("Service transport rattache a la facture selectionnee.", "success");
      setTransportFactureSelection((current) => ({ ...current, [item.id]: "" }));
      await refreshTransportFinanceData();
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setLinkingTransportId(null);
    }
  };

  const handleProcessTransportRegularization = async (item: AbonnementTransportWithRelations) => {
    try {
      setProcessingTransportRegularizationId(item.id);
      await new AbonnementTransportService().processFinanceRegularization(item.id);
      info("Regularisation transport generee par Finance.", "success");
      await refreshTransportFinanceData();
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setProcessingTransportRegularizationId(null);
    }
  };

  const handleProcessTransportBilling = async (item: AbonnementTransportWithRelations) => {
    try {
      setProcessingTransportBillingId(item.id);
      await new AbonnementTransportService().processFinanceBilling(item.id);
      info("Facturation transport generee par Finance.", "success");
      await refreshTransportFinanceData();
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setProcessingTransportBillingId(null);
    }
  };

  const handleProcessCantineBilling = async (item: AbonnementCantineWithRelations) => {
    try {
      setProcessingCantineBillingId(item.id);
      await new AbonnementCantineService().processFinanceBilling(item.id);
      info("Facturation cantine generee par Finance.", "success");
      await refreshCantineFinanceData();
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setProcessingCantineBillingId(null);
    }
  };

  const handleProcessCantineRegularization = async (item: AbonnementCantineWithRelations) => {
    try {
      setProcessingCantineRegularizationId(item.id);
      await new AbonnementCantineService().processFinanceRegularization(item.id);
      info("Regularisation cantine generee par Finance.", "success");
      await refreshCantineFinanceData();
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setProcessingCantineRegularizationId(null);
    }
  };

  const handleSignalCantineSuspension = async (item: AbonnementCantineWithRelations) => {
    try {
      setSignalingCantineSuspensionId(item.id);
      await new AbonnementCantineService().signalFinanceSuspension(item.id, {
        source: "FINANCE_DASHBOARD",
        motif: "Impaye ou autorisation refusee signale depuis Finance",
        finance_status: item.finance_status ?? null,
      });
      info("Suspension cantine signalee au module Cantine.", "success");
      await refreshCantineFinanceData();
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setSignalingCantineSuspensionId(null);
    }
  };

  const handleProcessCantineConsumptionControl = async (item: ConsommationCantineWithRelations) => {
    try {
      setProcessingCantineConsumptionId(item.id);
      await new AbonnementCantineService().processFinanceConsumptionControl(item.id);
      info("Consommation cantine controlee par Finance.", "success");
      await refreshCantineFinanceData();
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setProcessingCantineConsumptionId(null);
    }
  };

  const handleProcessCantineAbsenceRegularization = async (item: AbsenceCantineWithRelations) => {
    try {
      setProcessingCantineAbsenceId(item.id);
      const decision =
        cantineAbsenceDecisionSelection[item.id] ??
        item.mode_regularisation_suggere ??
        "AVOIR";
      await new AbonnementCantineService().processFinanceAbsenceRegularization(item.id, {
        decision_finance: decision as
          | "AVOIR"
          | "REPORT"
          | "REMBOURSEMENT"
          | "AJUSTEMENT"
          | "REFUS_REGULARISATION",
      });
      info("Regularisation d'absence cantine traitee par Finance.", "success");
      await refreshCantineFinanceData();
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setProcessingCantineAbsenceId(null);
    }
  };

  const handleMarkCantineAnomaly = async (
    item: CantineControlAnomalyRow,
    decision: "RESOLVED" | "IGNORED",
  ) => {
    try {
      setBusyCantineAnomalyId(item.anomaly_id);
      await new AbonnementCantineService().markControlAnomaly(etablissement_id ?? "", {
        anomaly_id: item.anomaly_id,
        decision,
      });
      info(
        decision === "RESOLVED"
          ? "Anomalie cantine marquee comme resolue."
          : "Anomalie cantine ignoree.",
        "success",
      );
      await refreshCantineFinanceData();
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setBusyCantineAnomalyId(null);
    }
  };

  const handleMarkTransportAnomaly = async (
    item: TransportControlAnomalyRow,
    decision: "RESOLVED" | "IGNORED",
  ) => {
    try {
      setBusyTransportAnomalyId(item.anomaly_id);
      await new AbonnementTransportService().markControlAnomaly(etablissement_id ?? "", {
        anomaly_id: item.anomaly_id,
        decision,
      });
      info(
        decision === "RESOLVED"
          ? "Anomalie transport marquee comme resolue."
          : "Anomalie transport ignoree.",
        "success",
      );
      await refreshTransportFinanceData();
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setBusyTransportAnomalyId(null);
    }
  };

  const handleSuspendTransportFromAnomaly = async (item: TransportControlAnomalyRow) => {
    if (!item.abonnement_transport_id) return;
    try {
      setBusyTransportAnomalyId(item.anomaly_id);
      await new AbonnementTransportService().signalFinanceSuspension(item.abonnement_transport_id, {
        source: "CONTROLE_TRANSPORT_FINANCE",
        motif: "Anomalie de controle: eleve transporte sans droit financier actif.",
      });
      info("Suspension transport signalee depuis le rapprochement Finance.", "success");
      await refreshTransportFinanceData();
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setBusyTransportAnomalyId(null);
    }
  };

  const handleSignalTransportSuspension = async (item: AbonnementTransportWithRelations) => {
    try {
      setSignalingTransportSuspensionId(item.id);
      await new AbonnementTransportService().signalFinanceSuspension(item.id, {
        source: "FINANCE_DASHBOARD",
        motif: "Impaye signale depuis Finance",
      });
      info("Suspension transport signalee au module Transport.", "success");
      await refreshTransportFinanceData();
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setSignalingTransportSuspensionId(null);
    }
  };

  // const dashboardHighlights = [
  //   {
  //     id: "collection-rate",
  //     label: "Taux de recouvrement",
  //     value: `${collectionRate.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}%`,
  //     helper: `${activePaiementsCount} paiement(s) actifs`,
  //     tone: (collectionRate >= 80 ? "success" : collectionRate >= 60 ? "warning" : "danger") as const,
  //   },
  //   {
  //     id: "encaisse",
  //     label: "Encaisse",
  //     value: formatMoney(totalEncaisse),
  //     helper: `${reversedPaiementsCount} operation(s) regularisee(s)`,
  //     tone: "info" as const,
  //   },
  //   {
  //     id: "reste",
  //     label: "Reste a recouvrer",
  //     value: formatMoney(resteARecouvrer),
  //     helper: `${partiallyPaidInvoices} facture(s) partielle(s)`,
  //     tone: overdueEcheances.length > 0 ? ("warning" as const) : ("default" as const),
  //   },
  //   {
  //     id: "retards",
  //     label: "Retards critiques",
  //     value: String(overdueEcheances.length),
  //     helper: `${overdueStudents.length} eleve(s) concernes`,
  //     tone: overdueEcheances.length > 0 ? ("danger" as const) : ("default" as const),
  //   },
  // ];
  if (!canAccess) return <NotFound />;

  return (
    <FinanceModuleLayout
      title="Finance"
      description="Vue globale des encaissements, creances et controles prioritaires."
      currentModule="dashboard"
      localViews={dashboardViews}
    >
      <div className="space-y-6">
        {errorMessage ? (
          <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 shadow-sm">
            {errorMessage}
          </div>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[1.2fr,0.95fr]">
          <div className="grid gap-4 lg:grid-cols-2">
            <FinanceControlBanner
              label="Controle factures"
              title={overdueEcheances.length > 0 ? `${overdueEcheances.length} echeance(s) en retard` : "Aucun retard critique"}
              description={
                overdueEcheances.length > 0
                  ? `${overdueStudents.length} eleve(s) demandent une relance ou un suivi de recouvrement.`
                  : "Les echeances ouvertes restent sous controle sur la periode chargee."
              }
              tone={overdueEcheances.length > 0 ? "danger" : "success"}
              action={
                <button
                  type="button"
                  onClick={() => setActiveTab("retards")}
                  className="rounded-full border border-current px-3 py-1.5 text-xs font-semibold"
                >
                  Voir les retards
                </button>
              }
            />
            <FinanceControlBanner
              label="Rapprochement"
              title={pendingReconciliationCount > 0 ? `${pendingReconciliationCount} paiement(s) a verifier` : "Rapprochement sain"}
              description={
                pendingReconciliationCount > 0
                  ? "Des encaissements attendent encore une confirmation caisse, banque ou systeme."
                  : "Aucun paiement en attente de rapprochement sur les donnees chargees."
              }
              tone={pendingReconciliationCount > 0 ? "warning" : "success"}
              action={
                <button
                  type="button"
                  onClick={() => setActiveTab("reporting")}
                  className="rounded-full border border-current px-3 py-1.5 text-xs font-semibold"
                >
                  Ouvrir le reporting
                </button>
              }
            />
            <FinanceControlBanner
              label="Automatisation"
              title={recurringReadiness?.ready ? "Facturation recurrente prete" : "Verification requise"}
              description={
                recurringReadiness?.ready
                  ? `${recurrentFraisCount} frais recurrents peuvent etre lances.`
                  : (recurringReadiness?.issues[0]?.message ?? "Controlez les parametres avant generation.")
              }
              tone={recurringReadiness?.ready ? "info" : "warning"}
              action={
                <button
                  type="button"
                  onClick={() => setActiveTab("automatisation")}
                  className="rounded-full border border-current px-3 py-1.5 text-xs font-semibold"
                >
                  Voir l'automatisation
                </button>
              }
            />
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Checkpoints visibles</p>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                  <span>Facture unique et tracable</span>
                  <span className="font-semibold text-slate-900">{factures.length} factures</span>
                </div>
                <div className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                  <span>Solde mis a jour</span>
                  <span className="font-semibold text-slate-900">{activePaiementsCount} encaissements</span>
                </div>
                <div className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
                  <span>Controle service / periode</span>
                  <span className="font-semibold text-slate-900">{openEcheances.length} echeances</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Vue operationnelle</p>
            <h3 className="mt-3 text-xl font-semibold text-slate-950">Questions auxquelles le dashboard repond</h3>
            <div className="mt-5 space-y-3 text-sm text-slate-600">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="font-semibold text-slate-900">Qui doit quoi ?</p>
                <p className="mt-1">Le volet retards et l'ageing montrent la dette restante par eleve, classe et niveau.</p>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="font-semibold text-slate-900">Qui a paye quoi ?</p>
                <p className="mt-1">L'activite recente et les canaux d'encaissement regroupent les reglements, modes et statuts.</p>
              </div>
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="font-semibold text-slate-900">Y a-t-il une anomalie ?</p>
                <p className="mt-1">Les cartes de controle rendent visibles retards, rapprochements incomplets et readiness recurrence.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FinanceMetricCard
            icon={<FiFileText />}
            label="Montant facture"
            value={formatMoney(totalFacture)}
            helper={`${factures.length} facture(s) suivie(s)`}
          />
          <FinanceMetricCard
            icon={<FiCreditCard />}
            label="Montant encaisse"
            value={formatMoney(totalEncaisse)}
            helper={`${activePaiementsCount} paiement(s) actif(s), ${reversedPaiementsCount} regularise(s)`}
          />
          <FinanceMetricCard
            icon={<FiDollarSign />}
            label="Reste a recouvrer"
            value={formatMoney(resteARecouvrer)}
            helper={`${partiallyPaidInvoices} facture(s) partielle(s)`}
          />
          <FinanceMetricCard
            icon={<FiAlertCircle />}
            label="Echeances en retard"
            value={String(overdueEcheances.length)}
            helper={`${overdueStudents.length} eleve(s) concernes, ${impactedOverdueInvoices} facture(s) impactees`}
          />
        </section>
        <section
          className={`grid gap-4 ${
            activeTab === "activite" || activeTab === "reporting"
              ? "xl:grid-cols-[1.35fr,0.95fr]"
              : ""
          }`}
        >
          {activeTab === "activite" || activeTab === "reporting" ? (
            <div className="space-y-4">
              {activeTab === "activite" ? (
                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Factures recentes</h3>
                      <p className="text-sm text-slate-500">
                        Dernieres emissions et statut de recouvrement.
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                    {recentFactures.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {getFactureDisplayLabel(item)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {getFactureSecondaryLabel(item)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-slate-900">
                              {formatMoney(toNumber(item.total_montant), item.devise ?? "MGA")}
                            </p>
                            <p className="text-xs text-slate-500">{formatDate(item.date_emission)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {!isLoading && recentFactures.length === 0 ? (
                      <p className="text-sm text-slate-500">Aucune facture disponible pour le moment.</p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {activeTab === "reporting" ? (
                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Encaissements par jour</h3>
                      <p className="text-sm text-slate-500">
                        Vue consolidee des encaissements actifs par date de paiement.
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                    {dailyReceipts.map((item) => (
                      <div
                        key={item.dayKey}
                        className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {formatDayKeyLabel(item.dayKey)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {item.count} encaissement(s) - {formatMoney(item.cash)} caisse -{' '}
                              {formatMoney(item.bank)} banque
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-slate-900">{formatMoney(item.total)}</p>
                            <p className="text-xs text-slate-500">
                              {item.electronic > 0
                                ? `${formatMoney(item.electronic)} electronique`
                                : "Pas d'electronique"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {!isLoading && dailyReceipts.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        Aucun encaissement journalier a consolider pour le moment.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {activeTab === "activite" ? (
                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Paiements recents</h3>
                      <p className="text-sm text-slate-500">
                        Encaissements saisis les plus recents.
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                    {recentPaiements.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {getPaiementDisplayLabel(item)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {getPaiementSecondaryLabel(item)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-slate-900">
                              {formatMoney(toNumber(item.montant), item.facture?.devise ?? "MGA")}
                            </p>
                            <p className="text-xs text-slate-500">{formatDate(item.paye_le)}</p>
                            <span
                              className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                                isActivePaiementStatus(item.statut)
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {isActivePaiementStatus(item.statut)
                                ? "Enregistre"
                                : (item.statut ?? "Regularise")}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    {!isLoading && recentPaiements.length === 0 ? (
                      <p className="text-sm text-slate-500">Aucun paiement enregistre pour le moment.</p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {activeTab === "reporting" ? (
                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">Rapport par classe</h3>
                      <p className="text-sm text-slate-500">
                        Montants factures, encaisses et restants par classe sur les factures actives.
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                    {classFinancialRows.map((item) => (
                      <div
                        key={item.key}
                        className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {item.studentsCount} eleve(s) - {item.invoicesCount} facture(s) -{' '}
                              {item.niveauLabel ?? "Niveau non renseigne"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-slate-900">{formatMoney(item.totalFacture)}</p>
                            <p className="text-xs text-slate-500">
                              Encaisse {formatMoney(item.totalEncaisse)} - Reste {formatMoney(item.restant)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {!isLoading && classFinancialRows.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        Aucune ventilation par classe disponible pour le moment.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-4">
            {activeTab === "synthese" ? (
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Pilotage rapide</h3>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-center gap-3 text-slate-500">
                      <FiCalendar />
                      <span className="text-sm font-medium">Echeances a 30 jours</span>
                    </div>
                    <p className="mt-3 text-2xl font-semibold text-slate-900">{upcomingEcheances.length}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {openEcheances.length} tranche(s) encore ouverte(s)
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-center gap-3 text-slate-500">
                      <FiLayers />
                      <span className="text-sm font-medium">Plans echelonnes</span>
                    </div>
                    <p className="mt-3 text-2xl font-semibold text-slate-900">
                      {plans.filter((item) => (item.plan_json?.mode_paiement ?? "").toUpperCase() !== "COMPTANT").length}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">{overdueEcheances.length} echeance(s) en retard</p>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-center gap-3 text-slate-500">
                      <FiRepeat />
                      <span className="text-sm font-medium">Frais recurrents</span>
                    </div>
                    <p className="mt-3 text-2xl font-semibold text-slate-900">{recurrentFraisCount}</p>
                    <button
                      type="button"
                      onClick={() => void handleGenerateRecurring()}
                      disabled={isGeneratingRecurring || recurrentFraisCount === 0 || recurringReadiness?.ready === false}
                      className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FiRepeat />
                      {isGeneratingRecurring ? "Generation..." : "Generer maintenant"}
                    </button>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-center gap-3 text-slate-500">
                      <FiPercent />
                      <span className="text-sm font-medium">Remises configurees</span>
                    </div>
                    <p className="mt-3 text-2xl font-semibold text-slate-900">{remises.length}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {remiseStats.percent} en pourcentage, {remiseStats.fixed} fixes
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "synthese" ? (
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <FiFileText className="text-slate-500" />
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Demandes de facturation de service</h3>
                    <p className="text-sm text-slate-500">
                      File transverse des demandes de prise en charge financiere emises par les modules Transport et Cantine.
                    </p>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {serviceBillingRequests.slice(0, 10).map((request) => {
                    if (request.kind === "TRANSPORT") {
                      const item = request.subscription;
                      const candidateKey = `${item.eleve_id}::${item.annee_scolaire_id}`;
                      const candidates = transportBillingCandidates.get(candidateKey) ?? [];
                      return (
                        <div
                          key={request.key}
                          className="rounded-[22px] border border-amber-200 bg-amber-50/80 px-4 py-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                Transport
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">
                                {getAbonnementTransportDisplayLabel(item)}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {item.ligne?.nom ?? "Ligne non renseignee"}
                                {item.arret?.nom ? ` - ${item.arret.nom}` : ""}
                                {item.zone_transport ? ` - ${item.zone_transport}` : ""}
                              </p>
                              <p className="mt-1 text-xs text-amber-800">
                                {item.annee?.nom ?? "Annee non renseignee"} - {getAbonnementTransportFinanceStatusLabel(
                                  item.finance_status ?? "A_FACTURER",
                                )}
                              </p>
                              {request.requiresRegularization ? (
                                <p className="mt-1 text-xs text-amber-900">
                                  Changement d'affectation avec impact tarifaire a regulariser.
                                </p>
                              ) : null}
                            </div>
                            <div className="min-w-[16rem] max-w-full space-y-2">
                              {request.requiresRegularization ? (
                                <button
                                  type="button"
                                  onClick={() => void handleProcessTransportRegularization(item)}
                                  disabled={processingTransportRegularizationId === item.id}
                                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <FiRepeat />
                                  {processingTransportRegularizationId === item.id
                                    ? "Regularisation..."
                                    : "Generer la regularisation"}
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => void handleProcessTransportBilling(item)}
                                    disabled={processingTransportBillingId === item.id}
                                    className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <FiFileText />
                                    {processingTransportBillingId === item.id
                                      ? "Facturation..."
                                      : item.prorata_ratio != null && item.prorata_ratio > 0 && item.prorata_ratio < 1
                                        ? "Generer la facture proratiee"
                                        : "Generer la facturation"}
                                  </button>
                                  {item.prorata_ratio != null && item.prorata_ratio > 0 && item.prorata_ratio < 1 ? (
                                    <p className="text-xs text-amber-900">
                                      Prorata detecte: {(item.prorata_ratio * 100).toFixed(0)}% sur la periode d'usage.
                                    </p>
                                  ) : null}
                                  <select
                                    value={transportFactureSelection[item.id] ?? ""}
                                    onChange={(event) =>
                                      setTransportFactureSelection((current) => ({
                                        ...current,
                                        [item.id]: event.target.value,
                                      }))
                                    }
                                    disabled={linkingTransportId === item.id}
                                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                                  >
                                    <option value="">
                                      {candidates.length > 0
                                        ? "Selectionner une facture existante si besoin"
                                        : "Aucune facture correspondante"}
                                    </option>
                                    {candidates.map((facture) => (
                                      <option key={facture.id} value={facture.id}>
                                        {getFactureDisplayLabel(facture)} - {formatMoney(toNumber(facture.total_montant), facture.devise ?? "MGA")}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => void handleLinkTransportFacture(item)}
                                    disabled={linkingTransportId === item.id || candidates.length === 0}
                                    className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <FiFileText />
                                    {linkingTransportId === item.id ? "Rattachement..." : "Rattacher la facture"}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const item = request.subscription;
                    return (
                      <div
                        key={request.key}
                        className="rounded-[22px] border border-amber-200 bg-amber-50/80 px-4 py-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                              Cantine
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-900">
                              {getAbonnementCantineDisplayLabel(item)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {item.formule?.nom ?? "Formule non renseignee"}
                            </p>
                            <p className="mt-1 text-xs text-amber-800">
                              {item.annee?.nom ?? "Annee non renseignee"} - {getAbonnementCantineFinanceStatusLabel(
                                item.finance_status ?? "EN_ATTENTE_VALIDATION_FINANCIERE",
                              )}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleProcessCantineBilling(item)}
                            disabled={processingCantineBillingId === item.id}
                            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <FiFileText />
                            {processingCantineBillingId === item.id ? "Facturation..." : "Generer la facturation"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {!isLoading && serviceBillingRequests.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Aucune demande de facturation de service en attente.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeTab === "synthese" ? (
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <FiTruck className="text-slate-500" />
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Transport a facturer</h3>
                    <p className="text-sm text-slate-500">
                      Demandes transport validees cote service et encore en attente de prise en charge Finance.
                    </p>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {pendingTransportBilling.slice(0, 6).map((item) => {
                    const candidateKey = `${item.eleve_id}::${item.annee_scolaire_id}`;
                    const candidates = transportBillingCandidates.get(candidateKey) ?? [];
                    const history = getLatestTransportHistory(item);
                    const historyDetails = getTransportHistoryDetails(item);
                    const requiresRegularization =
                      history?.impact_tarifaire === true &&
                      historyDetails.notification_finance === true &&
                      !historyDetails.finance_processed_at;
                    return (
                      <div
                        key={item.id}
                        className="rounded-[22px] border border-amber-200 bg-amber-50/80 px-4 py-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {getAbonnementTransportDisplayLabel(item)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {item.ligne?.nom ?? "Ligne non renseignee"}
                              {item.arret?.nom ? ` - ${item.arret.nom}` : ""}
                              {item.zone_transport ? ` - ${item.zone_transport}` : ""}
                            </p>
                            <p className="mt-1 text-xs text-amber-800">
                              {item.annee?.nom ?? "Annee non renseignee"} - {getAbonnementTransportFinanceStatusLabel(
                                item.finance_status ?? "A_FACTURER",
                              )}
                            </p>
                            {requiresRegularization ? (
                              <p className="mt-1 text-xs text-amber-900">
                                Changement d'affectation avec impact tarifaire a regulariser.
                              </p>
                            ) : null}
                          </div>
                          <div className="min-w-[16rem] max-w-full space-y-2">
                            {requiresRegularization ? (
                              <button
                                type="button"
                                onClick={() => void handleProcessTransportRegularization(item)}
                                disabled={processingTransportRegularizationId === item.id}
                                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <FiRepeat />
                                {processingTransportRegularizationId === item.id
                                  ? "Regularisation..."
                                  : "Generer la regularisation"}
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void handleProcessTransportBilling(item)}
                                  disabled={processingTransportBillingId === item.id}
                                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <FiFileText />
                                  {processingTransportBillingId === item.id
                                    ? "Facturation..."
                                    : item.prorata_ratio != null && item.prorata_ratio > 0 && item.prorata_ratio < 1
                                      ? "Generer la facture proratisée"
                                      : "Generer la facturation"}
                                </button>
                                {item.prorata_ratio != null && item.prorata_ratio > 0 && item.prorata_ratio < 1 ? (
                                  <p className="text-xs text-amber-900">
                                    Prorata detecte: {(item.prorata_ratio * 100).toFixed(0)}% sur la periode d&apos;usage.
                                  </p>
                                ) : null}
                                <select
                                  value={transportFactureSelection[item.id] ?? ""}
                                  onChange={(event) =>
                                    setTransportFactureSelection((current) => ({
                                      ...current,
                                      [item.id]: event.target.value,
                                    }))
                                  }
                                  disabled={linkingTransportId === item.id}
                                  className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                                >
                                  <option value="">
                                    {candidates.length > 0
                                      ? "Selectionner une facture existante si besoin"
                                      : "Aucune facture correspondante"}
                                  </option>
                                  {candidates.map((facture) => (
                                    <option key={facture.id} value={facture.id}>
                                      {getFactureDisplayLabel(facture)} - {formatMoney(toNumber(facture.total_montant), facture.devise ?? "MGA")}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => void handleLinkTransportFacture(item)}
                                  disabled={linkingTransportId === item.id || candidates.length === 0}
                                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <FiFileText />
                                  {linkingTransportId === item.id ? "Rattachement..." : "Rattacher la facture"}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {!isLoading && pendingTransportBilling.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Aucune demande transport en attente de facturation.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeTab === "synthese" ? (
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <FiFileText className="text-slate-500" />
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Cantine a facturer</h3>
                    <p className="text-sm text-slate-500">
                      Demandes cantine en attente de prise en charge ou de validation Finance.
                    </p>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {pendingCantineBilling.slice(0, 6).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-[22px] border border-amber-200 bg-amber-50/80 px-4 py-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {getAbonnementCantineDisplayLabel(item)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.formule?.nom ?? "Formule non renseignee"}
                          </p>
                          <p className="mt-1 text-xs text-amber-800">
                            {item.annee?.nom ?? "Annee non renseignee"} - {getAbonnementCantineFinanceStatusLabel(
                              item.finance_status ?? "EN_ATTENTE_VALIDATION_FINANCIERE",
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleProcessCantineBilling(item)}
                          disabled={processingCantineBillingId === item.id}
                          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <FiFileText />
                          {processingCantineBillingId === item.id ? "Facturation..." : "Generer la facturation"}
                        </button>
                      </div>
                    </div>
                  ))}
                  {!isLoading && pendingCantineBilling.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Aucune demande cantine en attente de facturation.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeTab === "synthese" ? (
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <FiFileText className="text-slate-500" />
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Cantine a regulariser</h3>
                    <p className="text-sm text-slate-500">
                      Changements de formule cantine avec impact tarifaire a traiter par Finance.
                    </p>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {pendingCantineRegularization.slice(0, 6).map((item) => {
                    const latestHistory = item.historiquesFormule?.[0] ?? null;
                    return (
                      <div
                        key={item.id}
                        className="rounded-[22px] border border-amber-200 bg-amber-50/80 px-4 py-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {getAbonnementCantineDisplayLabel(item)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {latestHistory?.ancienneFormule?.nom ?? "Ancienne formule"} {" -> "} {latestHistory?.nouvelleFormule?.nom ?? item.formule?.nom ?? "Nouvelle formule"}
                            </p>
                            <p className="mt-1 text-xs text-amber-800">
                              {item.annee?.nom ?? "Annee non renseignee"} - {getAbonnementCantineFinanceStatusLabel(
                                item.finance_status ?? "EN_ATTENTE_REGLEMENT",
                              )}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleProcessCantineRegularization(item)}
                            disabled={processingCantineRegularizationId === item.id}
                            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <FiFileText />
                            {processingCantineRegularizationId === item.id ? "Regularisation..." : "Generer la regularisation"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {!isLoading && pendingCantineRegularization.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Aucun changement de formule cantine en attente de regularisation.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeTab === "synthese" ? (
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <FiBell className="text-slate-500" />
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Consommations cantine a controler</h3>
                    <p className="text-sm text-slate-500">
                      Repas servis traces par la cantine et transmis a Finance pour controle ou valorisation.
                    </p>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {pendingCantineConsumptionControl.slice(0, 8).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-[22px] border border-amber-200 bg-amber-50/80 px-4 py-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {getAbonnementCantineDisplayLabel(item.abonnement ?? null)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.abonnement?.formule?.nom ?? "Formule non renseignee"} - {item.type_repas}
                          </p>
                          <p className="mt-1 text-xs text-amber-800">
                            {formatDate(item.consommation_le)} - Finance: {getAbonnementCantineFinanceStatusLabel(
                              item.finance_status_snapshot ?? item.abonnement?.finance_status ?? "N/A",
                            )}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Statut d'acces lors du service: {item.statut_acces}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleProcessCantineConsumptionControl(item)}
                          disabled={processingCantineConsumptionId === item.id}
                          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <FiBell />
                          {processingCantineConsumptionId === item.id ? "Controle..." : "Marquer controlee"}
                        </button>
                      </div>
                    </div>
                  ))}
                  {!isLoading && pendingCantineConsumptionControl.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Aucune consommation cantine en attente de controle Finance.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeTab === "synthese" ? (
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <FiAlertCircle className="text-slate-500" />
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Controle transverse Services vs Finance</h3>
                    <p className="text-sm text-slate-500">
                      Synthese commune des ecarts detectes entre Finance, Transport et Cantine.
                    </p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-fuchsia-700">Total</p>
                    <p className="mt-2 text-2xl font-semibold text-fuchsia-950">{totalServiceControlAnomalies}</p>
                  </div>
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Transport</p>
                    <p className="mt-2 text-2xl font-semibold text-sky-950">{transportControlSummary.total}</p>
                  </div>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Cantine</p>
                    <p className="mt-2 text-2xl font-semibold text-amber-950">{cantineControlSummary.total}</p>
                  </div>
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-700">Critiques</p>
                    <p className="mt-2 text-2xl font-semibold text-rose-950">
                      {transportControlSummary.transportes_sans_droit_financier +
                        cantineControlSummary.repas_sans_autorisation_active}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "synthese" ? (
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <FiTruck className="text-slate-500" />
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Anomalies Transport vs Finance</h3>
                    <p className="text-sm text-slate-500">
                      Rapprochement des eleves transportes, des reglements Finance et des situations suspendues.
                    </p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-fuchsia-700">Total</p>
                    <p className="mt-2 text-2xl font-semibold text-fuchsia-950">{transportControlSummary.total}</p>
                  </div>
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-700">Sans droit</p>
                    <p className="mt-2 text-2xl font-semibold text-rose-950">
                      {transportControlSummary.transportes_sans_droit_financier}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Payes sans affectation</p>
                    <p className="mt-2 text-2xl font-semibold text-amber-950">
                      {transportControlSummary.payes_sans_affectation_transport}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Suspendus avec usage</p>
                    <p className="mt-2 text-2xl font-semibold text-sky-950">
                      {transportControlSummary.suspendus_encore_planifies}
                    </p>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {transportControlAnomalies.slice(0, 8).map((item) => (
                    <div
                      key={item.anomaly_id}
                      className={`rounded-[22px] border px-4 py-4 ${getTransportControlAnomalyTone(item.code)}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{item.eleve_label}</p>
                          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] opacity-80">
                            {getTransportControlAnomalyLabel(item.code)}
                          </p>
                          <p className="mt-1 text-xs opacity-80">
                            {item.ligne_label ? `Ligne ${item.ligne_label}` : "Aucune ligne transport active"}
                            {item.arret_label ? ` - ${item.arret_label}` : ""}
                            {item.facture_numero ? ` - Facture ${item.facture_numero}` : ""}
                          </p>
                          <p className="mt-1 text-xs opacity-80">
                            Finance: {getAbonnementTransportFinanceStatusLabel(item.finance_status ?? "N/A")}
                            {" - "}Service: {item.service_status ?? "N/A"}
                            {" - "}Exploitation: {item.operational_status ?? "N/A"}
                          </p>
                          <p className="mt-1 text-xs opacity-80">{item.motif}</p>
                        </div>
                        <div className="flex min-w-[12rem] flex-col items-end gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getTransportControlTrackingTone(item.tracking_status)}`}
                          >
                            {getTransportControlTrackingLabel(item.tracking_status)}
                          </span>
                          {item.code === "TRANSPORTE_SANS_DROIT_FINANCIER" && item.abonnement_transport_id ? (
                            <button
                              type="button"
                              onClick={() => void handleSuspendTransportFromAnomaly(item)}
                              disabled={busyTransportAnomalyId === item.anomaly_id}
                              className="inline-flex items-center justify-center rounded-full border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {busyTransportAnomalyId === item.anomaly_id ? "Traitement..." : "Suspendre le service"}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void handleMarkTransportAnomaly(item, "RESOLVED")}
                            disabled={busyTransportAnomalyId === item.anomaly_id}
                            className="inline-flex items-center justify-center rounded-full border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {busyTransportAnomalyId === item.anomaly_id ? "Traitement..." : "Marquer resolue"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleMarkTransportAnomaly(item, "IGNORED")}
                            disabled={busyTransportAnomalyId === item.anomaly_id}
                            className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {busyTransportAnomalyId === item.anomaly_id ? "Traitement..." : "Ignorer"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!isLoading && transportControlAnomalies.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Aucune anomalie de rapprochement detectee entre le transport et la situation Finance.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeTab === "synthese" ? (
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <FiAlertCircle className="text-slate-500" />
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Anomalies Cantine vs Finance</h3>
                    <p className="text-sm text-slate-500">
                      Rapprochement entre repas servis, autorisations financieres et droits journaliers de la formule.
                    </p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-fuchsia-700">Total</p>
                    <p className="mt-2 text-2xl font-semibold text-fuchsia-950">{cantineControlSummary.total}</p>
                  </div>
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-rose-700">Sans autorisation</p>
                    <p className="mt-2 text-2xl font-semibold text-rose-950">
                      {cantineControlSummary.repas_sans_autorisation_active}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">Payes sans repas</p>
                    <p className="mt-2 text-2xl font-semibold text-amber-950">
                      {cantineControlSummary.payes_sans_consommation}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">Surconsommations</p>
                    <p className="mt-2 text-2xl font-semibold text-sky-950">
                      {cantineControlSummary.consommations_superieures_aux_droits}
                    </p>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {cantineControlAnomalies.slice(0, 8).map((item) => (
                    <div
                      key={item.anomaly_id}
                      className="rounded-[22px] border border-amber-200 bg-amber-50/80 px-4 py-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.eleve_label}</p>
                          <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-800">
                            {getCantineControlAnomalyLabel(item.code)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.formule_label ?? "Formule non renseignee"}
                            {item.consommation_le ? ` - ${formatDate(item.consommation_le)}` : ""}
                          </p>
                          <p className="mt-1 text-xs text-amber-800">
                            Finance: {getAbonnementCantineFinanceStatusLabel(item.finance_status ?? "N/A")}
                            {" - "}Service: {item.service_status ?? "N/A"}
                            {" - "}Acces: {item.access_status ?? "N/A"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">{item.motif}</p>
                          {typeof item.consommation_count === "number" ? (
                            <p className="mt-1 text-xs text-slate-500">
                              Consommations: {item.consommation_count}
                              {typeof item.allowed_count === "number" ? ` - Droit prevu: ${item.allowed_count}` : ""}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex min-w-[12rem] flex-col items-end gap-2">
                          <span className="rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                            {getCantineControlTrackingLabel(item.tracking_status)}
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleMarkCantineAnomaly(item, "RESOLVED")}
                            disabled={busyCantineAnomalyId === item.anomaly_id}
                            className="inline-flex items-center justify-center rounded-full border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {busyCantineAnomalyId === item.anomaly_id ? "Traitement..." : "Marquer resolue"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleMarkCantineAnomaly(item, "IGNORED")}
                            disabled={busyCantineAnomalyId === item.anomaly_id}
                            className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {busyCantineAnomalyId === item.anomaly_id ? "Traitement..." : "Ignorer"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!isLoading && cantineControlAnomalies.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Aucune anomalie de rapprochement detectee entre la cantine et la situation Finance.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeTab === "synthese" ? (
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <FiRepeat className="text-slate-500" />
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Absences cantine a regulariser</h3>
                    <p className="text-sm text-slate-500">
                      Absences et annulations de repas signalees par la cantine et ouvrant droit a traitement Finance.
                    </p>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {pendingCantineAbsenceRegularization.slice(0, 8).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-[22px] border border-amber-200 bg-amber-50/80 px-4 py-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {getAbonnementCantineDisplayLabel(item.abonnement ?? null)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {getCantineAbsenceEventLabel(item.type_evenement)} du {formatDate(item.date_repas)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.abonnement?.formule?.nom ?? "Formule non renseignee"} - Suggestion:{" "}
                            {getCantineAbsenceRegularizationModeLabel(item.mode_regularisation_suggere)}
                          </p>
                          <p className="mt-1 text-xs text-amber-800">
                            Finance: {getAbonnementCantineFinanceStatusLabel(
                              item.finance_status_snapshot ?? item.abonnement?.finance_status ?? "N/A",
                            )}
                          </p>
                          {item.note ? (
                            <p className="mt-1 text-xs text-slate-500">
                              Note: {item.note}
                            </p>
                          ) : null}
                        </div>
                        <div className="min-w-[16rem] max-w-full space-y-2">
                          <select
                            value={
                              cantineAbsenceDecisionSelection[item.id] ??
                              item.mode_regularisation_suggere ??
                              "AVOIR"
                            }
                            onChange={(event) =>
                              setCantineAbsenceDecisionSelection((current) => ({
                                ...current,
                                [item.id]: event.target.value,
                              }))
                            }
                            disabled={processingCantineAbsenceId === item.id}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                          >
                            {(["AVOIR", "REPORT", "REMBOURSEMENT", "AJUSTEMENT", "REFUS_REGULARISATION"] as const).map(
                              (decision) => (
                                <option key={decision} value={decision}>
                                  {decision === "REFUS_REGULARISATION"
                                    ? "Refuser la regularisation"
                                    : getCantineAbsenceRegularizationModeLabel(decision)}
                                </option>
                              ),
                            )}
                          </select>
                          <button
                            type="button"
                            onClick={() => void handleProcessCantineAbsenceRegularization(item)}
                            disabled={processingCantineAbsenceId === item.id}
                            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <FiRepeat />
                            {processingCantineAbsenceId === item.id
                              ? "Traitement..."
                              : "Traiter la regularisation"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!isLoading && pendingCantineAbsenceRegularization.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Aucune absence ou annulation cantine en attente de regularisation Finance.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeTab === "retards" ? (
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <FiBell className="text-slate-500" />
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Cantine a suspendre</h3>
                    <p className="text-sm text-slate-500">
                      Dossiers cantine avec situation financiere bloquante a transmettre au module Cantine.
                    </p>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {pendingCantineSuspension.slice(0, 8).map((item) => {
                    const status = (item.statut ?? "").toUpperCase();
                    return (
                      <div
                        key={item.id}
                        className="rounded-[22px] border border-rose-200 bg-rose-50/80 px-4 py-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {getAbonnementCantineDisplayLabel(item)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {item.formule?.nom ?? "Formule non renseignee"}
                            </p>
                            <p className="mt-1 text-xs text-rose-800">
                              {item.annee?.nom ?? "Annee non renseignee"} - {getAbonnementCantineFinanceStatusLabel(
                                item.finance_status ?? "EN_ATTENTE_REGLEMENT",
                              )}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Statut service: {item.statut ?? "Non renseigne"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleSignalCantineSuspension(item)}
                            disabled={signalingCantineSuspensionId === item.id || status === "SUSPENDU"}
                            className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <FiBell />
                            {signalingCantineSuspensionId === item.id
                              ? "Signalement..."
                              : status === "SUSPENDU"
                                ? "Deja suspendu"
                                : "Suspendre le service"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {!isLoading && pendingCantineSuspension.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Aucun dossier cantine a suspendre pour impaye actuellement.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeTab === "retards" ? (
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <FiTruck className="text-slate-500" />
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Transport a suspendre</h3>
                    <p className="text-sm text-slate-500">
                      Dossiers transport encore ouverts avec situation financiere en attente de reglement.
                    </p>
                  </div>
                </div>
                <div className="mt-5 space-y-3">
                  {transportSuspensionCandidates.slice(0, 8).map((item) => {
                    const status = (item.statut ?? "").toUpperCase();
                    const history = getLatestTransportHistory(item);
                    const historyDetails = getTransportHistoryDetails(item);
                    const regularizationPending =
                      history?.impact_tarifaire === true &&
                      historyDetails.notification_finance === true &&
                      !historyDetails.finance_processed_at;
                    return (
                      <div
                        key={item.id}
                        className="rounded-[22px] border border-rose-200 bg-rose-50/80 px-4 py-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {getAbonnementTransportDisplayLabel(item)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {item.ligne?.nom ?? "Ligne non renseignee"}
                              {item.arret?.nom ? ` - ${item.arret.nom}` : ""}
                              {item.zone_transport ? ` - ${item.zone_transport}` : ""}
                            </p>
                            <p className="mt-1 text-xs text-rose-800">
                              {item.annee?.nom ?? "Annee non renseignee"} - {getAbonnementTransportFinanceStatusLabel(
                                item.finance_status ?? "EN_ATTENTE_REGLEMENT",
                              )}
                            </p>
                            {regularizationPending ? (
                              <p className="mt-1 text-xs text-amber-700">
                                Defaut de regularisation detecte apres changement d&apos;affectation transport.
                              </p>
                            ) : null}
                            <p className="mt-1 text-xs text-slate-500">
                              Statut service: {item.statut ?? "Non renseigne"}
                            </p>
                            {status === "EN_ATTENTE_SUSPENSION_FINANCIERE" ? (
                              <p className="mt-1 text-xs text-amber-700">
                                Suspension transmise a Transport et en attente de validation humaine.
                              </p>
                            ) : null}
                            {status === "SUSPENDU_FINANCE" ? (
                              <p className="mt-1 text-xs text-rose-700">
                                Suspension financiere deja appliquee.
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void handleSignalTransportSuspension(item)}
                              disabled={
                                signalingTransportSuspensionId === item.id ||
                                status === "EN_ATTENTE_SUSPENSION_FINANCIERE" ||
                                status === "SUSPENDU_FINANCE"
                              }
                              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <FiAlertCircle />
                              {signalingTransportSuspensionId === item.id
                                ? "Signalement..."
                                : status === "EN_ATTENTE_SUSPENSION_FINANCIERE"
                                  ? "Validation transport en attente"
                                  : status === "SUSPENDU_FINANCE"
                                    ? "Deja suspendu"
                                    : "Signaler la suspension"}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {!isLoading && transportSuspensionCandidates.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Aucun dossier transport a suspendre pour impaye actuellement.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeTab === "retards" ? (
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Eleves les plus en retard</h3>
                <div className="mt-5 max-h-[24rem] space-y-3 overflow-y-auto pr-1">
                  {overdueStudents.slice(0, 8).map((student) => {
                    const lateDays = diffInDays(new Date(student.oldestDate), today);
                    return (
                      <div
                        key={student.id}
                        className="rounded-[22px] border border-rose-200 bg-rose-50/80 px-4 py-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{student.eleveLabel}</p>
                            <p className="mt-1 text-xs text-slate-500">{student.secondaryLabel}</p>
                            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
                              <span className="rounded-full bg-white px-2.5 py-1 text-rose-700">
                                {student.echeancesCount} echeance(s) en retard
                              </span>
                              <span className="rounded-full bg-white px-2.5 py-1 text-slate-700">
                                {student.facturesCount} facture(s) concernee(s)
                              </span>
                              <span className="rounded-full bg-white px-2.5 py-1 text-amber-700">
                                {lateDays} jour(s) de retard
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-semibold text-rose-700">
                              {formatMoney(student.totalRestant, student.devise)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Plus ancienne echeance: {formatDate(student.oldestDate)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {!isLoading && overdueStudents.length === 0 ? (
                    <p className="text-sm text-slate-500">Aucun eleve avec retard pour le moment.</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeTab === "retards" ? (
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Echeances en retard</h3>
                <div className="mt-5 max-h-[24rem] space-y-3 overflow-y-auto pr-1">
                  {overdueEcheances.slice(0, 5).map((item) => (
                    <div key={item.id} className="rounded-[22px] border border-rose-200 bg-rose-50/70 px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.eleveLabel}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {[item.libelle, item.secondaryLabel].filter(Boolean).join(" - ")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900">
                            {formatMoney(item.montantRestant, item.devise)}
                          </p>
                          <p className="text-xs text-rose-700">
                            {formatDate(item.date)} - {item.statut}
                          </p>
                          <button
                            type="button"
                            onClick={() => void handleSendRelance(item)}
                            disabled={sendingRelanceId === item.id}
                            className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <FiBell />
                            {sendingRelanceId === item.id ? "Envoi..." : "Relancer"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!isLoading && overdueEcheances.length === 0 ? (
                    <p className="text-sm text-slate-500">Aucune echeance en retard pour le moment.</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeTab === "retards" ? (
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Prochaines echeances</h3>
                <div className="mt-5 max-h-[24rem] space-y-3 overflow-y-auto pr-1">
                  {upcomingEcheances.slice(0, 5).map((item) => (
                    <div key={item.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.eleveLabel}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {[item.libelle, item.secondaryLabel].filter(Boolean).join(" - ")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900">
                            {formatMoney(item.montantRestant, item.devise)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatDate(item.date)} - {item.mode} - {item.statut}
                          </p>
                          <button
                            type="button"
                            onClick={() => void handleSendRelance(item)}
                            disabled={sendingRelanceId === item.id}
                            className="mt-3 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <FiBell />
                            {sendingRelanceId === item.id ? "Envoi..." : "Rappeler"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!isLoading && upcomingEcheances.length === 0 ? (
                    <p className="text-sm text-slate-500">Aucune echeance planifiee sur les 30 prochains jours.</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeTab === "automatisation" ? (
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Facturation recurrente</h3>
                {recurringReadiness ? (
                  <div className={`mt-4 rounded-[20px] border px-4 py-3 text-sm ${
                    recurringReadiness.ready
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  }`}>
                    <p className="font-semibold">
                      {recurringReadiness.ready
                        ? `Preparation OK pour ${recurringReadiness.annee_label}`
                        : `Preparation incomplete pour ${recurringReadiness.annee_label}`}
                    </p>
                    <p className="mt-1">
                      {recurringReadiness.approved_recurring_count} frais recurrents approuves,{' '}
                      {recurringReadiness.active_inscriptions_count} inscription(s) active(s),{' '}
                      {recurringReadiness.periodes_count} periode(s).
                    </p>
                    {recurringReadiness.issues.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        {recurringReadiness.issues.map((issue) => (
                          <p key={issue.code}>
                            {issue.severity === "error" ? "Blocant" : "A verifier"}: {issue.message}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-5 max-h-[24rem] space-y-3 overflow-y-auto pr-1">
                  {recentRecurringRuns.map((item) => (
                    <div key={item.run_id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {item.cycle_label} - {item.periodicite}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.catalogues.map((catalogue) => `${catalogue.nom} (${catalogue.count})`).join(", ")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900">{item.created_count} facture(s)</p>
                          <p className="mt-1 text-xs text-slate-500">{formatDate(item.created_at)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!isLoading && recentRecurringRuns.length === 0 ? (
                    <p className="text-sm text-slate-500">Aucune generation recurrente pour le moment.</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeTab === "reporting" ? (
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Canaux d'encaissement</h3>
                <div className="mt-5 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {paymentChannelStats.map((item) => (
                      <div key={item.key} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{item.label}</p>
                        <p className="mt-3 text-2xl font-semibold text-slate-900">{formatMoney(item.total)}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.count} operation(s) - {getPaiementMethodLabel(item.key === "cash" ? "cash" : item.key === "bank" ? "bank" : item.key === "electronic" ? "mobile_money" : "famille")}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-slate-100 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Rapprochement</p>
                    <div className="mt-3 space-y-2">
                      {reconciliationStats.map((item) => (
                        <div key={item.key} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-slate-700">{item.label}</span>
                          <span className="font-semibold text-slate-900">{item.count} - {formatMoney(item.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === "reporting" ? (
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Rapport par niveau</h3>
                <div className="mt-5 max-h-[20rem] space-y-3 overflow-y-auto pr-1">
                  {levelFinancialRows.map((item) => (
                    <div key={item.key} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.studentsCount} eleve(s) - {item.invoicesCount} facture(s)</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900">{formatMoney(item.totalFacture)}</p>
                          <p className="text-xs text-slate-500">Encaisse {formatMoney(item.totalEncaisse)} - Reste {formatMoney(item.restant)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!isLoading && levelFinancialRows.length === 0 ? (
                    <p className="text-sm text-slate-500">Aucune ventilation par niveau disponible.</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeTab === "reporting" ? (
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Ageing des creances</h3>
                <div className="mt-5 space-y-3">
                  {ageingBuckets.map((bucket) => (
                    <div key={bucket.key} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{bucket.label}</p>
                          <p className="mt-1 text-xs text-slate-500">{bucket.count} echeance(s) en retard</p>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">{formatMoney(bucket.total)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {activeTab === "activite" ? (
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Relances recentes</h3>
                <div className="mt-5 max-h-[24rem] space-y-3 overflow-y-auto pr-1">
                  {recentRelances.map((item) => (
                    <div key={item.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {item.objet.replace(/^\[FINANCE_RELANCE\]\[[^\]]+\]\s*/, "")}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.destinataires.map((destinataire) => destinataire.nom).join(", ") || "Aucun destinataire"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                            {item.echeance_ids.length} echeance(s)
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">{formatDate(item.envoye_le)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!isLoading && recentRelances.length === 0 ? (
                    <p className="text-sm text-slate-500">Aucune relance envoyee pour le moment.</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {activeTab === "synthese" ? (
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">Frais et remises</h3>
                <div className="mt-5 space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                      Frais les plus utilises
                    </p>
                    <div className="mt-3 space-y-2">
                      {topFrais.slice(0, 4).map((item) => (
                        <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-slate-700">{item.label}</span>
                          <span className="font-semibold text-slate-900">{item.count}</span>
                        </div>
                      ))}
                      {!isLoading && topFrais.length === 0 ? (
                        <p className="text-sm text-slate-500">Aucune ligne de facture exploitable pour le moment.</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                      Catalogue recent
                    </p>
                    <div className="mt-3 space-y-2">
                      {catalogueFrais.slice(0, 3).map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-slate-700">{getCatalogueFraisDisplayLabel(item)}</span>
                          <span className="font-semibold text-slate-900">
                            {formatMoney(toNumber(item.montant), item.devise ?? "MGA")}
                          </span>
                        </div>
                      ))}
                      {!isLoading && catalogueFrais.length === 0 ? (
                        <p className="text-sm text-slate-500">Aucun frais catalogue.</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                      Remises recentes
                    </p>
                    <div className="mt-3 space-y-2">
                      {remises.slice(0, 3).map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-slate-700">{getRemiseDisplayLabel(item)}</span>
                          <span className="font-semibold text-slate-900">{getRemiseTypeLabel(item.type)}</span>
                        </div>
                      ))}
                      {!isLoading && remises.length === 0 ? (
                        <p className="text-sm text-slate-500">Aucune remise configuree.</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>
        {isLoading ? (
          <section className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500 shadow-sm">
            Chargement des indicateurs financiers...
          </section>
        ) : null}
      </div>
    </FinanceModuleLayout>
  );
}




