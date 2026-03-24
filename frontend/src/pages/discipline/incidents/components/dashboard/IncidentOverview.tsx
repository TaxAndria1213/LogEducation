import { useEffect, useMemo, useState } from "react";
import { FiAlertTriangle, FiCheckCircle, FiClock, FiSettings, FiShield } from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import IncidentDisciplinaireService, {
  getIncidentDisplayLabel,
  getIncidentSecondaryLabel,
  getIncidentStatusMeta,
  type IncidentDisciplinaireWithRelations,
} from "../../../../../services/incidentDisciplinaire.service";

type Props = { mode?: "overview" | "settings" };

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error && typeof error.response === "object" && error.response !== null && "data" in error.response && typeof error.response.data === "object" && error.response.data !== null && "message" in error.response.data && typeof error.response.data.message === "string") {
    return error.response.data.message;
  }
  return "Impossible de charger les incidents disciplinaires.";
}

export default function IncidentOverview({ mode = "overview" }: Props) {
  const { etablissement_id, user } = useAuth();
  const [rows, setRows] = useState<IncidentDisciplinaireWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!etablissement_id) return;
      setLoading(true);
      setErrorMessage("");
      try {
        const service = new IncidentDisciplinaireService();
        const result = await service.getForEtablissement(etablissement_id, {
          page: 1,
          take: 300,
          includeSpec: JSON.stringify({
            eleve: { include: { utilisateur: { include: { profil: true } } } },
            sanctions: true,
          }),
        });
        if (!active) return;
        setRows(result?.status.success ? ((result.data.data as IncidentDisciplinaireWithRelations[]) ?? []) : []);
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

  const openCount = useMemo(
    () => rows.filter((item) => !["RESOLU", "CLOS"].includes((item.statut ?? "").toUpperCase())).length,
    [rows],
  );
  const resolvedCount = useMemo(
    () => rows.filter((item) => ["RESOLU", "CLOS"].includes((item.statut ?? "").toUpperCase())).length,
    [rows],
  );
  const severeCount = useMemo(
    () => rows.filter((item) => (item.gravite ?? 0) >= 4).length,
    [rows],
  );
  const sanctionedCount = useMemo(
    () => rows.filter((item) => (item.sanctions?.length ?? 0) > 0).length,
    [rows],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-rose-700">
              <FiShield />
              Discipline
            </span>
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                {user?.etablissement?.nom ?? "Etablissement"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {mode === "settings"
                  ? "Le module Discipline centralise les incidents, les sanctions associees et les bonnes pratiques de suivi."
                  : "Vue d'ensemble des signalements en cours, des situations sensibles et des incidents deja resolus."}
              </p>
            </div>
          </div>
          {loading ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">Chargement...</span> : null}
        </div>
        {errorMessage ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{errorMessage}</div> : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiAlertTriangle /><span className="text-sm font-medium">Incidents</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{rows.length}</p></div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiClock /><span className="text-sm font-medium">En cours</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{openCount}</p></div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiCheckCircle /><span className="text-sm font-medium">Resolus / clos</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{resolvedCount}</p></div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiShield /><span className="text-sm font-medium">Gravite forte</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{severeCount}</p></div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr,0.9fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Suivi recent</h3>
              <p className="text-sm text-slate-500">Derniers incidents saisis dans l'etablissement.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{rows.length} total</span>
          </div>
          <div className="mt-5 space-y-3">
            {rows.slice(0, 6).map((item) => {
              const meta = getIncidentStatusMeta(item.statut);
              return (
                <div key={item.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{getIncidentDisplayLabel(item)}</p>
                      <p className="mt-1 text-xs text-slate-500">{getIncidentSecondaryLabel(item)}</p>
                    </div>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${meta.tone}`}>{meta.label}</span>
                  </div>
                </div>
              );
            })}
            {rows.length === 0 ? <p className="text-sm text-slate-500">Aucun incident enregistre pour le moment.</p> : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Incidents avec sanction</h3>
            <p className="mt-2 text-sm text-slate-500">Nombre de dossiers ayant deja une decision rattachee.</p>
            <p className="mt-4 text-3xl font-semibold text-slate-900">{sanctionedCount}</p>
          </div>
          {mode === "settings" ? (
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><FiSettings /></div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Parametres du module</h3>
                  <p className="text-sm text-slate-500">Utilise les referentiels d'etablissement pour harmoniser les statuts d'incident et le vocabulaire de suivi.</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
