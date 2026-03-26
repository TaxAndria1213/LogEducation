import { useEffect, useMemo, useState } from "react";
import { FiCreditCard, FiLayers, FiRefreshCw, FiSettings } from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import CatalogueFraisService, {
  getCatalogueFraisDisplayLabel,
  getCatalogueFraisSecondaryLabel,
  type CatalogueFraisWithRelations,
} from "../../../../../services/catalogueFrais.service";

type Props = { mode?: "overview" | "settings" };

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error && typeof error.response === "object" && error.response !== null && "data" in error.response && typeof error.response.data === "object" && error.response.data !== null && "message" in error.response.data && typeof error.response.data.message === "string") return error.response.data.message;
  return "Impossible de charger le catalogue de frais.";
}

export default function CatalogueFraisOverview({ mode = "overview" }: Props) {
  const { etablissement_id, user } = useAuth();
  const [rows, setRows] = useState<CatalogueFraisWithRelations[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!etablissement_id) return;
      try {
        const service = new CatalogueFraisService();
        const result = await service.getForEtablissement(etablissement_id, {
          page: 1,
          take: 300,
          includeSpec: JSON.stringify({ niveau: true, _count: { select: { lignesFacture: true } } }),
        });
        if (!active) return;
        setRows(result?.status.success ? ((result.data.data as CatalogueFraisWithRelations[]) ?? []) : []);
      } catch (error) {
        if (!active) return;
        setErrorMessage(getErrorMessage(error));
      }
    };
    void load();
    return () => { active = false; };
  }, [etablissement_id]);

  const recurringCount = useMemo(() => rows.filter((item) => item.est_recurrent).length, [rows]);
  const activeCurrencies = useMemo(() => new Set(rows.map((item) => item.devise || "MGA")).size, [rows]);
  const usedCount = useMemo(() => rows.filter((item) => (item._count?.lignesFacture ?? 0) > 0).length, [rows]);
  const globalCount = useMemo(() => rows.filter((item) => !item.niveau_scolaire_id).length, [rows]);

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">{user?.etablissement?.nom ?? "Etablissement"}</h2>
        <p className="mt-2 text-sm text-slate-500">{mode === "settings" ? "Le catalogue de frais pilote les montants reutilisables dans les inscriptions et la facturation." : "Vue d'ensemble des frais parametrables de l'etablissement."}</p>
        {errorMessage ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{errorMessage}</div> : null}
      </section>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiCreditCard /><span className="text-sm font-medium">Frais</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{rows.length}</p></div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiRefreshCw /><span className="text-sm font-medium">Recurrents</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{recurringCount}</p></div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiLayers /><span className="text-sm font-medium">Devises</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{activeCurrencies}</p></div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiCreditCard /><span className="text-sm font-medium">Deja utilises</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{usedCount}</p></div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiLayers /><span className="text-sm font-medium">Globaux</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{globalCount}</p></div>
      </section>
      <section className="grid gap-4 xl:grid-cols-[1.4fr,0.9fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Apercu du catalogue</h3>
          <div className="mt-5 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
            {rows.slice(0, 6).map((item) => <div key={item.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"><p className="text-sm font-semibold text-slate-900">{getCatalogueFraisDisplayLabel(item)}</p><p className="mt-1 text-xs text-slate-500">{getCatalogueFraisSecondaryLabel(item)}</p></div>)}
            {rows.length === 0 ? <p className="text-sm text-slate-500">Aucun frais catalogue n'a encore ete enregistre.</p> : null}
          </div>
        </div>
        {mode === "settings" ? <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><FiSettings /></div><div><h3 className="text-lg font-semibold text-slate-900">Parametres</h3><p className="text-sm text-slate-500">Le catalogue de frais pilote les montants reutilisables dans les inscriptions et la facturation.</p></div></div></div> : null}
      </section>
    </div>
  );
}
