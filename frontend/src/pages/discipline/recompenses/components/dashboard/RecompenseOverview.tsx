import { useEffect, useMemo, useState } from "react";
import { FiAward, FiSettings, FiStar, FiTrendingUp } from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import RecompenseService, { getRecompenseDisplayLabel, getRecompenseSecondaryLabel, type RecompenseWithRelations } from "../../../../../services/recompense.service";

type Props = { mode?: "overview" | "settings" };

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error && typeof error.response === "object" && error.response !== null && "data" in error.response && typeof error.response.data === "object" && error.response.data !== null && "message" in error.response.data && typeof error.response.data.message === "string") return error.response.data.message;
  return "Impossible de charger les recompenses.";
}

export default function RecompenseOverview({ mode = "overview" }: Props) {
  const { etablissement_id } = useAuth();
  const [rows, setRows] = useState<RecompenseWithRelations[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!etablissement_id) return;
      try {
        const service = new RecompenseService();
        const result = await service.getForEtablissement(etablissement_id, {
          page: 1,
          take: 300,
          includeSpec: JSON.stringify({ eleve: { include: { utilisateur: { include: { profil: true } } } } }),
        });
        if (!active) return;
        setRows(result?.status.success ? ((result.data.data as RecompenseWithRelations[]) ?? []) : []);
      } catch (error) {
        if (!active) return;
        setErrorMessage(getErrorMessage(error));
      }
    };
    void load();
    return () => { active = false; };
  }, [etablissement_id]);

  const totalPoints = useMemo(() => rows.reduce((sum, item) => sum + (item.points ?? 0), 0), [rows]);
  const rewardedStudents = useMemo(() => new Set(rows.map((item) => item.eleve_id)).size, [rows]);
  const strongRewards = useMemo(() => rows.filter((item) => (item.points ?? 0) >= 5).length, [rows]);

  return (
    <div className="space-y-6">
      {errorMessage ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{errorMessage}</div> : null}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiAward /><span className="text-sm font-medium">Recompenses</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{rows.length}</p></div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiStar /><span className="text-sm font-medium">Points attribues</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{totalPoints}</p></div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiTrendingUp /><span className="text-sm font-medium">Eleves valorises</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{rewardedStudents}</p></div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiAward /><span className="text-sm font-medium">Forts bonus</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{strongRewards}</p></div>
      </section>
      <section className="grid gap-4 xl:grid-cols-[1.4fr,0.9fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Dernieres recompenses</h3>
          <div className="mt-5 space-y-3">
            {rows.slice(0, 6).map((item) => <div key={item.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"><p className="text-sm font-semibold text-slate-900">{getRecompenseDisplayLabel(item)}</p><p className="mt-1 text-xs text-slate-500">{getRecompenseSecondaryLabel(item) || "Aucun motif complementaire"}</p></div>)}
            {rows.length === 0 ? <p className="text-sm text-slate-500">Aucune recompense enregistree.</p> : null}
          </div>
        </div>
        {mode === "settings" ? <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><FiSettings /></div><div><h3 className="text-lg font-semibold text-slate-900">Parametres</h3><p className="text-sm text-slate-500">Les motifs de recompense peuvent etre proposes via les referentiels de l'etablissement.</p></div></div></div> : null}
      </section>
    </div>
  );
}
