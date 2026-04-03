import { useEffect, useMemo, useState } from "react";
import { FiAlertCircle, FiCoffee, FiUsers } from "react-icons/fi";
import Spin from "../../../../../components/anim/Spin";
import { useAuth } from "../../../../../hooks/useAuth";
import FormuleCantineService from "../../../../../services/formuleCantine.service";
import {
  getCantineAbsenceRegularizationModeLabel,
  getCantineDailyMealLimitLabel,
  getFormuleCantineTypeLabel,
} from "../../../../../services/formuleCantine.service";
import AbonnementCantineService, {
  getAbonnementCantineFinanceStatusLabel,
  getCantineControlAnomalyLabel,
  getCantineControlTrackingLabel,
  type CantineControlAnomalyRow,
  type CantineControlAnomalySummary,
  type AbonnementCantineWithRelations,
} from "../../../../../services/abonnementCantine.service";
import {
  getCatalogueFraisSecondaryLabel,
  type CatalogueFraisWithRelations,
} from "../../../../../services/catalogueFrais.service";
import type { FormuleCantine } from "../../../../../types/models";

type Props = { mode?: "overview" | "settings" };

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
  return "Impossible de charger le module cantine.";
}

export default function CantineOverview({ mode = "overview" }: Props) {
  const { etablissement_id } = useAuth();
  const [formules, setFormules] = useState<FormuleCantine[]>([]);
  const [abonnements, setAbonnements] = useState<AbonnementCantineWithRelations[]>([]);
  const [controlAnomalies, setControlAnomalies] = useState<CantineControlAnomalyRow[]>([]);
  const [controlSummary, setControlSummary] = useState<CantineControlAnomalySummary>({
    total: 0,
    repas_sans_autorisation_active: 0,
    payes_sans_consommation: 0,
    consommations_superieures_aux_droits: 0,
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [busyAnomalyId, setBusyAnomalyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!etablissement_id) return;
      if (active) setLoading(true);
      try {
        const [formulesResult, abonnementsResult, anomaliesResult] = await Promise.all([
          new FormuleCantineService().getForEtablissement(etablissement_id, {
            take: 300,
            includeSpec: JSON.stringify({ frais: true }),
          }),
          new AbonnementCantineService().getForEtablissement(etablissement_id, {
            take: 500,
            includeSpec: JSON.stringify({
              eleve: { include: { utilisateur: { include: { profil: true } } } },
              annee: true,
              formule: true,
            }),
          }),
          new AbonnementCantineService().getControlAnomalies(etablissement_id),
        ]);
        if (!active) return;
        setFormules(formulesResult?.status.success ? formulesResult.data.data : []);
        setAbonnements(abonnementsResult?.status.success ? abonnementsResult.data.data : []);
        const anomaliesPayload =
          anomaliesResult?.status.success && anomaliesResult.data
            ? (anomaliesResult.data as {
                rows?: CantineControlAnomalyRow[];
                summary?: Partial<CantineControlAnomalySummary>;
              })
            : null;
        setControlAnomalies(Array.isArray(anomaliesPayload?.rows) ? anomaliesPayload.rows ?? [] : []);
        setControlSummary({
          total: anomaliesPayload?.summary?.total ?? 0,
          repas_sans_autorisation_active: anomaliesPayload?.summary?.repas_sans_autorisation_active ?? 0,
          payes_sans_consommation: anomaliesPayload?.summary?.payes_sans_consommation ?? 0,
          consommations_superieures_aux_droits:
            anomaliesPayload?.summary?.consommations_superieures_aux_droits ?? 0,
        });
        setErrorMessage("");
      } catch (error) {
        if (!active) return;
        setErrorMessage(getErrorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [etablissement_id]);

  const activeSubscriptions = useMemo(
    () => abonnements.filter((item) => (item.statut ?? "ACTIF").toUpperCase() === "ACTIF").length,
    [abonnements],
  );
  const pendingFinance = useMemo(
    () =>
      abonnements.filter(
        (item) =>
          ["EN_ATTENTE_VALIDATION_FINANCIERE", "EN_ATTENTE_REGLEMENT"].includes(
            (item.finance_status ?? item.statut ?? "").toUpperCase(),
          ),
      ).length,
    [abonnements],
  );
  const suspendedServices = useMemo(
    () => abonnements.filter((item) => (item.statut ?? "ACTIF").toUpperCase() === "SUSPENDU").length,
    [abonnements],
  );

  const markAnomaly = async (item: CantineControlAnomalyRow, decision: "RESOLVED" | "IGNORED") => {
    if (!etablissement_id) return;
    try {
      setBusyAnomalyId(item.anomaly_id);
      await new AbonnementCantineService().markControlAnomaly(etablissement_id, {
        anomaly_id: item.anomaly_id,
        decision,
      });
      const refreshed = await new AbonnementCantineService().getControlAnomalies(etablissement_id);
      const payload =
        refreshed?.status.success && refreshed.data
          ? (refreshed.data as {
              rows?: CantineControlAnomalyRow[];
              summary?: Partial<CantineControlAnomalySummary>;
            })
          : null;
      setControlAnomalies(Array.isArray(payload?.rows) ? payload?.rows ?? [] : []);
      setControlSummary({
        total: payload?.summary?.total ?? 0,
        repas_sans_autorisation_active: payload?.summary?.repas_sans_autorisation_active ?? 0,
        payes_sans_consommation: payload?.summary?.payes_sans_consommation ?? 0,
        consommations_superieures_aux_droits:
          payload?.summary?.consommations_superieures_aux_droits ?? 0,
      });
    } finally {
      setBusyAnomalyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMessage}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <Spin label="Chargement des donnees cantine..." showLabel />
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiCoffee />
            <span className="text-sm font-medium">Formules</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{formules.length}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiUsers />
            <span className="text-sm font-medium">Services eleves</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{abonnements.length}</p>
        </div>

        <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-center gap-3 text-amber-800">
            <FiAlertCircle />
            <span className="text-sm font-medium">A regulariser</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-amber-950">{pendingFinance}</p>
          <p className="mt-2 text-xs text-amber-800">Services actifs sans facture rattachee.</p>
        </div>

        <div className="rounded-[24px] border border-fuchsia-200 bg-fuchsia-50 p-5">
          <div className="flex items-center gap-3 text-fuchsia-800">
            <FiAlertCircle />
            <span className="text-sm font-medium">Anomalies coherence</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-fuchsia-950">{controlSummary.total}</p>
          <p className="mt-2 text-xs text-fuchsia-800">
            Ecarts detectes entre consommations, droits journaliers et situation Finance.
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiUsers />
            <span className="text-sm font-medium">Suspendus</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{suspendedServices}</p>
          <p className="mt-2 text-xs text-slate-500">{activeSubscriptions} service(s) actif(s)</p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr,1fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Formules recentes</h3>
          <div className="mt-5 space-y-3">
            {formules.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <p className="text-sm font-semibold text-slate-900">{item.nom}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-[0.08em] text-slate-600">
                  {getFormuleCantineTypeLabel(item.type_formule)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {item.transmettre_consommations_finance
                    ? "Consommations transmises a Finance"
                    : "Consommations non transmises a Finance"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Droit journalier: {getCantineDailyMealLimitLabel(item.max_repas_par_jour)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {item.regulariser_absence_annulation
                    ? `Absences regularisables via Finance (${getCantineAbsenceRegularizationModeLabel(item.mode_regularisation_absence)})`
                    : "Absences sans regularisation Finance"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {item.frais
                    ? `${item.frais.nom} - ${getCatalogueFraisSecondaryLabel(item.frais as CatalogueFraisWithRelations)}`
                    : "Aucun frais catalogue relie"}
                </p>
              </div>
            ))}
            {formules.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune formule enregistree.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          {mode === "settings" ? null : (
            <>
              <h3 className="text-lg font-semibold text-slate-900">Services cantine recents</h3>
              <div className="mt-5 space-y-3">
                {abonnements.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {item.eleve?.utilisateur?.profil?.prenom} {item.eleve?.utilisateur?.profil?.nom}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.formule?.nom}
                      {item.formule?.type_formule
                        ? ` (${getFormuleCantineTypeLabel(item.formule.type_formule)})`
                        : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.facture?.numero_facture
                        ? `Finance: ${item.facture.numero_facture} - ${getAbonnementCantineFinanceStatusLabel(item.finance_status ?? item.facture.statut ?? "EMISE")}`
                        : `Finance: ${getAbonnementCantineFinanceStatusLabel(item.finance_status ?? "EN_ATTENTE_VALIDATION_FINANCIERE")}`}
                    </p>
                    {item.derniere_reactivation_financiere ? (
                      <p className="mt-1 text-xs font-medium text-emerald-700">
                        Reactive le {new Date(item.derniere_reactivation_financiere).toLocaleString("fr-FR")}
                      </p>
                    ) : null}
                  </div>
                ))}
                {abonnements.length === 0 ? (
                  <p className="text-sm text-slate-500">Aucun service cantine enregistre.</p>
                ) : null}
              </div>
            </>
          )}
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Anomalies Cantine vs Finance</h3>
            <p className="mt-1 text-sm text-slate-500">
              Rapprochement entre repas servis, paiements ou autorisations et droits journaliers des formules.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-800">
              Sans autorisation: {controlSummary.repas_sans_autorisation_active}
            </span>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">
              Payes sans repas: {controlSummary.payes_sans_consommation}
            </span>
            <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-800">
              Surconsommation: {controlSummary.consommations_superieures_aux_droits}
            </span>
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {controlAnomalies.slice(0, 8).map((item) => (
            <div
              key={item.anomaly_id}
              className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{item.eleve_label}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">
                    {getCantineControlAnomalyLabel(item.code)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.formule_label ?? "Formule non renseignee"}
                    {item.consommation_le ? ` - ${new Date(item.consommation_le).toLocaleDateString("fr-FR")}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{item.motif}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-700">
                    {getCantineControlTrackingLabel(item.tracking_status)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void markAnomaly(item, "RESOLVED")}
                    disabled={busyAnomalyId === item.anomaly_id}
                    className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAnomalyId === item.anomaly_id ? "Traitement..." : "Marquer resolue"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void markAnomaly(item, "IGNORED")}
                    disabled={busyAnomalyId === item.anomaly_id}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAnomalyId === item.anomaly_id ? "Traitement..." : "Ignorer"}
                  </button>
                </div>
              </div>
            </div>
          ))}
          {controlAnomalies.length === 0 ? (
            <p className="text-sm text-slate-500">
              Aucune anomalie de coherence detectee entre les repas servis et la situation Finance.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
