import { useEffect, useMemo, useState } from "react";
import { FiCalendar, FiCheckCircle, FiSettings, FiShield } from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import SanctionDisciplinaireService, {
  getSanctionDisplayLabel,
  getSanctionSecondaryLabel,
  type SanctionDisciplinaireWithRelations,
} from "../../../../../services/sanctionDisciplinaire.service";

type Props = { mode?: "overview" | "settings" };

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error && typeof error.response === "object" && error.response !== null && "data" in error.response && typeof error.response.data === "object" && error.response.data !== null && "message" in error.response.data && typeof error.response.data.message === "string") return error.response.data.message;
  return "Impossible de charger les sanctions disciplinaires.";
}

export default function SanctionOverview({ mode = "overview" }: Props) {
  const { etablissement_id } = useAuth();
  const [rows, setRows] = useState<SanctionDisciplinaireWithRelations[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!etablissement_id) return;
      try {
        const service = new SanctionDisciplinaireService();
        const result = await service.getForEtablissement(etablissement_id, {
          page: 1,
          take: 300,
          includeSpec: JSON.stringify({
            incident: { include: { eleve: { include: { utilisateur: { include: { profil: true } } } } } },
          }),
        });
        if (!active) return;
        setRows(result?.status.success ? ((result.data.data as SanctionDisciplinaireWithRelations[]) ?? []) : []);
      } catch (error) {
        if (!active) return;
        setErrorMessage(getErrorMessage(error));
      }
    };
    void load();
    return () => { active = false; };
  }, [etablissement_id]);

  const activeCount = useMemo(() => rows.filter((item) => {
    const now = new Date();
    const debut = item.debut ? new Date(item.debut) : null;
    const fin = item.fin ? new Date(item.fin) : null;
    return (!debut || debut <= now) && (!fin || fin >= now);
  }).length, [rows]);
  const datedCount = useMemo(() => rows.filter((item) => item.debut || item.fin).length, [rows]);
  const uniqueIncidents = useMemo(() => new Set(rows.map((item) => item.incident_id)).size, [rows]);

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Sanctions disciplinaires</h2>
        <p className="mt-2 text-sm text-slate-500">{mode === "settings" ? "Les types de sanctions sont pilotables via les referentiels d'etablissement." : "Vue d'ensemble des decisions prises apres signalement d'un incident."}</p>
        {errorMessage ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{errorMessage}</div> : null}
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiShield /><span className="text-sm font-medium">Sanctions</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{rows.length}</p></div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiCheckCircle /><span className="text-sm font-medium">Actives</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{activeCount}</p></div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiCalendar /><span className="text-sm font-medium">Avec periode</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{datedCount}</p></div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiShield /><span className="text-sm font-medium">Incidents couverts</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{uniqueIncidents}</p></div>
      </section>
      <section className="grid gap-4 xl:grid-cols-[1.4fr,0.9fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Dernieres sanctions</h3>
          <div className="mt-5 space-y-3">
            {rows.slice(0, 6).map((item) => <div key={item.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"><p className="text-sm font-semibold text-slate-900">{getSanctionDisplayLabel(item)}</p><p className="mt-1 text-xs text-slate-500">{getSanctionSecondaryLabel(item) || "Aucune note complementaire"}</p></div>)}
            {rows.length === 0 ? <p className="text-sm text-slate-500">Aucune sanction enregistree.</p> : null}
          </div>
        </div>
        {mode === "settings" ? <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><FiSettings /></div><div><h3 className="text-lg font-semibold text-slate-900">Parametres</h3><p className="text-sm text-slate-500">Les libelles de sanctions peuvent etre ajustes dans `Etablissement / Referentiels`.</p></div></div></div> : null}
      </section>
    </div>
  );
}
