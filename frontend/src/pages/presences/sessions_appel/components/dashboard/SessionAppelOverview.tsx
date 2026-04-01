import { useEffect, useMemo, useState } from "react";
import { FiBookOpen, FiCalendar, FiCheckCircle, FiSettings } from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import SessionAppelService, {
  getSessionAppelDisplayLabel,
  getSessionAppelSecondaryLabel,
  type SessionAppelWithRelations,
} from "../../../../../services/sessionAppel.service";

type Props = { mode?: "overview" | "settings" };

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" && error !== null &&
    "response" in error && typeof error.response === "object" && error.response !== null &&
    "data" in error.response && typeof error.response.data === "object" && error.response.data !== null &&
    "message" in error.response.data && typeof error.response.data.message === "string"
  ) {
    return error.response.data.message;
  }
  return "Impossible de charger les sessions d'appel.";
}

export default function SessionAppelOverview({ mode = "overview" }: Props) {
  const { etablissement_id } = useAuth();
  const [rows, setRows] = useState<SessionAppelWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!etablissement_id) return;
      setLoading(true);
      setErrorMessage("");
      try {
        const service = new SessionAppelService();
        const result = await service.getForEtablissement(etablissement_id, {
          page: 1,
          take: 300,
          includeSpec: JSON.stringify({
            classe: { include: { niveau: true, site: true, annee: true } },
            creneau: true,
            prisPar: { include: { personnel: { include: { utilisateur: { include: { profil: true } } } } } },
            presences: { include: { eleve: { include: { utilisateur: { include: { profil: true } } } } } },
          }),
        });
        if (!active) return;
        setRows(result?.status.success ? (result.data.data as SessionAppelWithRelations[]) ?? [] : []);
      } catch (error) {
        if (!active) return;
        setErrorMessage(getErrorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [etablissement_id]);

  const totalPresences = useMemo(() => rows.reduce((sum, row) => sum + (row.presences?.length ?? 0), 0), [rows]);
  const totalAbsents = useMemo(
    () => rows.reduce((sum, row) => sum + (row.presences?.filter((item) => item.statut === "ABSENT").length ?? 0), 0),
    [rows],
  );

  return (
    <div className="space-y-6">      {loading ? <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Chargement...</div> : null}      {errorMessage ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{errorMessage}</div> : null}      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Sessions</p><p className="mt-2 text-3xl font-semibold text-slate-900">{rows.length}</p></div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Classes couvrees</p><p className="mt-2 text-3xl font-semibold text-slate-900">{new Set(rows.map((row) => row.classe_id)).size}</p></div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Presences generees</p><p className="mt-2 text-3xl font-semibold text-slate-900">{totalPresences}</p></div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Absents detectes</p><p className="mt-2 text-3xl font-semibold text-slate-900">{totalAbsents}</p></div>
      </section>

      {mode === "settings" ? null : (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div><h3 className="text-lg font-semibold text-slate-900">Sessions recentes</h3><p className="text-sm text-slate-500">Les derniers appels enregistres.</p></div>
          <div className="mt-5 space-y-3">
            {rows.slice(0, 6).map((row) => (
              <div key={row.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm font-semibold text-slate-900">{getSessionAppelDisplayLabel(row)}</p>
                <p className="mt-1 text-xs text-slate-500">{getSessionAppelSecondaryLabel(row)}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}


