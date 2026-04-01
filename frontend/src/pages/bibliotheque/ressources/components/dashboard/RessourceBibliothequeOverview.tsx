import { useEffect, useMemo, useState } from "react";
import { FiArchive, FiBookOpen, FiLayers, FiSettings } from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import RessourceBibliothequeService, {
  getActiveLoansCount,
  getAvailableStock,
  getRessourceBibliothequeDisplayLabel,
  getRessourceBibliothequeSecondaryLabel,
  type RessourceBibliothequeWithRelations,
} from "../../../../../services/ressourceBibliotheque.service";

type Props = { mode?: "overview" | "settings" };

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "response" in error && typeof error.response === "object" && error.response !== null && "data" in error.response && typeof error.response.data === "object" && error.response.data !== null && "message" in error.response.data && typeof error.response.data.message === "string") return error.response.data.message;
  return "Impossible de charger les ressources de bibliotheque.";
}

export default function RessourceBibliothequeOverview({ mode = "overview" }: Props) {
  const { etablissement_id } = useAuth();
  const [rows, setRows] = useState<RessourceBibliothequeWithRelations[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!etablissement_id) return;
      try {
        const service = new RessourceBibliothequeService();
        const result = await service.getForEtablissement(etablissement_id, {
          page: 1,
          take: 300,
          includeSpec: JSON.stringify({ emprunts: { where: { retourne_le: null } } }),
        });
        if (!active) return;
        setRows(result?.status.success ? ((result.data.data as RessourceBibliothequeWithRelations[]) ?? []) : []);
      } catch (error) {
        if (!active) return;
        setErrorMessage(getErrorMessage(error));
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [etablissement_id]);

  const totalStock = useMemo(() => rows.reduce((sum, row) => sum + Number(row.stock ?? 0), 0), [rows]);
  const activeLoans = useMemo(() => rows.reduce((sum, row) => sum + getActiveLoansCount(row), 0), [rows]);
  const lowStockResources = useMemo(
    () => rows.filter((row) => Number(row.stock ?? 0) > 0 && getAvailableStock(row) <= 1).length,
    [rows],
  );

  return (
    <div className="space-y-6">
      {errorMessage ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{errorMessage}</div> : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiBookOpen /><span className="text-sm font-medium">Ressources</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{rows.length}</p></div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiArchive /><span className="text-sm font-medium">Stock total</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{totalStock}</p></div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiLayers /><span className="text-sm font-medium">Emprunts actifs</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{activeLoans}</p></div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3 text-slate-500"><FiArchive /><span className="text-sm font-medium">Stock limite</span></div><p className="mt-3 text-3xl font-semibold text-slate-900">{lowStockResources}</p></div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr,0.95fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Ressources recentes</h3>
          <div className="mt-5 space-y-3">
            {rows.slice(0, 6).map((item) => (
              <div key={item.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{getRessourceBibliothequeDisplayLabel(item)}</p>
                    <p className="mt-1 text-xs text-slate-500">{getRessourceBibliothequeSecondaryLabel(item)}</p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    Disponible {getAvailableStock(item)}
                  </span>
                </div>
              </div>
            ))}
            {rows.length === 0 ? <p className="text-sm text-slate-500">Aucune ressource enregistree.</p> : null}
          </div>
        </div>

        {mode === "settings" ? null : (
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Ressources sous pression</h3>
            <div className="mt-5 space-y-3">
              {rows
                .filter((row) => Number(row.stock ?? 0) > 0)
                .sort((a, b) => getAvailableStock(a) - getAvailableStock(b))
                .slice(0, 6)
                .map((item) => (
                  <div key={item.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-sm font-semibold text-slate-900">{getRessourceBibliothequeDisplayLabel(item)}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {getActiveLoansCount(item)} emprunt(s) actif(s) - {getAvailableStock(item)} restant(s)
                    </p>
                  </div>
                ))}
              {rows.length === 0 ? <p className="text-sm text-slate-500">Le stock sera visible ici des qu'une ressource sera enregistree.</p> : null}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

