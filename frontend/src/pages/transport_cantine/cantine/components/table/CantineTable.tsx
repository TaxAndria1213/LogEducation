import { useEffect, useMemo, useState } from "react";
import Spin from "../../../../../components/anim/Spin";
import { useAuth } from "../../../../../hooks/useAuth";
import { useInfo } from "../../../../../hooks/useInfo";
import FormuleCantineService from "../../../../../services/formuleCantine.service";
import {
  getCantineAbsenceRegularizationModeLabel,
  getCantineDailyMealLimitLabel,
  getFormuleCantineTypeLabel,
} from "../../../../../services/formuleCantine.service";
import {
  getCatalogueFraisSecondaryLabel,
  type CatalogueFraisWithRelations,
} from "../../../../../services/catalogueFrais.service";
import AbonnementCantineService, {
  type AbonnementCantineAccessCheckResponse,
  type AbonnementCantineConsumeResponse,
  type CantineOperationalRow,
  type CantineOperationalSummary,
  type AbonnementCantineWithRelations,
  getCantineAbsenceEventLabel,
  getAbonnementCantineFinanceStatusLabel,
} from "../../../../../services/abonnementCantine.service";
import type { FormuleCantine } from "../../../../../types/models";

type CantineListMode = "formules" | "abonnements" | "controle";
type CantineOperationalStatusFilter =
  | "ALL"
  | "AUTORISE"
  | "SUSPENDU"
  | "EN_ATTENTE"
  | "INSUFFISANT"
  | "EXPIRE";

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
  return "Impossible de charger les donnees cantine.";
}

function ModeSelector({
  value,
  onChange,
}: {
  value: CantineListMode;
  onChange: (value: CantineListMode) => void;
}) {
  const items: Array<{ id: CantineListMode; label: string }> = [
    { id: "formules", label: "Formules" },
    { id: "abonnements", label: "Services eleves" },
    { id: "controle", label: "Controle acces" },
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

export default function CantineTable() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const service = useMemo(() => new AbonnementCantineService(), []);
  const todayDate = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [mode, setMode] = useState<CantineListMode>("formules");
  const [formules, setFormules] = useState<FormuleCantine[]>([]);
  const [abonnements, setAbonnements] = useState<AbonnementCantineWithRelations[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingFormulaId, setEditingFormulaId] = useState<string | null>(null);
  const [reportingAbsenceId, setReportingAbsenceId] = useState<string | null>(null);
  const [formulaSelection, setFormulaSelection] = useState<Record<string, string>>({});
  const [formulaEffectDates, setFormulaEffectDates] = useState<Record<string, string>>({});
  const [absenceTypeSelection, setAbsenceTypeSelection] = useState<Record<string, string>>({});
  const [absenceDateSelection, setAbsenceDateSelection] = useState<Record<string, string>>({});
  const [absenceNoteSelection, setAbsenceNoteSelection] = useState<Record<string, string>>({});
  const [controlQuery, setControlQuery] = useState("");
  const [controlReferenceDate, setControlReferenceDate] = useState(todayDate);
  const [controlPeriodStart, setControlPeriodStart] = useState(todayDate);
  const [controlPeriodEnd, setControlPeriodEnd] = useState(todayDate);
  const [controlStatusFilter, setControlStatusFilter] =
    useState<CantineOperationalStatusFilter>("ALL");
  const [operationalRows, setOperationalRows] = useState<CantineOperationalRow[]>([]);
  const [operationalSummary, setOperationalSummary] = useState<CantineOperationalSummary>({
    autorises: 0,
    suspendus: 0,
    en_attente: 0,
    insuffisants: 0,
    expires: 0,
  });
  const [operationalLoading, setOperationalLoading] = useState(false);
  const [scanLookup, setScanLookup] = useState("");
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [accessResult, setAccessResult] = useState<AbonnementCantineAccessCheckResponse | null>(null);
  const [recordingMeal, setRecordingMeal] = useState(false);
  const [reportingAbsence, setReportingAbsence] = useState(false);
  const [mealType, setMealType] = useState("repas");
  const [mealNote, setMealNote] = useState("");

  const load = async () => {
    if (!etablissement_id) return;
    setLoading(true);
    try {
      const [formulesResult, abonnementsResult] = await Promise.all([
        new FormuleCantineService().getForEtablissement(etablissement_id, {
          take: 500,
          includeSpec: JSON.stringify({ frais: true }),
        }),
        service.getForEtablissement(etablissement_id, {
          take: 1000,
          includeSpec: JSON.stringify({
            eleve: { include: { utilisateur: { include: { profil: true } } } },
            annee: true,
            formule: true,
            absences: {
              orderBy: { date_repas: "desc" },
              take: 5,
            },
            consommations: {
              orderBy: { consommation_le: "desc" },
              take: 5,
            },
            historiquesFormule: {
              include: {
                ancienneFormule: true,
                nouvelleFormule: true,
              },
              orderBy: { created_at: "desc" },
              take: 5,
            },
          }),
        }),
      ]);
      setFormules(formulesResult?.status.success ? formulesResult.data.data : []);
      setAbonnements(abonnementsResult?.status.success ? abonnementsResult.data.data : []);
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

  const loadOperationalList = async () => {
    if (!etablissement_id) return;
    setOperationalLoading(true);
    try {
      const response = await service.getOperationalList(etablissement_id, {
        reference_date: controlReferenceDate || undefined,
        period_start: controlPeriodStart || undefined,
        period_end: controlPeriodEnd || undefined,
        access_status: controlStatusFilter !== "ALL" ? controlStatusFilter : undefined,
        search: controlQuery.trim() || undefined,
      });
      if (response?.status?.success) {
        setOperationalRows((response.data?.rows ?? []) as CantineOperationalRow[]);
        setOperationalSummary(
          (response.data?.summary ?? {
            autorises: 0,
            suspendus: 0,
            en_attente: 0,
            insuffisants: 0,
            expires: 0,
          }) as CantineOperationalSummary,
        );
        setErrorMessage("");
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setOperationalLoading(false);
    }
  };

  useEffect(() => {
    if (mode !== "controle") return;
    void loadOperationalList();
  }, [
    mode,
    etablissement_id,
    controlReferenceDate,
    controlPeriodStart,
    controlPeriodEnd,
    controlStatusFilter,
    controlQuery,
  ]);

  const financePendingCount = useMemo(
    () =>
      abonnements.filter(
        (item) =>
          ["EN_ATTENTE_VALIDATION_FINANCIERE", "EN_ATTENTE_REGLEMENT", "PARTIELLEMENT_REGLE", "IMPAYE"].includes(
            (item.finance_status ?? item.statut ?? "").toUpperCase(),
          ),
      ).length,
    [abonnements],
  );

  const getLatestFormulaHistory = (item: AbonnementCantineWithRelations) =>
    item.historiquesFormule?.[0] ?? null;

  const getAccessStatusLabel = (status?: string | null) => {
    switch ((status ?? "").toUpperCase()) {
      case "AUTORISE":
        return "Acces autorise";
      case "SUSPENDU":
        return "Acces suspendu";
      case "EN_ATTENTE":
        return "Acces en attente";
      case "EXPIRE":
        return "Acces expire";
      case "INSUFFISANT":
        return "Solde insuffisant";
      default:
        return "Decision indisponible";
    }
  };

  const getAccessReasonLabel = (reason?: string | null) => {
    switch ((reason ?? "").toUpperCase()) {
      case "SOLDE_INSUFFISANT":
        return "Solde ou autorisation insuffisante";
      case "VALIDATION_FINANCIERE_EN_ATTENTE":
        return "Validation Finance en attente";
      case "SERVICE_SUSPENDU":
        return "Service cantine suspendu";
      case "SERVICE_NON_EFFECTIF":
        return "Service non encore effectif";
      case "PERIODE_TERMINEE":
        return "Periode de validite terminee";
      case "AUTORISATION_VALIDE":
        return "Autorisation valide";
      default:
        return "Aucune precision complementaire";
    }
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
            <h3 className="text-lg font-semibold text-slate-900">Liste cantine</h3>
            <p className="mt-1 text-sm text-slate-500">
              Le module cantine gere les formules et le droit d'acces au service. La facturation et les paiements restent dans Finance.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              A regulariser dans Finance
            </p>
            <p className="mt-2 text-lg font-semibold text-slate-900">{financePendingCount}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <ModeSelector value={mode} onChange={setMode} />
          <button
            type="button"
            onClick={() => {
              void load();
              if (mode === "controle") {
                void loadOperationalList();
              }
            }}
            disabled={loading}
            className="rounded-2xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Actualisation..." : "Actualiser"}
          </button>
        </div>

        {loading ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <Spin label="Chargement de la liste cantine..." showLabel />
          </div>
        ) : null}
      </section>

      {mode === "formules" ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Formules de cantine</h3>
          <div className="mt-4 space-y-3">
            {formules.map((item) => (
              <div
                key={item.id}
                className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.nom}</p>
                    <p className="mt-1 text-xs font-medium uppercase tracking-[0.08em] text-slate-600">
                      {getFormuleCantineTypeLabel(item.type_formule)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.transmettre_consommations_finance
                        ? "Consommations transmises a Finance"
                        : "Consommations gerees sans transmission Finance"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Droit journalier: {getCantineDailyMealLimitLabel(item.max_repas_par_jour)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.regulariser_absence_annulation
                        ? `Absences et annulations regulables via Finance (${getCantineAbsenceRegularizationModeLabel(item.mode_regularisation_absence)})`
                        : "Absences et annulations tracees sans regularisation Finance"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.frais
                        ? `${item.frais.nom} - ${getCatalogueFraisSecondaryLabel(item.frais as CatalogueFraisWithRelations)}`
                        : "Aucun frais catalogue relie"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setBusyId(item.id);
                        await new FormuleCantineService().delete(item.id);
                        info("Formule supprimee.", "success");
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
            ))}
          </div>
        </section>
      ) : null}

      {mode === "abonnements" ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Services cantine eleves</h3>
          <div className="mt-4 space-y-3">
            {abonnements.map((item) => {
              const financeLinked = Boolean(item.facture_id);
              const financeStatus = (item.finance_status ?? item.facture?.statut ?? "N/A").toUpperCase();
              const serviceStatus = (item.statut ?? "EN_ATTENTE_VALIDATION_FINANCIERE").toUpperCase();
              const latestFormulaHistory = getLatestFormulaHistory(item);
              const selectedFormulaId = formulaSelection[item.id] ?? "";
              const selectedFormula =
                formules.find((formule) => formule.id === selectedFormulaId) ?? null;
              const effectDateValue =
                formulaEffectDates[item.id] ?? new Date().toISOString().slice(0, 10);

              return (
                <div
                  key={item.id}
                  className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {item.eleve?.utilisateur?.profil?.prenom} {item.eleve?.utilisateur?.profil?.nom}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.formule?.nom} ({getFormuleCantineTypeLabel(item.formule?.type_formule)}) - {item.annee?.nom ?? "Annee"}
                      </p>
                      {latestFormulaHistory ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Dernier changement: {latestFormulaHistory.ancienneFormule?.nom ?? "Ancienne formule"} {" -> "} {latestFormulaHistory.nouvelleFormule?.nom ?? "Nouvelle formule"}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-slate-500">
                        Date d'effet: {item.date_effet ? new Date(item.date_effet).toLocaleDateString("fr-FR") : "Non renseignee"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Statut service: {item.statut ?? "EN_ATTENTE_VALIDATION_FINANCIERE"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {financeLinked
                          ? `Finance: ${item.facture?.numero_facture ?? "Facture"} - ${getAbonnementCantineFinanceStatusLabel(financeStatus)}`
                          : `Finance: ${getAbonnementCantineFinanceStatusLabel(financeStatus)}`}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Reglement absence: {item.formule?.regulariser_absence_annulation
                          ? getCantineAbsenceRegularizationModeLabel(item.formule?.mode_regularisation_absence)
                          : "Aucune regularisation automatique"}
                      </p>
                      {item.derniere_reactivation_financiere ? (
                        <p className="mt-1 text-xs font-medium text-emerald-700">
                          Reactivation financiere le{" "}
                          {new Date(item.derniere_reactivation_financiere).toLocaleString("fr-FR")}
                        </p>
                      ) : null}
                      {(item.absences?.length ?? 0) > 0 ? (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                            Dernieres absences
                          </p>
                          {item.absences?.slice(0, 2).map((absence) => (
                            <p key={absence.id} className="text-xs text-slate-500">
                              {new Date(absence.date_repas).toLocaleDateString("fr-FR")} - {getCantineAbsenceEventLabel(absence.type_evenement)}
                              {absence.transmission_finance
                                ? absence.finance_processed_at
                                  ? ` - Reglee par Finance (${getCantineAbsenceRegularizationModeLabel(absence.decision_finance)})`
                                  : ` - A regulariser (${getCantineAbsenceRegularizationModeLabel(absence.mode_regularisation_suggere)})`
                                : " - Sans impact Finance"}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      {!financeLinked &&
                      ["EN_ATTENTE_VALIDATION_FINANCIERE", "EN_ATTENTE_REGLEMENT"].includes(serviceStatus) ? (
                        <p className="mt-1 text-xs font-medium text-amber-700">
                          Ce service est en attente de prise en charge ou de validation Finance.
                        </p>
                      ) : null}
                      {latestFormulaHistory?.impact_tarifaire &&
                      latestFormulaHistory.details_json &&
                      typeof latestFormulaHistory.details_json === "object" &&
                      !Array.isArray(latestFormulaHistory.details_json) &&
                      (latestFormulaHistory.details_json as Record<string, unknown>).notification_finance === true &&
                      !(latestFormulaHistory.details_json as Record<string, unknown>).finance_processed_at ? (
                        <p className="mt-1 text-xs font-medium text-amber-700">
                          Changement de formule avec impact tarifaire en attente de regularisation Finance.
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingFormulaId((current) => (current === item.id ? null : item.id));
                          setFormulaSelection((current) => ({
                            ...current,
                            [item.id]: current[item.id] ?? "",
                          }));
                          setFormulaEffectDates((current) => ({
                            ...current,
                            [item.id]: current[item.id] ?? new Date().toISOString().slice(0, 10),
                          }));
                        }}
                        disabled={busyId === item.id || serviceStatus === "RESILIE"}
                        className="rounded-2xl border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {editingFormulaId === item.id ? "Annuler formule" : "Changer formule"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setReportingAbsenceId((current) => (current === item.id ? null : item.id));
                          setAbsenceTypeSelection((current) => ({
                            ...current,
                            [item.id]: current[item.id] ?? "ABSENCE",
                          }));
                          setAbsenceDateSelection((current) => ({
                            ...current,
                            [item.id]: current[item.id] ?? new Date().toISOString().slice(0, 10),
                          }));
                          setAbsenceNoteSelection((current) => ({
                            ...current,
                            [item.id]: current[item.id] ?? "",
                          }));
                        }}
                        disabled={busyId === item.id || serviceStatus === "RESILIE"}
                        className="rounded-2xl border border-violet-200 bg-white px-3 py-2 text-xs font-semibold text-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {reportingAbsenceId === item.id ? "Annuler absence" : "Signaler absence"}
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            setBusyId(item.id);
                            const nextStatus = serviceStatus === "SUSPENDU" ? "ACTIF" : "SUSPENDU";
                            await service.update(item.id, { statut: nextStatus });
                            info(
                              nextStatus === "SUSPENDU"
                                ? "Service cantine suspendu."
                                : "Service cantine reactive.",
                              "success",
                            );
                            await load();
                          } catch (error) {
                            info(getErrorMessage(error), "error");
                          } finally {
                            setBusyId(null);
                          }
                        }}
                        disabled={busyId === item.id || serviceStatus === "RESILIE"}
                        className="rounded-2xl border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyId === item.id
                          ? "Traitement..."
                          : serviceStatus === "SUSPENDU"
                            ? "Reactiver"
                            : "Suspendre"}
                      </button>

                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            setBusyId(item.id);
                            await service.delete(item.id);
                            info(
                              item.facture_id
                                ? "Abonnement cantine resilie. La regularisation suit le flux Finance."
                                : "Abonnement cantine supprime.",
                              "success",
                            );
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

                  {editingFormulaId === item.id ? (
                    <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr,180px,auto]">
                      <label className="text-xs font-medium text-slate-600">
                        Nouvelle formule
                        <select
                          value={selectedFormulaId}
                          onChange={(event) =>
                            setFormulaSelection((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                        >
                          <option value="">Selectionner une formule</option>
                          {formules
                            .filter((formule) => formule.id !== item.formule_cantine_id)
                            .map((formule) => (
                              <option key={formule.id} value={formule.id}>
                                {formule.nom} - {getFormuleCantineTypeLabel(formule.type_formule)}
                              </option>
                            ))}
                        </select>
                      </label>

                      <label className="text-xs font-medium text-slate-600">
                        Date d'effet
                        <input
                          type="date"
                          value={effectDateValue}
                          onChange={(event) =>
                            setFormulaEffectDates((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                        />
                      </label>

                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!selectedFormulaId) {
                              info("Selectionne d'abord une nouvelle formule.", "error");
                              return;
                            }
                            try {
                              setBusyId(item.id);
                              await service.changeFormula(item.id, {
                                formule_cantine_id: selectedFormulaId,
                                date_effet: effectDateValue,
                              });
                              info(
                                selectedFormula?.catalogue_frais_id !== item.formule?.catalogue_frais_id
                                  ? "Formule modifiee et regularisation transmise a Finance."
                                  : "Formule cantine modifiee.",
                                "success",
                              );
                              setEditingFormulaId(null);
                              await load();
                            } catch (error) {
                              info(getErrorMessage(error), "error");
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          disabled={busyId === item.id}
                          className="rounded-2xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {busyId === item.id ? "Enregistrement..." : "Valider le changement"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {reportingAbsenceId === item.id ? (
                    <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[180px,180px,1fr,auto]">
                      <label className="text-xs font-medium text-slate-600">
                        Type
                        <select
                          value={absenceTypeSelection[item.id] ?? "ABSENCE"}
                          onChange={(event) =>
                            setAbsenceTypeSelection((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                        >
                          <option value="ABSENCE">Absence</option>
                          <option value="ANNULATION">Annulation</option>
                        </select>
                      </label>

                      <label className="text-xs font-medium text-slate-600">
                        Date du repas
                        <input
                          type="date"
                          value={absenceDateSelection[item.id] ?? new Date().toISOString().slice(0, 10)}
                          onChange={(event) =>
                            setAbsenceDateSelection((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                          }
                          className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                        />
                      </label>

                      <label className="text-xs font-medium text-slate-600">
                        Note
                        <input
                          value={absenceNoteSelection[item.id] ?? ""}
                          onChange={(event) =>
                            setAbsenceNoteSelection((current) => ({
                              ...current,
                              [item.id]: event.target.value,
                            }))
                          }
                          placeholder="Motif ou precision"
                          className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                        />
                      </label>

                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              setReportingAbsence(true);
                              const response = await service.reportAbsence(item.id, {
                                type_evenement: (absenceTypeSelection[item.id] ?? "ABSENCE") as "ABSENCE" | "ANNULATION",
                                date_repas: absenceDateSelection[item.id] ?? new Date().toISOString().slice(0, 10),
                                note: absenceNoteSelection[item.id]?.trim() || null,
                              });
                              if (response?.status?.success) {
                                info(
                                  item.formule?.regulariser_absence_annulation
                                    ? "Absence/annulation enregistree et transmise a Finance."
                                    : "Absence/annulation enregistree.",
                                  "success",
                                );
                                setReportingAbsenceId(null);
                                await load();
                              }
                            } catch (error) {
                              info(getErrorMessage(error), "error");
                            } finally {
                              setReportingAbsence(false);
                            }
                          }}
                          disabled={reportingAbsence}
                          className="rounded-2xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {reportingAbsence ? "Signalement..." : "Valider l'absence"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {mode === "controle" ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Controle d'acces cantine</h3>
              <p className="mt-1 text-sm text-slate-500">
                Liste operationnelle quotidienne des eleves autorises a consommer, avec verification individuelle.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Date de reference</span>
              <input
                type="date"
                value={controlReferenceDate}
                onChange={(event) => setControlReferenceDate(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Periode du</span>
              <input
                type="date"
                value={controlPeriodStart}
                onChange={(event) => setControlPeriodStart(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Periode au</span>
              <input
                type="date"
                value={controlPeriodEnd}
                onChange={(event) => setControlPeriodEnd(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Statut d'acces</span>
              <select
                value={controlStatusFilter}
                onChange={(event) =>
                  setControlStatusFilter(event.target.value as CantineOperationalStatusFilter)
                }
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              >
                <option value="ALL">Tous</option>
                <option value="AUTORISE">Autorise</option>
                <option value="SUSPENDU">Suspendu</option>
                <option value="EN_ATTENTE">En attente</option>
                <option value="INSUFFISANT">Insuffisant</option>
                <option value="EXPIRE">Expire</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Rechercher un eleve</span>
              <input
                value={controlQuery}
                onChange={(event) => setControlQuery(event.target.value)}
                placeholder="Nom, prenom, code eleve, formule..."
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              />
            </label>
            <div className="xl:col-span-3 rounded-[20px] border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-900">
              <p className="font-semibold">Perimetre d'exploitation</p>
              <p className="mt-1">
                Liste calculee pour le{" "}
                <span className="font-semibold">
                  {controlReferenceDate
                    ? new Date(controlReferenceDate).toLocaleDateString("fr-FR")
                    : "jour courant"}
                </span>{" "}
                et restreinte a la periode{" "}
                <span className="font-semibold">
                  {controlPeriodStart
                    ? new Date(controlPeriodStart).toLocaleDateString("fr-FR")
                    : "N/A"}
                </span>{" "}
                {" -> "}
                <span className="font-semibold">
                  {controlPeriodEnd
                    ? new Date(controlPeriodEnd).toLocaleDateString("fr-FR")
                    : "N/A"}
                </span>
                .
              </p>
            </div>
            <label className="xl:col-span-2 text-xs font-medium text-slate-600">
              Scanner un identifiant
              <div className="mt-1 grid gap-3 md:grid-cols-[1fr,auto]">
                <input
                  value={scanLookup}
                  onChange={(event) => setScanLookup(event.target.value)}
                  placeholder="Code ou identifiant eleve"
                  className="w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!scanLookup.trim()) {
                      info("Saisis d'abord un identifiant a scanner.", "error");
                      return;
                    }
                    try {
                      setCheckingAccess(true);
                      const response = await service.checkAccess({
                        lookup: scanLookup.trim(),
                        reference_date: controlReferenceDate || undefined,
                      });
                      if (response?.status?.success) {
                        setAccessResult(response.data as AbonnementCantineAccessCheckResponse);
                        info("Controle d'acces cantine trace.", "success");
                      }
                    } catch (error) {
                      info(getErrorMessage(error), "error");
                    } finally {
                      setCheckingAccess(false);
                    }
                  }}
                  disabled={checkingAccess}
                  className="rounded-2xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {checkingAccess ? "Controle..." : "Scanner"}
                </button>
              </div>
            </label>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-5">
            <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Autorises
              </p>
              <p className="mt-3 text-3xl font-semibold text-emerald-950">
                {operationalSummary.autorises}
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
            <div className="rounded-[22px] border border-fuchsia-200 bg-fuchsia-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-700">
                Insuffisants
              </p>
              <p className="mt-3 text-3xl font-semibold text-fuchsia-950">
                {operationalSummary.insuffisants}
              </p>
            </div>
            <div className="rounded-[22px] border border-slate-300 bg-slate-100 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                Expires
              </p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">
                {operationalSummary.expires}
              </p>
            </div>
          </div>

          {operationalLoading ? (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <Spin label="Chargement de la liste operationnelle cantine..." showLabel />
            </div>
          ) : null}

          <div className="mt-5 grid gap-3">
            {operationalRows.map((item) => (
              <div
                key={item.id}
                className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {item.eleve?.utilisateur?.profil?.prenom} {item.eleve?.utilisateur?.profil?.nom}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.eleve?.code_eleve ?? "Code eleve non renseigne"} - {item.formule?.nom ?? "Formule non renseignee"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Exploitation: {getAccessStatusLabel(item.operational_status)} - Service: {item.statut ?? "N/A"} - Finance:{" "}
                      {getAbonnementCantineFinanceStatusLabel(item.finance_status ?? "N/A")}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Periode de validite: {item.validity_start ? new Date(item.validity_start).toLocaleDateString("fr-FR") : "N/A"} {" -> "} {item.validity_end ? new Date(item.validity_end).toLocaleDateString("fr-FR") : "N/A"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        setCheckingAccess(true);
                        const response = await service.checkAccess({
                          abonnement_cantine_id: item.id,
                          reference_date: controlReferenceDate || undefined,
                        });
                        if (response?.status?.success) {
                          setAccessResult(response.data as AbonnementCantineAccessCheckResponse);
                          info("Decision d'acces cantine tracee.", "success");
                        }
                      } catch (error) {
                        info(getErrorMessage(error), "error");
                      } finally {
                        setCheckingAccess(false);
                      }
                    }}
                    disabled={checkingAccess}
                    className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Verifier l'acces
                  </button>
                </div>
              </div>
            ))}
            {!operationalLoading && operationalRows.length === 0 ? (
              <p className="text-sm text-slate-500">
                Aucun eleve cantine ne correspond a cette liste operationnelle.
              </p>
            ) : null}
          </div>

          {accessResult ? (
            <div className="mt-6 rounded-[22px] border border-sky-200 bg-sky-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">
                Decision d'acces
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {getAccessStatusLabel(accessResult.abonnement.access_status)}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {getAccessReasonLabel(accessResult.abonnement.access_reason)}
              </p>
              <p className="mt-3 text-xs text-slate-500">
                Formule: {accessResult.abonnement.formule?.nom ?? "Non renseignee"} ({getFormuleCantineTypeLabel(accessResult.abonnement.formule?.type_formule)})
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Transmission Finance: {accessResult.abonnement.formule?.transmettre_consommations_finance ? "Active" : "Inactive"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Periode de validite: {accessResult.abonnement.validity_start ? new Date(accessResult.abonnement.validity_start).toLocaleDateString("fr-FR") : "N/A"} {" -> "} {accessResult.abonnement.validity_end ? new Date(accessResult.abonnement.validity_end).toLocaleDateString("fr-FR") : "N/A"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Finance: {getAbonnementCantineFinanceStatusLabel(accessResult.abonnement.finance_status ?? "N/A")} - Solde: {Number(accessResult.abonnement.solde_prepaye ?? 0).toLocaleString("fr-FR")}
              </p>
              {accessResult.abonnement.derniere_reactivation_financiere ? (
                <p className="mt-1 text-xs font-medium text-emerald-700">
                  Service reactive apres regularisation le{" "}
                  {new Date(accessResult.abonnement.derniere_reactivation_financiere).toLocaleString("fr-FR")}
                </p>
              ) : null}
              <p className="mt-2 text-xs text-slate-500">
                Trace: {accessResult.trace_id} - {new Date(accessResult.checked_at).toLocaleString("fr-FR")}
              </p>
              {accessResult.abonnement.access_status === "AUTORISE" ? (
                <div className="mt-4 rounded-2xl border border-sky-200 bg-white/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">
                    Enregistrer le repas servi
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-[1fr,1fr,auto]">
                    <label className="text-xs font-medium text-slate-600">
                      Type de repas
                      <select
                        value={mealType}
                        onChange={(event) => setMealType(event.target.value)}
                        className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                      >
                        <option value="repas">Repas</option>
                        <option value="petit_dejeuner">Petit-dejeuner</option>
                        <option value="dejeuner">Dejeuner</option>
                        <option value="gouter">Gouter</option>
                        <option value="diner">Diner</option>
                      </select>
                    </label>
                    <label className="text-xs font-medium text-slate-600">
                      Note
                      <input
                        value={mealNote}
                        onChange={(event) => setMealNote(event.target.value)}
                        placeholder="Observation optionnelle"
                        className="mt-1 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                      />
                    </label>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={async () => {
                          if (!accessResult.abonnement.id) return;
                          try {
                            setRecordingMeal(true);
                            const response = await service.consume(accessResult.abonnement.id, {
                              type_repas: mealType,
                              note: mealNote.trim() || null,
                              consommation_le: new Date(),
                            });
                            if (response?.status?.success) {
                              const data = response.data as AbonnementCantineConsumeResponse;
                              setAccessResult((current) =>
                                current
                                  ? {
                                      ...current,
                                      abonnement: data.abonnement ?? current.abonnement,
                                      trace_id: data.trace_id,
                                      checked_at: new Date(),
                                    }
                                  : current,
                              );
                              setMealNote("");
                              info("Repas servi enregistre et trace.", "success");
                              await load();
                              if (mode === "controle") {
                                await loadOperationalList();
                              }
                            }
                          } catch (error) {
                            info(getErrorMessage(error), "error");
                          } finally {
                            setRecordingMeal(false);
                          }
                        }}
                        disabled={recordingMeal}
                        className="rounded-2xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {recordingMeal ? "Enregistrement..." : "Enregistrer le repas"}
                      </button>
                    </div>
                  </div>
                  {(accessResult.abonnement.consommations?.length ?? 0) > 0 ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Dernieres consommations
                      </p>
                      {accessResult.abonnement.consommations?.slice(0, 3).map((consommation) => (
                        <p key={consommation.id} className="text-xs text-slate-600">
                          {new Date(consommation.consommation_le).toLocaleString("fr-FR")} - {consommation.type_repas}
                          {consommation.transmission_finance
                            ? consommation.finance_processed_at
                              ? " - Controlee par Finance"
                              : " - A controler par Finance"
                            : " - Hors circuit Finance"}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
