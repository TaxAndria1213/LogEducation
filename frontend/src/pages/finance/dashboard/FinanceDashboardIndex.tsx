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
} from "react-icons/fi";
import ERPPage from "../../../components/page/ERPPage";
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

type FinanceDashboardTab = "synthese" | "retards" | "activite" | "automatisation" | "reporting";

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
  const [relances, setRelances] = useState<FinanceRelanceHistoryItem[]>([]);
  const [facturationsRecurrentes, setFacturationsRecurrentes] = useState<FacturationRecurrenteHistoryItem[]>([]);
  const [recurringReadiness, setRecurringReadiness] = useState<FacturationRecurrenteReadiness | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [sendingRelanceId, setSendingRelanceId] = useState<string | null>(null);
  const [isGeneratingRecurring, setIsGeneratingRecurring] = useState(false);
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

        const [
          facturesResult,
          paiementsResult,
          plansResult,
          catalogueResult,
          remisesResult,
          relancesResult,
          recurringHistoryResult,
          recurringReadinessResult,
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

  const collectionRate = totalFacture > 0 ? Math.min(100, (totalEncaisse / totalFacture) * 100) : 0;

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

  if (!canAccess) return <NotFound />;

  return (
    <ERPPage
      title="Finance"
      description="Tableau de bord global de la facturation, des encaissements et des echeanciers de l'etablissement."
    >
      <div className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <h2 className="text-2xl font-semibold text-slate-900">Vue d'ensemble financiere</h2>
              <p className="mt-2 text-sm text-slate-500">
                Suivi centralise des factures, paiements, plans de paiement, remises et frais reutilisables.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Taux de recouvrement
              </p>
              <p className="mt-1 text-2xl font-semibold text-emerald-900">
                {collectionRate.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}%
              </p>
            </div>
          </div>
          {errorMessage ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {errorMessage}
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500">
              <FiFileText />
              <span className="text-sm font-medium">Montant facture</span>
            </div>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{formatMoney(totalFacture)}</p>
            <p className="mt-2 text-xs text-slate-500">{factures.length} facture(s) suivie(s)</p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500">
              <FiCreditCard />
              <span className="text-sm font-medium">Montant encaisse</span>
            </div>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{formatMoney(totalEncaisse)}</p>
            <p className="mt-2 text-xs text-slate-500">
              {activePaiementsCount} paiement(s) actif(s), {reversedPaiementsCount} regularise(s)
            </p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500">
              <FiDollarSign />
              <span className="text-sm font-medium">Reste a recouvrer</span>
            </div>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{formatMoney(resteARecouvrer)}</p>
            <p className="mt-2 text-xs text-slate-500">{partiallyPaidInvoices} facture(s) partielle(s)</p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500">
              <FiAlertCircle />
              <span className="text-sm font-medium">Echeances en retard</span>
            </div>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{overdueEcheances.length}</p>
            <p className="mt-2 text-xs text-slate-500">
              {overdueStudents.length} eleve(s) concerne(s), {impactedOverdueInvoices} facture(s) impactee(s)
            </p>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm">
          <div className="overflow-x-auto">
            <div className="flex min-w-max items-center gap-2">
              {[
                { key: "synthese", label: "Synthese", helper: `${openEcheances.length} ouvertes` },
                { key: "retards", label: "Retards", helper: `${overdueStudents.length} eleves` },
                { key: "activite", label: "Activite", helper: `${recentPaiements.length} paiements` },
                { key: "reporting", label: "Reporting", helper: `${dailyReceipts.length} jour(s)` },
                { key: "automatisation", label: "Automatisation", helper: `${recurrentFraisCount} recurrents` },
              ].map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key as FinanceDashboardTab)}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      isActive
                        ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                    }`}
                  >
                    <div className="text-sm font-semibold">{tab.label}</div>
                    <div className={`mt-1 text-xs ${isActive ? "text-slate-200" : "text-slate-500"}`}>
                      {tab.helper}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
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
                              {item.count} encaissement(s) · {formatMoney(item.cash)} caisse ·{' '}
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
                              {item.studentsCount} eleve(s) · {item.invoicesCount} facture(s) ·{' '}
                              {item.niveauLabel ?? "Niveau non renseigne"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-slate-900">{formatMoney(item.totalFacture)}</p>
                            <p className="text-xs text-slate-500">
                              Encaisse {formatMoney(item.totalEncaisse)} · Reste {formatMoney(item.restant)}
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
    </ERPPage>
  );
}




