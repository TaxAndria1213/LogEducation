import { useEffect, useMemo, useState } from "react";
import { FiPercent, FiSettings, FiTag, FiTrendingDown } from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import RemiseService, {
  getRemiseCategoryLabel,
  getRemiseDisplayLabel,
  getRemiseSecondaryLabel,
  type RemiseWithRelations,
} from "../../../../../services/remise.service";

type Props = { mode?: "overview" | "settings" };

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error && typeof error.response === "object" && error.response !== null && "data" in error.response && typeof error.response.data === "object" && error.response.data !== null && "message" in error.response.data && typeof error.response.data.message === "string") return error.response.data.message;
  return "Impossible de charger les remises.";
}

export default function RemiseOverview({ mode = "overview" }: Props) {
  const { etablissement_id } = useAuth();
  const [rows, setRows] = useState<RemiseWithRelations[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!etablissement_id) return;
      try {
        const service = new RemiseService();
        const result = await service.getForEtablissement(etablissement_id, { page: 1, take: 300 });
        if (!active) return;
        setRows(result?.status.success ? ((result.data.data as RemiseWithRelations[]) ?? []) : []);
      } catch (error) {
        if (!active) return;
        setErrorMessage(getErrorMessage(error));
      }
    };
    void load();
    return () => { active = false; };
  }, [etablissement_id]);

  const percentCount = useMemo(() => rows.filter((item) => (item.type ?? "").toUpperCase() === "PERCENT").length, [rows]);
  const fixedCount = useMemo(() => rows.filter((item) => (item.type ?? "").toUpperCase() === "FIXED").length, [rows]);
  const withRulesCount = useMemo(() => rows.filter((item) => item.regles_json != null).length, [rows]);
  const scholarshipCount = useMemo(
    () => rows.filter((item) => ["BOURSE", "PRISE_EN_CHARGE"].includes((typeof (item.regles_json as Record<string, unknown> | null)?.nature_financiere === "string" ? ((item.regles_json as Record<string, unknown>).nature_financiere as string).toUpperCase() : ""))).length,
    [rows],
  );

  return (
    <div className="space-y-6">
      {errorMessage ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{errorMessage}</div> : null}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiTag /><span className="text-sm font-medium">Remises</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{rows.length}</p></div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiPercent /><span className="text-sm font-medium">Pourcentage</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{percentCount}</p></div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiTrendingDown /><span className="text-sm font-medium">Montant fixe</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{fixedCount}</p></div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiTag /><span className="text-sm font-medium">Avec regles</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{withRulesCount}</p></div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiTag /><span className="text-sm font-medium">Bourses / prises en charge</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{scholarshipCount}</p></div>
      </section>
      <section className="grid gap-4 xl:grid-cols-[1.4fr,0.9fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Apercu des remises</h3>
          <div className="mt-5 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
            {rows.slice(0, 6).map((item) => <div key={item.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"><p className="text-sm font-semibold text-slate-900">{getRemiseDisplayLabel(item)}</p><p className="mt-1 text-xs text-slate-500">{getRemiseSecondaryLabel(item)}</p><p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{getRemiseCategoryLabel(item)}</p></div>)}
            {rows.length === 0 ? <p className="text-sm text-slate-500">Aucune remise enregistree.</p> : null}
          </div>
        </div>
        {mode === "settings" ? <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><FiSettings /></div><div><h3 className="text-lg font-semibold text-slate-900">Parametres</h3><p className="text-sm text-slate-500">Les remises supportent un JSON de regles pour preparer plus tard un moteur d'application automatique.</p></div></div></div> : null}
      </section>
    </div>
  );
}
