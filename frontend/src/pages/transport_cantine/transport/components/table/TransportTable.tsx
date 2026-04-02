import { useEffect, useMemo, useState } from "react";
import Spin from "../../../../../components/anim/Spin";
import { useAuth } from "../../../../../hooks/useAuth";
import { useInfo } from "../../../../../hooks/useInfo";
import LigneTransportService, {
  getLigneTransportSettings,
} from "../../../../../services/ligneTransport.service";
import ArretTransportService from "../../../../../services/arretTransport.service";
import {
  getCatalogueFraisSecondaryLabel,
  type CatalogueFraisWithRelations,
} from "../../../../../services/catalogueFrais.service";
import AbonnementTransportService, {
  getAbonnementTransportProrataLabel,
  type AbonnementTransportWithRelations,
  type OperationalTransportRow,
} from "../../../../../services/abonnementTransport.service";
import type {
  ArretTransport,
  HistoriqueAffectationTransport,
  LigneTransport,
} from "../../../../../types/models";

type TransportListMode = "lines" | "stops" | "subscriptions" | "eligibility";
type ChangeLineState = {
  ligne_transport_id: string;
  arret_transport_id: string;
  zone_transport: string;
  date_effet: string;
};
type UpdatePeriodState = {
  date_debut_service: string;
  date_fin_service: string;
};
type EligibilityOperationalStatus = "ACTIF" | "SUSPENDU" | "EN_ATTENTE" | "RADIE";
type EditLineState = {
  nom: string;
  zones_transport: string;
  inscriptions_ouvertes: boolean;
  prorata_mode: "MONTH" | "SCHOOL_YEAR";
  bloquer_si_a_facturer: boolean;
  bloquer_si_en_attente_reglement: boolean;
  bloquer_si_suspension_financiere: boolean;
  autoriser_avant_date_debut: boolean;
  validation_humaine_suspension_financiere: boolean;
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
  return "Impossible de charger les donnees transport.";
}

function formatDate(value?: string | Date | null) {
  if (!value) return "Non precise";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Non precise";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value?: string | Date | null) {
  if (!value) return "Non precise";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Non precise";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function formatMoney(value: number) {
  return `${value.toLocaleString("fr-FR")} MGA`;
}

function getDateOnly(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatZonesTransportValue(record?: Partial<LigneTransport> | null) {
  const settings = getLigneTransportSettings(record);
  return settings.zones
    .map((zone) =>
      settings.zoneTarifs[zone] != null ? `${zone}:${settings.zoneTarifs[zone]}` : zone,
    )
    .join(", ");
}

function getProrataModeLabel(value?: string | null) {
  return value === "SCHOOL_YEAR" ? "Annee scolaire" : "Mensuel";
}

function getOperationalStatusLabel(value: EligibilityOperationalStatus) {
  switch (value) {
    case "ACTIF":
      return "Actif";
    case "SUSPENDU":
      return "Suspendu";
    case "EN_ATTENTE":
      return "En attente";
    case "RADIE":
      return "Radie";
    default:
      return value;
  }
}

function getOperationalStatusTone(value: EligibilityOperationalStatus) {
  switch (value) {
    case "ACTIF":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "SUSPENDU":
      return "border-rose-200 bg-rose-50 text-rose-800";
    case "EN_ATTENTE":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "RADIE":
      return "border-slate-300 bg-slate-100 text-slate-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function isFinanciallyAuthorized(financeStatus?: string | null) {
  const normalized = (financeStatus ?? "").toUpperCase();
  return normalized === "REGLE" || normalized === "ACTIF";
}

function toCsvValue(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function extractCollectionRows<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: T[] }).data;
  }
  return [];
}

function extractCollectionMeta(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    "meta" in payload &&
    typeof (payload as { meta?: unknown }).meta === "object" &&
    (payload as { meta?: unknown }).meta !== null
  ) {
    return (payload as {
      meta: { hasNextPage?: boolean; page?: number; total?: number; take?: number };
    }).meta;
  }
  return null;
}

function getServiceStatusLabel(value?: string | null) {
  const normalized = (value ?? "").toUpperCase();
  switch (normalized) {
    case "EN_ATTENTE_VALIDATION_INTERNE":
      return "En attente interne";
    case "EN_ATTENTE_VALIDATION_FINANCIERE":
      return "En attente Finance";
    case "EN_ATTENTE_REGLEMENT":
      return "En attente reglement";
    case "EN_ATTENTE_SUSPENSION_FINANCIERE":
      return "Suspension en attente";
    case "ACTIF":
      return "Actif";
    case "SUSPENDU":
      return "Suspendu";
    case "SUSPENDU_FINANCE":
      return "Suspendu Finance";
    case "RESILIE":
      return "Resilie";
    case "ANNULE":
      return "Annule";
    case "INACTIF":
      return "Inactif";
    default:
      return value || "Actif";
  }
}

function getFinanceStatusLabel(value?: string | null) {
  switch ((value ?? "").toUpperCase()) {
    case "VALIDATION_INTERNE":
      return "Validation interne";
    case "A_FACTURER":
      return "A facturer";
    case "EN_ATTENTE_REGLEMENT":
      return "En attente de reglement";
    case "SUSPENSION_SIGNALEE":
      return "Suspension signalee";
    case "REGLE":
      return "Regle";
    case "SUSPENDU":
      return "Suspendu";
    case "RESILIE":
      return "Resilie";
    default:
      return value || "Non renseigne";
  }
}

function getAccessStatusLabel(value?: string | null) {
  switch ((value ?? "").toUpperCase()) {
    case "AUTORISE":
      return "Autorise";
    case "SUSPENDU":
      return "Suspendu";
    case "EN_ATTENTE":
      return "En attente";
    case "EXPIRE":
      return "Expire";
    default:
      return value || "En attente";
  }
}

function getAccessStatusTone(value?: string | null) {
  switch ((value ?? "").toUpperCase()) {
    case "AUTORISE":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "SUSPENDU":
      return "border-rose-200 bg-rose-50 text-rose-800";
    case "EXPIRE":
      return "border-slate-300 bg-slate-100 text-slate-700";
    default:
      return "border-amber-200 bg-amber-50 text-amber-800";
  }
}

function getAssignmentDetailsFromHistory(history?: HistoriqueAffectationTransport) {
  if (!history || !history.details_json || typeof history.details_json !== "object" || Array.isArray(history.details_json)) {
    return null;
  }
  const raw = history.details_json as Record<string, unknown>;
  return {
    oldLineLabel: typeof raw.old_line_label === "string" ? raw.old_line_label : null,
    newLineLabel: typeof raw.new_line_label === "string" ? raw.new_line_label : null,
    oldAmount:
      raw.old_effective_amount != null && Number.isFinite(Number(raw.old_effective_amount))
        ? Number(raw.old_effective_amount)
        : null,
    newAmount:
      raw.new_effective_amount != null && Number.isFinite(Number(raw.new_effective_amount))
        ? Number(raw.new_effective_amount)
        : null,
    reason: typeof raw.reason === "string" ? raw.reason : null,
    statusRule: typeof raw.status_rule === "string" ? raw.status_rule : null,
  };
}

function ModeSelector({
  value,
  onChange,
}: {
  value: TransportListMode;
  onChange: (value: TransportListMode) => void;
}) {
  const items: Array<{ id: TransportListMode; label: string }> = [
    { id: "lines", label: "Lignes" },
    { id: "stops", label: "Arrets" },
    { id: "subscriptions", label: "Abonnements" },
    { id: "eligibility", label: "Controle acces" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              active
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function getStatusRuleLabel(rule?: string | null) {
  if (!rule) return null;
  if (rule === "IMPACT_REQUIRE_FINANCE_VALIDATION") {
    return "Regle: impact financier -> validation Finance requise";
  }
  if (rule === "IMPACT_KEEP_INTERNAL_VALIDATION") {
    return "Regle: impact financier mais validation interne encore requise";
  }
  if (rule.startsWith("IMPACT_KEEP_OPERATIONAL_")) {
    return "Regle: statut operationnel conserve malgre l'impact";
  }
  if (rule.startsWith("KEEP_")) {
    return "Regle: aucun impact financier, statut conserve";
  }
  if (rule === "KEEP_DEFAULT_ACTIF") {
    return "Regle: aucun impact financier, retour a ACTIF";
  }
  return `Regle: ${rule}`;
}

export default function TransportTable() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const [mode, setMode] = useState<TransportListMode>("lines");
  const [lignes, setLignes] = useState<LigneTransport[]>([]);
  const [arrets, setArrets] = useState<(ArretTransport & {
    ligne?: LigneTransport | null;
  })[]>([]);
  const [abonnements, setAbonnements] = useState<AbonnementTransportWithRelations[]>(
    [],
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingSubscriptionId, setEditingSubscriptionId] = useState<string | null>(null);
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [eligibilityDate, setEligibilityDate] = useState(getTodayInputValue());
  const [eligibilityPeriodStart, setEligibilityPeriodStart] = useState("");
  const [eligibilityPeriodEnd, setEligibilityPeriodEnd] = useState("");
  const [eligibilityLineFilter, setEligibilityLineFilter] = useState("ALL");
  const [eligibilityStatusFilter, setEligibilityStatusFilter] =
    useState<"ALL" | EligibilityOperationalStatus>("ALL");
  const [editLineState, setEditLineState] = useState<EditLineState>({
    nom: "",
    zones_transport: "",
    inscriptions_ouvertes: true,
    prorata_mode: "MONTH",
    bloquer_si_a_facturer: true,
    bloquer_si_en_attente_reglement: true,
    bloquer_si_suspension_financiere: true,
    autoriser_avant_date_debut: false,
    validation_humaine_suspension_financiere: false,
  });
  const [changeLineState, setChangeLineState] = useState<ChangeLineState>({
    ligne_transport_id: "",
    arret_transport_id: "",
    zone_transport: "",
    date_effet: getTodayInputValue(),
  });
  const [updatePeriodState, setUpdatePeriodState] = useState<UpdatePeriodState>({
    date_debut_service: "",
    date_fin_service: "",
  });
  const [operationalRows, setOperationalRows] = useState<OperationalTransportRow[]>([]);
  const [operationalSummary, setOperationalSummary] = useState({
    actifs: 0,
    suspendus: 0,
    en_attente: 0,
    radies: 0,
    transportes_non_finances: 0,
    finances_non_transportables: 0,
  });
  const [loadingOperational, setLoadingOperational] = useState(false);

  const refreshOperationalList = async () => {
    if (mode !== "eligibility" || !etablissement_id) return;
    setLoadingOperational(true);
    try {
      const response = await new AbonnementTransportService().getOperationalList(etablissement_id, {
        reference_date: eligibilityDate || undefined,
        period_start: eligibilityPeriodStart || undefined,
        period_end: eligibilityPeriodEnd || undefined,
        ligne_transport_id: eligibilityLineFilter !== "ALL" ? eligibilityLineFilter : undefined,
        operational_status: eligibilityStatusFilter !== "ALL" ? eligibilityStatusFilter : undefined,
        search: searchTerm.trim() || undefined,
      });
      const payload =
        response?.data && typeof response.data === "object" && !Array.isArray(response.data)
          ? (response.data as {
              rows?: OperationalTransportRow[];
              summary?: typeof operationalSummary;
            })
          : {};
      setOperationalRows(Array.isArray(payload.rows) ? payload.rows : []);
      setOperationalSummary(payload.summary ?? {
        actifs: 0,
        suspendus: 0,
        en_attente: 0,
        radies: 0,
        transportes_non_finances: 0,
        finances_non_transportables: 0,
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoadingOperational(false);
    }
  };

  const load = async () => {
    if (!etablissement_id) return;
    setLoading(true);
    try {
      const abonnementService = new AbonnementTransportService();
      const fetchAllTransportSubscriptions = async () => {
        const collected: AbonnementTransportWithRelations[] = [];
        let page = 1;
        let hasNextPage = true;

        while (hasNextPage) {
          const response = await abonnementService.getForEtablissement(etablissement_id, {
            page,
            take: 5000,
            includeSpec: JSON.stringify({
              eleve: { include: { utilisateur: { include: { profil: true } } } },
              annee: true,
              ligne: true,
              arret: true,
            }),
          });
          const rows = extractCollectionRows<AbonnementTransportWithRelations>(response?.data);
          const meta = extractCollectionMeta(response?.data);
          collected.push(...rows);
          hasNextPage = meta?.hasNextPage === true;
          page += 1;
          if (rows.length === 0) {
            hasNextPage = false;
          }
        }

        return collected;
      };

      const [lignesResult, arretsResult, abonnements] = await Promise.all([
        new LigneTransportService().getForEtablissement(etablissement_id, {
          take: 500,
          includeSpec: JSON.stringify({ frais: true }),
        }),
        new ArretTransportService().getForEtablissement(etablissement_id, {
          take: 1000,
          includeSpec: JSON.stringify({ ligne: true }),
        }),
        fetchAllTransportSubscriptions(),
      ]);
      setLignes(lignesResult?.status.success ? lignesResult.data.data : []);
      setArrets(arretsResult?.status.success ? arretsResult.data.data : []);
      setAbonnements(abonnements);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [etablissement_id]);

  useEffect(() => {
    if (mode !== "eligibility" || !etablissement_id) return;

    let cancelled = false;
    const run = async () => {
      await refreshOperationalList();
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    eligibilityDate,
    eligibilityLineFilter,
    eligibilityPeriodEnd,
    eligibilityPeriodStart,
    eligibilityStatusFilter,
    etablissement_id,
    mode,
    searchTerm,
  ]);

  const handleRecordUsage = async (item: OperationalTransportRow) => {
    setBusyId(item.id);
    try {
      await new AbonnementTransportService().recordUsage(item.id, {
        usage_date:
          eligibilityDate ||
          (item.evaluation_date instanceof Date
            ? item.evaluation_date.toISOString().slice(0, 10)
            : typeof item.evaluation_date === "string"
              ? item.evaluation_date
              : getTodayInputValue()),
        note: "Pointage depuis le controle d'acces transport.",
      });
      info("Passage transport enregistre.", "success");
      await refreshOperationalList();
    } catch (error) {
      info(getErrorMessage(error), "error");
    } finally {
      setBusyId(null);
    }
  };

  const stopsByLine = useMemo(() => {
    const grouped = new Map<string, ArretTransport[]>();
    for (const item of arrets) {
      const current = grouped.get(item.ligne_transport_id) ?? [];
      current.push(item);
      grouped.set(item.ligne_transport_id, current);
    }
    return grouped;
  }, [arrets]);

  const openChangeLine = (item: AbonnementTransportWithRelations) => {
    setEditingSubscriptionId(item.id);
    setEditingPeriodId(null);
    setChangeLineState({
      ligne_transport_id: item.ligne_transport_id,
      arret_transport_id: item.arret_transport_id ?? "",
      zone_transport: item.zone_transport ?? "",
      date_effet: getTodayInputValue(),
    });
  };
  const openPeriodEditor = (item: AbonnementTransportWithRelations) => {
    setEditingPeriodId(item.id);
    setEditingSubscriptionId(null);
    setUpdatePeriodState({
      date_debut_service:
        item.date_debut_service instanceof Date
          ? item.date_debut_service.toISOString().slice(0, 10)
          : typeof item.date_debut_service === "string"
            ? item.date_debut_service.slice(0, 10)
            : "",
      date_fin_service:
        item.date_fin_service instanceof Date
          ? item.date_fin_service.toISOString().slice(0, 10)
          : typeof item.date_fin_service === "string"
            ? item.date_fin_service.slice(0, 10)
            : "",
    });
  };
  const openLineEditor = (item: LigneTransport) => {
    const settings = getLigneTransportSettings(item);
    setEditingLineId(item.id);
    setEditLineState({
      nom: item.nom,
      zones_transport: formatZonesTransportValue(item),
      inscriptions_ouvertes: settings.inscriptions_ouvertes,
      prorata_mode: settings.prorataMode,
      bloquer_si_a_facturer: settings.accessRules.bloquer_si_a_facturer,
      bloquer_si_en_attente_reglement: settings.accessRules.bloquer_si_en_attente_reglement,
      bloquer_si_suspension_financiere: settings.accessRules.bloquer_si_suspension_financiere,
      autoriser_avant_date_debut: settings.accessRules.autoriser_avant_date_debut,
      validation_humaine_suspension_financiere:
        settings.accessRules.validation_humaine_suspension_financiere,
    });
  };

  const selectedChangeLine = useMemo(
    () => lignes.find((item) => item.id === changeLineState.ligne_transport_id) ?? null,
    [changeLineState.ligne_transport_id, lignes],
  );
  const selectedChangeLineSettings = useMemo(
    () => getLigneTransportSettings(selectedChangeLine),
    [selectedChangeLine],
  );
  const eligibilityReferenceDate = useMemo(
    () => getDateOnly(eligibilityDate) ?? getDateOnly(new Date()) ?? new Date(),
    [eligibilityDate],
  );
  const filteredAbonnements = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return abonnements;

    return abonnements.filter((item) => {
      const haystack = [
        item.eleve?.utilisateur?.profil?.prenom,
        item.eleve?.utilisateur?.profil?.nom,
        item.eleve?.code_eleve,
        item.ligne?.nom,
        item.arret?.nom,
        item.zone_transport,
        item.annee?.nom,
        item.access_status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [abonnements, searchTerm]);
  const getEligibilityAccessForDate = (
    item: AbonnementTransportWithRelations,
    referenceDate: Date,
  ) => {
    const settings = getLigneTransportSettings(item.ligne);
    const rules = settings.accessRules;
    const serviceStatus = (item.statut ?? "").toUpperCase();
    const financeStatus = (item.finance_status ?? "").toUpperCase();
    const startDate = getDateOnly(item.date_debut_service);
    const endDate = getDateOnly(item.date_fin_service);

    if (endDate && endDate < referenceDate) return "EXPIRE";
    if (["RESILIE", "ANNULE", "INACTIF"].includes(serviceStatus) || financeStatus === "RESILIE") {
      return "EXPIRE";
    }
    if (
      serviceStatus === "SUSPENDU" ||
      serviceStatus === "SUSPENDU_FINANCE" ||
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
      ].includes(serviceStatus)
    ) {
      return "EN_ATTENTE";
    }
    return "AUTORISE";
  };

  const getOperationalStatusForDate = (
    item: AbonnementTransportWithRelations,
    referenceDate: Date,
  ): EligibilityOperationalStatus => {
    const serviceStatus = (item.statut ?? "").toUpperCase();
    if (["RESILIE", "ANNULE", "INACTIF"].includes(serviceStatus)) {
      return "RADIE";
    }
    const accessStatus = getEligibilityAccessForDate(item, referenceDate);
    if (accessStatus === "AUTORISE") return "ACTIF";
    if (accessStatus === "SUSPENDU") return "SUSPENDU";
    if (accessStatus === "EN_ATTENTE") return "EN_ATTENTE";
    return "RADIE";
  };

  const doesSubscriptionMatchOperationalWindow = (
    item: AbonnementTransportWithRelations,
    referenceDate: Date,
  ) => {
    const startDate = getDateOnly(item.date_debut_service);
    const endDate = getDateOnly(item.date_fin_service);
    const periodStart = getDateOnly(eligibilityPeriodStart);
    const periodEnd = getDateOnly(eligibilityPeriodEnd);

    if (periodStart || periodEnd) {
      const rawStart = periodStart ?? periodEnd ?? referenceDate;
      const rawEnd = periodEnd ?? periodStart ?? referenceDate;
      const windowStart = rawStart <= rawEnd ? rawStart : rawEnd;
      const windowEnd = rawEnd >= rawStart ? rawEnd : rawStart;
      const effectiveStart = startDate ?? windowStart;
      const effectiveEnd = endDate ?? windowEnd;
      return effectiveStart <= windowEnd && effectiveEnd >= windowStart;
    }

    const effectiveStart = startDate ?? referenceDate;
    const effectiveEnd = endDate ?? referenceDate;
    return effectiveStart <= referenceDate && effectiveEnd >= referenceDate;
  };

  const getOperationalEvaluationDate = (
    item: AbonnementTransportWithRelations,
    referenceDate: Date,
  ) => {
    const startDate = getDateOnly(item.date_debut_service);
    const endDate = getDateOnly(item.date_fin_service);
    const periodStart = getDateOnly(eligibilityPeriodStart);
    const periodEnd = getDateOnly(eligibilityPeriodEnd);

    if (periodStart || periodEnd) {
      const rawWindowStart = periodStart ?? periodEnd ?? referenceDate;
      const rawWindowEnd = periodEnd ?? periodStart ?? referenceDate;
      const windowStart = rawWindowStart <= rawWindowEnd ? rawWindowStart : rawWindowEnd;
      const windowEnd = rawWindowEnd >= rawWindowStart ? rawWindowEnd : rawWindowStart;
      const overlapStart = startDate && startDate > windowStart ? startDate : windowStart;
      const overlapEnd = endDate && endDate < windowEnd ? endDate : windowEnd;
      if (overlapStart > overlapEnd) {
        return null;
      }
      if (referenceDate < overlapStart) return overlapStart;
      if (referenceDate > overlapEnd) return overlapEnd;
      return referenceDate;
    }

    return referenceDate;
  };

  const eligibilityAbonnements = useMemo(() => {
    return filteredAbonnements
      .filter((item) => {
        if (eligibilityLineFilter !== "ALL" && item.ligne_transport_id !== eligibilityLineFilter) {
          return false;
        }
        if (!doesSubscriptionMatchOperationalWindow(item, eligibilityReferenceDate)) {
          return false;
        }
        const evaluationDate = getOperationalEvaluationDate(item, eligibilityReferenceDate);
        if (!evaluationDate) return false;
        const operationalStatus = getOperationalStatusForDate(item, evaluationDate);
        if (eligibilityStatusFilter !== "ALL" && operationalStatus !== eligibilityStatusFilter) {
          return false;
        }
        return true;
      })
      .map((item) => ({
        item,
        evaluationDate: getOperationalEvaluationDate(item, eligibilityReferenceDate),
        operationalStatus: getOperationalStatusForDate(
          item,
          getOperationalEvaluationDate(item, eligibilityReferenceDate) ?? eligibilityReferenceDate,
        ),
        accessForDate: getEligibilityAccessForDate(
          item,
          getOperationalEvaluationDate(item, eligibilityReferenceDate) ?? eligibilityReferenceDate,
        ),
        financeAuthorized: isFinanciallyAuthorized(item.finance_status),
      }));
  }, [
    filteredAbonnements,
    eligibilityLineFilter,
    eligibilityPeriodStart,
    eligibilityPeriodEnd,
    eligibilityReferenceDate,
    eligibilityStatusFilter,
  ]);

  const sortedEligibilityAbonnements = useMemo(() => {
    const priority = new Map<EligibilityOperationalStatus, number>([
      ["SUSPENDU", 0],
      ["EN_ATTENTE", 1],
      ["RADIE", 2],
      ["ACTIF", 3],
    ]);

    return [...eligibilityAbonnements].sort((left, right) => {
      const leftPriority = priority.get(left.operationalStatus) ?? 9;
      const rightPriority = priority.get(right.operationalStatus) ?? 9;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;

      const leftName = [
        left.item.eleve?.utilisateur?.profil?.prenom,
        left.item.eleve?.utilisateur?.profil?.nom,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const rightName = [
        right.item.eleve?.utilisateur?.profil?.prenom,
        right.item.eleve?.utilisateur?.profil?.nom,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return leftName.localeCompare(rightName);
    });
  }, [eligibilityAbonnements]);

  const exportEligibilityList = () => {
    const lines = [
        [
          "Date_reference",
          "Periode_debut",
          "Periode_fin",
          "Date_evaluation",
          "Circuit",
          "Arret",
          "Zone",
        "Code_eleve",
        "Prenom",
        "Nom",
        "Debut_service",
        "Fin_service",
        "Statut_service",
        "Statut_finance",
        "Statut_exploitation",
        "Acces_calcule",
        "Finance_autorisee",
      ]
        .map(toCsvValue)
        .join(","),
      ...operationalRows.map((item) =>
        [
          eligibilityDate || "",
          eligibilityPeriodStart || "",
          eligibilityPeriodEnd || "",
          formatDate(item.evaluation_date),
          item.ligne?.nom ?? "",
          item.arret?.nom ?? "",
          item.zone_transport ?? "",
          item.eleve?.code_eleve ?? "",
          item.eleve?.utilisateur?.profil?.prenom ?? "",
          item.eleve?.utilisateur?.profil?.nom ?? "",
          formatDate(item.date_debut_service),
          formatDate(item.date_fin_service),
          getServiceStatusLabel(item.statut),
          getFinanceStatusLabel(item.finance_status),
          getOperationalStatusLabel(item.operational_status),
          getAccessStatusLabel(item.access_for_date),
          item.finance_authorized ? "Oui" : "Non",
        ]
          .map(toCsvValue)
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([lines], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `transport-liste-exploitation-${eligibilityDate || "periode"}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Liste transport</h3>
            <p className="mt-1 text-sm text-slate-500">
              Chaque liste est separee pour simplifier la lecture et les suppressions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-2xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Actualisation..." : "Actualiser"}
          </button>
        </div>

        <div className="mt-5">
          <ModeSelector value={mode} onChange={setMode} />
        </div>

        {loading ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <Spin label="Chargement de la liste transport..." showLabel />
          </div>
        ) : null}
      </section>

      {mode === "lines" ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Lignes de transport</h3>
          <div className="mt-4 space-y-3">
            {lignes.map((item) => (
              <div
                key={item.id}
                className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.nom}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.frais
                        ? `${item.frais.nom} - ${getCatalogueFraisSecondaryLabel(item.frais as CatalogueFraisWithRelations)}`
                        : "Aucun frais catalogue relie"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Zones: {getLigneTransportSettings(item).zones.join(", ") || "Aucune zone"}
                    </p>
                    {Object.keys(getLigneTransportSettings(item).zoneTarifs).length > 0 ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Tarifs zones: {Object.entries(getLigneTransportSettings(item).zoneTarifs)
                          .map(([zone, amount]) => `${zone} (${formatMoney(amount)})`)
                          .join(", ")}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-slate-500">
                      Regles acces:{" "}
                      {[
                        getLigneTransportSettings(item).accessRules.bloquer_si_a_facturer
                          ? "bloque a facturer"
                          : "a facturer autorise",
                        getLigneTransportSettings(item).accessRules.bloquer_si_en_attente_reglement
                          ? "bloque attente reglement"
                          : "attente reglement autorisee",
                        getLigneTransportSettings(item).accessRules.bloquer_si_suspension_financiere
                          ? "suspension financiere bloquante"
                          : "suspension financiere non bloquante",
                        getLigneTransportSettings(item).accessRules.autoriser_avant_date_debut
                          ? "acces avant debut autorise"
                          : "acces avant debut bloque",
                        getLigneTransportSettings(item).accessRules
                          .validation_humaine_suspension_financiere
                          ? "validation humaine suspension"
                          : "suspension auto Finance",
                      ].join(" - ")}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Prorata: {getProrataModeLabel(getLigneTransportSettings(item).prorataMode)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Inscriptions: {getLigneTransportSettings(item).inscriptions_ouvertes ? "ouvertes" : "fermees"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openLineEditor(item)}
                      disabled={busyId === item.id}
                      className="rounded-2xl border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {editingLineId === item.id ? "Edition ouverte" : "Modifier"}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          setBusyId(item.id);
                          await new LigneTransportService().delete(item.id);
                          info("Ligne supprimee.", "success");
                          await load();
                        } catch (error) {
                          info(getErrorMessage(error), "error");
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      disabled={busyId === item.id}
                      className="rounded-2xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyId === item.id ? "Suppression..." : "Supprimer"}
                    </button>
                  </div>
                </div>

                {editingLineId === item.id ? (
                  <div className="mt-4 grid gap-4 rounded-[20px] border border-sky-200 bg-white px-4 py-4 md:grid-cols-2">
                    <label className="space-y-2 text-sm text-slate-700">
                      <span className="font-medium">Nom de la ligne</span>
                      <input
                        type="text"
                        value={editLineState.nom}
                        onChange={(event) =>
                          setEditLineState((current) => ({ ...current, nom: event.target.value }))
                        }
                        disabled={busyId === item.id}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                      />
                    </label>

                    <label className="space-y-2 text-sm text-slate-700">
                      <span className="font-medium">Mode de prorata</span>
                      <select
                        value={editLineState.prorata_mode}
                        onChange={(event) =>
                          setEditLineState((current) => ({
                            ...current,
                            prorata_mode: event.target.value as "MONTH" | "SCHOOL_YEAR",
                          }))
                        }
                        disabled={busyId === item.id}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                      >
                        <option value="MONTH">Mensuel</option>
                        <option value="SCHOOL_YEAR">Annee scolaire</option>
                      </select>
                    </label>

                    <label className="space-y-2 text-sm text-slate-700">
                      <span className="font-medium">Zones</span>
                      <input
                        type="text"
                        value={editLineState.zones_transport}
                        onChange={(event) =>
                          setEditLineState((current) => ({
                            ...current,
                            zones_transport: event.target.value,
                          }))
                        }
                        disabled={busyId === item.id}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                        placeholder="Nord:15000, Centre:12000, Sud"
                      />
                    </label>

                    <label className="flex items-start gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={editLineState.inscriptions_ouvertes}
                        onChange={(event) =>
                          setEditLineState((current) => ({
                            ...current,
                            inscriptions_ouvertes: event.target.checked,
                          }))
                        }
                        disabled={busyId === item.id}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300"
                      />
                      <span>Inscriptions ouvertes</span>
                    </label>

                    <label className="flex items-start gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={editLineState.bloquer_si_a_facturer}
                        onChange={(event) =>
                          setEditLineState((current) => ({
                            ...current,
                            bloquer_si_a_facturer: event.target.checked,
                          }))
                        }
                        disabled={busyId === item.id}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300"
                      />
                      <span>Bloquer si le dossier est a facturer</span>
                    </label>

                    <label className="flex items-start gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={editLineState.bloquer_si_en_attente_reglement}
                        onChange={(event) =>
                          setEditLineState((current) => ({
                            ...current,
                            bloquer_si_en_attente_reglement: event.target.checked,
                          }))
                        }
                        disabled={busyId === item.id}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300"
                      />
                      <span>Bloquer si le reglement est en attente</span>
                    </label>

                    <label className="flex items-start gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={editLineState.bloquer_si_suspension_financiere}
                        onChange={(event) =>
                          setEditLineState((current) => ({
                            ...current,
                            bloquer_si_suspension_financiere: event.target.checked,
                          }))
                        }
                        disabled={busyId === item.id}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300"
                      />
                      <span>Bloquer si Finance suspend le dossier</span>
                    </label>

                    <label className="flex items-start gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={editLineState.autoriser_avant_date_debut}
                        onChange={(event) =>
                          setEditLineState((current) => ({
                            ...current,
                            autoriser_avant_date_debut: event.target.checked,
                          }))
                        }
                        disabled={busyId === item.id}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300"
                      />
                      <span>Autoriser avant la date de debut</span>
                    </label>

                    <label className="flex items-start gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={editLineState.validation_humaine_suspension_financiere}
                        onChange={(event) =>
                          setEditLineState((current) => ({
                            ...current,
                            validation_humaine_suspension_financiere: event.target.checked,
                          }))
                        }
                        disabled={busyId === item.id}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300"
                      />
                      <span>Validation humaine avant suspension financiere</span>
                    </label>

                    <div className="md:col-span-2 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingLineId(null)}
                        disabled={busyId === item.id}
                        className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            if (!editLineState.nom.trim()) {
                              throw new Error("Le nom de la ligne est obligatoire.");
                            }
                            if (!editLineState.zones_transport.trim()) {
                              throw new Error("Au moins une zone est obligatoire.");
                            }
                            if (!item.catalogue_frais_id) {
                              throw new Error("Cette ligne ne possede pas de frais catalogue exploitable.");
                            }
                            setBusyId(item.id);
                            await new LigneTransportService().update(item.id, {
                              etablissement_id,
                              nom: editLineState.nom.trim(),
                              catalogue_frais_id: item.catalogue_frais_id,
                              zones_transport: editLineState.zones_transport,
                              inscriptions_ouvertes: editLineState.inscriptions_ouvertes,
                              prorata_mode: editLineState.prorata_mode,
                              bloquer_si_a_facturer: editLineState.bloquer_si_a_facturer,
                              bloquer_si_en_attente_reglement:
                                editLineState.bloquer_si_en_attente_reglement,
                              bloquer_si_suspension_financiere:
                                editLineState.bloquer_si_suspension_financiere,
                              autoriser_avant_date_debut:
                                editLineState.autoriser_avant_date_debut,
                              validation_humaine_suspension_financiere:
                                editLineState.validation_humaine_suspension_financiere,
                            });
                            info("Ligne transport mise a jour.", "success");
                            setEditingLineId(null);
                            await load();
                          } catch (error) {
                            info(getErrorMessage(error), "error");
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        disabled={busyId === item.id}
                        className="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyId === item.id ? "Enregistrement..." : "Enregistrer"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {mode === "stops" ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Arrets de transport</h3>
          <div className="mt-4 space-y-3">
            {arrets.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.nom}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.ligne?.nom ?? "Sans ligne"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setBusyId(item.id);
                      await new ArretTransportService().delete(item.id);
                      info("Arret supprime.", "success");
                      await load();
                    } catch (error) {
                      info(getErrorMessage(error), "error");
                    } finally {
                      setBusyId(null);
                    }
                  }}
                  disabled={busyId === item.id}
                  className="rounded-2xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyId === item.id ? "Suppression..." : "Supprimer"}
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {mode === "subscriptions" ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Abonnements transport</h3>
              <p className="mt-1 text-sm text-slate-500">
                Recherche rapide d&apos;un eleve et lecture directe de son droit d&apos;acces.
              </p>
            </div>
            <label className="w-full max-w-sm space-y-2 text-sm text-slate-700">
              <span className="font-medium">Rechercher un eleve</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Nom, prenom, code eleve, ligne..."
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              />
            </label>
          </div>
          <div className="mt-4 space-y-3">
            {filteredAbonnements.map((item) => (
              <div
                key={item.id}
                className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {item.eleve?.utilisateur?.profil?.prenom}{" "}
                      {item.eleve?.utilisateur?.profil?.nom}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.ligne?.nom}
                      {item.arret?.nom ? ` - ${item.arret.nom}` : ""} -{" "}
                      {item.annee?.nom ?? "Annee"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Zone: {item.zone_transport?.trim() || "Non precisee"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Statut service: {getServiceStatusLabel(item.statut)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Acces: {getAccessStatusLabel(item.access_status)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Debut: {formatDate(item.date_debut_service)} - Fin: {formatDate(item.date_fin_service)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {getAbonnementTransportProrataLabel(item)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Finance: {getFinanceStatusLabel(item.finance_status)}
                      {item.facture?.numero_facture
                        ? ` - ${item.facture.numero_facture} (${item.facture.statut ?? "EMISE"})`
                        : ""}
                    </p>
                    {["EN_ATTENTE_VALIDATION_INTERNE", "EN_ATTENTE_VALIDATION_FINANCIERE", "EN_ATTENTE_REGLEMENT", "EN_ATTENTE_SUSPENSION_FINANCIERE"].includes(
                      (item.statut ?? "").toUpperCase(),
                    ) ? (
                      <p className="mt-1 text-xs font-medium text-amber-700">
                        {(item.statut ?? "").toUpperCase() === "EN_ATTENTE_VALIDATION_INTERNE"
                          ? "La demande doit d'abord etre validee par le responsable transport."
                          : (item.statut ?? "").toUpperCase() === "EN_ATTENTE_SUSPENSION_FINANCIERE"
                            ? "Finance a signale un impaye. La suspension attend la validation du responsable transport."
                          : item.finance_status === "A_FACTURER"
                            ? "Le service est transmis a Finance et reste a facturer."
                            : "Le service reste en attente tant que Finance n'a pas confirme la situation financiere."}
                      </p>
                    ) : null}
                    {(item.access_status ?? "").toUpperCase() === "AUTORISE" ? (
                      <p className="mt-1 text-xs font-medium text-emerald-700">
                        Acces autorise selon les regles transport et le statut transmis par Finance.
                      </p>
                    ) : null}
                    {(item.access_status ?? "").toUpperCase() === "AUTORISE" &&
                    item.derniere_reactivation_financiere ? (
                      <p className="mt-1 text-xs font-medium text-sky-700">
                        Service reactive apres regularisation Finance le{" "}
                        {formatDateTime(item.derniere_reactivation_financiere)}.
                      </p>
                    ) : null}
                    {(item.access_status ?? "").toUpperCase() === "SUSPENDU" ? (
                      <p className="mt-1 text-xs font-medium text-rose-700">
                        Acces suspendu. Le service ou la situation financiere bloque l&apos;utilisation.
                      </p>
                    ) : null}
                    {(item.access_status ?? "").toUpperCase() === "EXPIRE" ? (
                      <p className="mt-1 text-xs font-medium text-slate-600">
                        Acces expire. La periode de validite est terminee ou le service n&apos;est plus actif.
                      </p>
                    ) : null}
                    {item.historiquesAffectation && item.historiquesAffectation.length > 0 ? (
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-600">
                        <p className="font-semibold text-slate-800">Historique recent des affectations</p>
                        <div className="mt-2 space-y-2">
                          {item.historiquesAffectation.map((history) => {
                            const details = getAssignmentDetailsFromHistory(history);
                            const statusRuleLabel = getStatusRuleLabel(details?.statusRule);
                            return (
                              <div
                                key={history.id}
                                className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                              >
                                <p>
                                  {details?.oldLineLabel ?? "Ligne precedente"}
                                  {" -> "}
                                  {details?.newLineLabel ?? item.ligne?.nom ?? "Nouvelle ligne"}
                                </p>
                                <p className="mt-1">
                                  Zone {history.ancienne_zone_transport ?? "N/A"}
                                  {" -> "}
                                  {history.nouvelle_zone_transport ?? "N/A"} le {formatDate(history.date_effet)}
                                </p>
                                {history.impact_tarifaire ? (
                                  <p className="mt-1 font-medium text-amber-700">
                                    Impact financier detecte
                                    {details?.oldAmount != null && details?.newAmount != null
                                      ? ` : ${formatMoney(details.oldAmount)} -> ${formatMoney(details.newAmount)}`
                                      : ""}
                                  </p>
                                ) : (
                                  <p className="mt-1 text-emerald-700">Aucun impact financier detecte.</p>
                                )}
                                {statusRuleLabel ? (
                                  <p className="mt-1 text-slate-500">{statusRuleLabel}</p>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(item.statut ?? "").toUpperCase() === "EN_ATTENTE_VALIDATION_INTERNE" ? (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            setBusyId(item.id);
                            await new AbonnementTransportService().approveRequest(item.id);
                            info("Demande transport validee et transmise a Finance.", "success");
                            await load();
                          } catch (error) {
                            info(getErrorMessage(error), "error");
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        disabled={busyId === item.id}
                        className="rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyId === item.id ? "Traitement..." : "Valider la demande"}
                      </button>
                    ) : null}
                    {(item.statut ?? "").toUpperCase() === "EN_ATTENTE_SUSPENSION_FINANCIERE" ? (
                      <>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              setBusyId(item.id);
                              await new AbonnementTransportService().approveFinanceSuspension(item.id);
                              info("Suspension transport validee.", "success");
                              await load();
                            } catch (error) {
                              info(getErrorMessage(error), "error");
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          disabled={busyId === item.id}
                          className="rounded-2xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busyId === item.id ? "Traitement..." : "Valider suspension"}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              setBusyId(item.id);
                              await new AbonnementTransportService().rejectFinanceSuspension(item.id);
                              info("Suspension transport rejetee.", "success");
                              await load();
                            } catch (error) {
                              info(getErrorMessage(error), "error");
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          disabled={busyId === item.id}
                          className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busyId === item.id ? "Traitement..." : "Rejeter suspension"}
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => openChangeLine(item)}
                      disabled={busyId === item.id}
                      className="rounded-2xl border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {editingSubscriptionId === item.id ? "Edition ouverte" : "Changer circuit"}
                    </button>
                    <button
                      type="button"
                      onClick={() => openPeriodEditor(item)}
                      disabled={busyId === item.id}
                      className="rounded-2xl border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {editingPeriodId === item.id ? "Periode ouverte" : "Mettre a jour periode"}
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          setBusyId(item.id);
                          await new AbonnementTransportService().delete(item.id);
                          info(
                            item.facture_id ? "Abonnement transport resilie et regularise." : "Abonnement transport supprime.",
                            "success",
                          );
                          if (editingSubscriptionId === item.id) {
                            setEditingSubscriptionId(null);
                          }
                          await load();
                        } catch (error) {
                          info(getErrorMessage(error), "error");
                        } finally {
                          setBusyId(null);
                        }
                      }}
                      disabled={busyId === item.id}
                      className="rounded-2xl border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyId === item.id ? "Traitement..." : item.facture_id ? "Resilier" : "Supprimer"}
                    </button>
                  </div>
                </div>

                {editingSubscriptionId === item.id ? (
                  <div className="mt-4 grid gap-4 rounded-[20px] border border-sky-200 bg-white px-4 py-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <p className="text-sm font-semibold text-slate-900">Changer de circuit</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Le changement de service sera transmis a Finance pour regularisation apres validation.
                      </p>
                    </div>

                    <label className="space-y-2 text-sm text-slate-700">
                      <span className="font-medium">Nouvelle ligne</span>
                      <select
                        value={changeLineState.ligne_transport_id}
                        onChange={(event) =>
                          setChangeLineState((current) => ({
                            ...current,
                            ligne_transport_id: event.target.value,
                            arret_transport_id: "",
                            zone_transport: "",
                          }))
                        }
                        disabled={busyId === item.id}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                      >
                        <option value="">Selectionner une ligne</option>
                        {lignes.map((ligne) => (
                          <option key={ligne.id} value={ligne.id}>
                            {ligne.nom}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2 text-sm text-slate-700">
                      <span className="font-medium">Nouvel arret</span>
                      <select
                        value={changeLineState.arret_transport_id}
                        onChange={(event) =>
                          setChangeLineState((current) => ({
                            ...current,
                            arret_transport_id: event.target.value,
                          }))
                        }
                        disabled={busyId === item.id || !changeLineState.ligne_transport_id}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                      >
                        <option value="">Sans arret</option>
                        {(stopsByLine.get(changeLineState.ligne_transport_id) ?? []).map((stop) => (
                          <option key={stop.id} value={stop.id}>
                            {stop.nom}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2 text-sm text-slate-700">
                      <span className="font-medium">Nouvelle zone</span>
                      <select
                        value={changeLineState.zone_transport}
                        onChange={(event) =>
                          setChangeLineState((current) => ({
                            ...current,
                            zone_transport: event.target.value,
                          }))
                        }
                        disabled={busyId === item.id || selectedChangeLineSettings.zones.length === 0}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                      >
                        <option value="">
                          {selectedChangeLineSettings.zones.length > 0
                            ? "Selectionner une zone"
                            : "Aucune zone parametree"}
                        </option>
                        {selectedChangeLineSettings.zones.map((zone) => (
                          <option key={zone} value={zone}>
                            {zone}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="space-y-2 text-sm text-slate-700">
                      <span className="font-medium">Date d'effet</span>
                      <input
                        type="date"
                        value={changeLineState.date_effet}
                        onChange={(event) =>
                          setChangeLineState((current) => ({
                            ...current,
                            date_effet: event.target.value,
                          }))
                        }
                        disabled={busyId === item.id}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                      />
                    </label>

                    <div className="md:col-span-2 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingSubscriptionId(null)}
                        disabled={busyId === item.id}
                        className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            if (!changeLineState.ligne_transport_id) {
                              throw new Error("La nouvelle ligne de transport est obligatoire.");
                            }
                            if (!changeLineState.date_effet) {
                              throw new Error("La date d'effet est obligatoire.");
                            }
                            if (!changeLineState.zone_transport) {
                              throw new Error("La nouvelle zone de transport est obligatoire.");
                            }
                            setBusyId(item.id);
                            await new AbonnementTransportService().changeLine(item.id, {
                              ligne_transport_id: changeLineState.ligne_transport_id,
                              arret_transport_id: changeLineState.arret_transport_id || null,
                              zone_transport: changeLineState.zone_transport,
                              date_effet: changeLineState.date_effet,
                            });
                            info("Circuit transport mis a jour et renvoye a Finance.", "success");
                            setEditingSubscriptionId(null);
                            await load();
                          } catch (error) {
                            info(getErrorMessage(error), "error");
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        disabled={busyId === item.id}
                        className="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyId === item.id ? "Mise a jour..." : "Valider le changement"}
                      </button>
                    </div>
                  </div>
                ) : null}

                {editingPeriodId === item.id ? (
                  <div className="mt-4 grid gap-4 rounded-[20px] border border-violet-200 bg-white px-4 py-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <p className="text-sm font-semibold text-slate-900">Mettre a jour la periode d&apos;usage</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Une entree ou une sortie en cours de periode sera transmise a Finance si elle modifie le prorata transport.
                      </p>
                    </div>

                    <label className="space-y-2 text-sm text-slate-700">
                      <span className="font-medium">Date de debut reelle</span>
                      <input
                        type="date"
                        value={updatePeriodState.date_debut_service}
                        onChange={(event) =>
                          setUpdatePeriodState((current) => ({
                            ...current,
                            date_debut_service: event.target.value,
                          }))
                        }
                        disabled={busyId === item.id}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                      />
                    </label>

                    <label className="space-y-2 text-sm text-slate-700">
                      <span className="font-medium">Date de fin reelle</span>
                      <input
                        type="date"
                        value={updatePeriodState.date_fin_service}
                        onChange={(event) =>
                          setUpdatePeriodState((current) => ({
                            ...current,
                            date_fin_service: event.target.value,
                          }))
                        }
                        disabled={busyId === item.id}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
                      />
                    </label>

                    <div className="md:col-span-2 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingPeriodId(null)}
                        disabled={busyId === item.id}
                        className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            if (
                              updatePeriodState.date_debut_service &&
                              updatePeriodState.date_fin_service &&
                              updatePeriodState.date_fin_service < updatePeriodState.date_debut_service
                            ) {
                              throw new Error("La date de fin doit etre posterieure a la date de debut.");
                            }
                            setBusyId(item.id);
                            await new AbonnementTransportService().updatePeriod(item.id, {
                              date_debut_service: updatePeriodState.date_debut_service || null,
                              date_fin_service: updatePeriodState.date_fin_service || null,
                            });
                            info("Periode transport mise a jour.", "success");
                            setEditingPeriodId(null);
                            await load();
                          } catch (error) {
                            info(getErrorMessage(error), "error");
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        disabled={busyId === item.id}
                        className="rounded-2xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyId === item.id ? "Mise a jour..." : "Valider la periode"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
            {filteredAbonnements.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                Aucun abonnement transport ne correspond a cette recherche.
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {mode === "eligibility" ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Controle d'acces transport</h3>
              <p className="mt-1 text-sm text-slate-500">
                Liste d'exploitation des eleves transportes, avec rapprochement Finance.
              </p>
            </div>
            <button
              type="button"
              onClick={exportEligibilityList}
              disabled={operationalRows.length === 0}
              className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Exporter la liste
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Date de reference</span>
              <input
                type="date"
                value={eligibilityDate}
                onChange={(event) => setEligibilityDate(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Periode du</span>
              <input
                type="date"
                value={eligibilityPeriodStart}
                onChange={(event) => setEligibilityPeriodStart(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Periode au</span>
              <input
                type="date"
                value={eligibilityPeriodEnd}
                onChange={(event) => setEligibilityPeriodEnd(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Circuit</span>
              <select
                value={eligibilityLineFilter}
                onChange={(event) => setEligibilityLineFilter(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              >
                <option value="ALL">Tous les circuits</option>
                {lignes.map((ligne) => (
                  <option key={ligne.id} value={ligne.id}>
                    {ligne.nom}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Statut exploitation</span>
              <select
                value={eligibilityStatusFilter}
                onChange={(event) =>
                  setEligibilityStatusFilter(
                    event.target.value as "ALL" | EligibilityOperationalStatus,
                  )
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              >
                <option value="ALL">Tous</option>
                <option value="ACTIF">Actif</option>
                <option value="SUSPENDU">Suspendu</option>
                <option value="EN_ATTENTE">En attente</option>
                <option value="RADIE">Radie</option>
              </select>
            </label>
            <label className="xl:col-span-2 space-y-2 text-sm text-slate-700">
              <span className="font-medium">Rechercher un eleve</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Nom, prenom, code eleve, ligne, zone..."
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              />
            </label>
            <div className="xl:col-span-3 rounded-[20px] border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-900">
              <p className="font-semibold">Perimetre d'exploitation</p>
              <p className="mt-1">
                La liste est calculee pour la date{" "}
                <span className="font-semibold">{formatDate(eligibilityReferenceDate)}</span>
                {eligibilityPeriodStart || eligibilityPeriodEnd
                  ? ` et restreinte a la periode ${formatDate(eligibilityPeriodStart)} - ${formatDate(
                      eligibilityPeriodEnd,
                    )}.`
                  : "."}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-5">
            <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Actifs
              </p>
              <p className="mt-3 text-3xl font-semibold text-emerald-950">
                {operationalSummary.actifs}
              </p>
            </div>
            <div className="rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">
                Suspendus
              </p>
              <p className="mt-3 text-3xl font-semibold text-rose-950">
                {operationalSummary.suspendus}
              </p>
            </div>
            <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                En attente
              </p>
              <p className="mt-3 text-3xl font-semibold text-amber-950">
                {operationalSummary.en_attente}
              </p>
            </div>
            <div className="rounded-[22px] border border-slate-300 bg-slate-100 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                Radies
              </p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">
                {operationalSummary.radies}
              </p>
            </div>
            <div className="rounded-[22px] border border-fuchsia-200 bg-fuchsia-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-700">
                Ecarts Finance
              </p>
              <p className="mt-3 text-3xl font-semibold text-fuchsia-950">
                {operationalSummary.transportes_non_finances}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[22px] border border-fuchsia-200 bg-fuchsia-50 px-4 py-4 text-sm text-fuchsia-900">
              <p className="font-semibold">Controle Transport vs Finance</p>
              <p className="mt-2">
                Eleves transportes mais sans feu vert financier :{" "}
                <span className="font-semibold">{operationalSummary.transportes_non_finances}</span>
              </p>
              <p className="mt-1">
                Eleves finances mais non exploitables :{" "}
                <span className="font-semibold">{operationalSummary.finances_non_transportables}</span>
              </p>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Liste d'exploitation</p>
              <p className="mt-2">
                La sortie ci-dessous peut etre filtree par date, periode, circuit et statut, puis exportee en CSV pour l'exploitation terrain.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {loadingOperational ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <Spin label="Chargement de la liste d'exploitation..." showLabel />
              </div>
            ) : null}
            {operationalRows.map((item) => (
              <div
                key={item.id}
                className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-slate-900">
                        {item.eleve?.utilisateur?.profil?.prenom}{" "}
                        {item.eleve?.utilisateur?.profil?.nom}
                      </p>
                      {item.eleve?.code_eleve ? (
                        <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-500">
                          {item.eleve.code_eleve}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {item.ligne?.nom ?? "Sans ligne"}
                      {item.arret?.nom ? ` - ${item.arret.nom}` : ""}
                      {item.zone_transport ? ` - Zone ${item.zone_transport}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Validite: {formatDate(item.date_debut_service)} - {formatDate(item.date_fin_service)}
                    </p>
                    {item.derniere_reactivation_financiere ? (
                      <p className="mt-1 text-sm font-medium text-sky-700">
                        Reactivation Finance: {formatDateTime(item.derniere_reactivation_financiere)}
                      </p>
                    ) : null}
                    <p className="mt-1 text-sm text-slate-500">
                      Service: {getServiceStatusLabel(item.statut)} | Finance: {getFinanceStatusLabel(item.finance_status)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Exploitation: {getOperationalStatusLabel(item.operational_status)} | Acces calcule:{" "}
                      {getAccessStatusLabel(item.access_for_date)}
                    </p>
                    {item.latest_usage_at ? (
                      <p className="mt-1 text-sm text-slate-500">
                        Dernier passage reel: {formatDateTime(item.latest_usage_at)}
                        {item.used_in_window
                          ? ` (${item.usage_count_in_window ?? 0} dans la fenetre)`
                          : ""}
                      </p>
                    ) : null}
                    {!item.finance_authorized && item.operational_status === "ACTIF" ? (
                      <p className="mt-1 text-sm font-medium text-fuchsia-700">
                        Ecart: l&apos;eleve apparait transportable mais Finance ne l&apos;autorise pas encore.
                      </p>
                    ) : null}
                  </div>
                  <div
                    className={`rounded-full border px-3 py-2 text-sm font-semibold ${getOperationalStatusTone(
                      item.operational_status,
                    )}`}
                  >
                    {getOperationalStatusLabel(item.operational_status)}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleRecordUsage(item)}
                    disabled={busyId === item.id}
                    className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyId === item.id ? "Pointage..." : "Pointer passage reel"}
                  </button>
                </div>
              </div>
            ))}

            {!loadingOperational && operationalRows.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                Aucun eleve ne correspond a cette liste d'exploitation.
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
