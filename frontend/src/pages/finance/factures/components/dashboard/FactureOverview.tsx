import { useEffect, useMemo, useState } from "react";
import { FiAlertCircle, FiCheckCircle, FiClock, FiFileText, FiSettings } from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import FactureService, {
  getFactureDisplayLabel,
  getFactureSecondaryLabel,
  getFactureStatusLabel,
  type FactureWithRelations,
} from "../../../../../services/facture.service";

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
  return "Impossible de charger les factures.";
}

export default function FactureOverview({ mode = "overview" }: Props) {
  const { etablissement_id } = useAuth();
  const [rows, setRows] = useState<FactureWithRelations[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!etablissement_id) return;
      try {
        const service = new FactureService();
        const result = await service.getForEtablissement(etablissement_id, {
          page: 1,
          take: 300,
          includeSpec: JSON.stringify({
            eleve: { include: { utilisateur: { include: { profil: true } } } },
            annee: true,
            lignes: true,
            paiements: true,
          }),
        });
        if (!active) return;
        setRows(result?.status.success ? ((result.data.data as FactureWithRelations[]) ?? []) : []);
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

  const standardRows = useMemo(
    () =>
      rows.filter(
        (item) =>
          (item.nature ?? "FACTURE").toUpperCase() !== "AVOIR" &&
          (item.statut ?? "").toUpperCase() !== "ANNULEE",
      ),
    [rows],
  );
  const creditNotesCount = useMemo(
    () => rows.filter((item) => (item.nature ?? "FACTURE").toUpperCase() === "AVOIR").length,
    [rows],
  );
  const totalAmount = useMemo(
    () => standardRows.reduce((sum, item) => sum + Number(item.total_montant ?? 0), 0),
    [standardRows],
  );
  const overdueCount = useMemo(
    () => standardRows.filter((item) => (item.statut ?? "").toUpperCase() === "EN_RETARD").length,
    [standardRows],
  );
  const paidCount = useMemo(
    () => standardRows.filter((item) => (item.statut ?? "").toUpperCase() === "PAYEE").length,
    [standardRows],
  );
  const partialCount = useMemo(
    () => standardRows.filter((item) => (item.statut ?? "").toUpperCase() === "PARTIELLE").length,
    [standardRows],
  );
  const recentRows = useMemo(
    () =>
      [...rows]
        .sort(
          (a, b) =>
            new Date(b.date_emission ?? b.created_at ?? 0).getTime() -
            new Date(a.date_emission ?? a.created_at ?? 0).getTime(),
        )
        .slice(0, 8),
    [rows],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Facturation eleves</h2>
        <p className="mt-2 text-sm text-slate-500">
          {mode === "settings"
            ? "Le module facture centralise les montants emis, les lignes detaillees et le suivi des paiements."
            : "Vue d'ensemble des factures emises pour les eleves et de leur niveau de recouvrement."}
        </p>
        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {errorMessage}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiFileText />
            <span className="text-sm font-medium">Factures actives</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{standardRows.length}</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiCheckCircle />
            <span className="text-sm font-medium">Payees</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{paidCount}</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiClock />
            <span className="text-sm font-medium">Partielles</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{partialCount}</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiAlertCircle />
            <span className="text-sm font-medium">En retard</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{overdueCount}</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiFileText />
            <span className="text-sm font-medium">Avoirs</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{creditNotesCount}</p>
          <p className="mt-2 text-xs text-slate-500">
            Total facture net: {totalAmount.toLocaleString("fr-FR")} MGA
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr,0.9fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Factures recentes</h3>
              <p className="text-sm text-slate-500">
                Montant emis total: {totalAmount.toLocaleString("fr-FR")} MGA
              </p>
            </div>
          </div>
          <div className="mt-5 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
            {recentRows.map((item) => (
              <div key={item.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {getFactureDisplayLabel(item)}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                      {getFactureStatusLabel(item.statut)}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                        (item.nature ?? "FACTURE").toUpperCase() === "AVOIR"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {(item.nature ?? "FACTURE").toUpperCase() === "AVOIR" ? "Avoir" : "Facture"}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-500">{getFactureSecondaryLabel(item)}</p>
              </div>
            ))}
            {rows.length === 0 ? (
              <p className="text-sm text-slate-500">Aucune facture enregistree.</p>
            ) : null}
          </div>
        </div>

        {mode === "settings" ? (
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <FiSettings />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Parametres</h3>
                <p className="text-sm text-slate-500">
                  Les statuts sont derives des paiements et des echeances. Les avoirs restent visibles a part pour ne pas brouiller la lecture des vraies factures.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
