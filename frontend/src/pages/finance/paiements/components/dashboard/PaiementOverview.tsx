import { useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiClock, FiCreditCard, FiSettings } from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import PaiementService, {
  getPaiementDisplayLabel,
  getPaiementSecondaryLabel,
  type PaiementWithRelations,
} from "../../../../../services/paiement.service";

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
  return "Impossible de charger les paiements.";
}

export default function PaiementOverview({ mode = "overview" }: Props) {
  const { etablissement_id } = useAuth();
  const [rows, setRows] = useState<PaiementWithRelations[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!etablissement_id) return;
      try {
        const service = new PaiementService();
        const result = await service.getForEtablissement(etablissement_id, {
          page: 1,
          take: 300,
          includeSpec: JSON.stringify({
            facture: {
              include: {
                eleve: { include: { utilisateur: { include: { profil: true } } } },
                annee: true,
              },
            },
          }),
        });
        if (!active) return;
        setRows(result?.status.success ? ((result.data.data as PaiementWithRelations[]) ?? []) : []);
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

  const totalPaid = useMemo(
    () => rows.reduce((sum, item) => sum + Number(item.montant ?? 0), 0),
    [rows],
  );
  const cashCount = useMemo(
    () => rows.filter((item) => (item.methode ?? "").toLowerCase() === "cash").length,
    [rows],
  );
  const referencedCount = useMemo(
    () => rows.filter((item) => Boolean(item.reference?.trim())).length,
    [rows],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-semibold text-slate-900">Encaissements</h2>
        <p className="mt-2 text-sm text-slate-500">
          {mode === "settings"
            ? "Les paiements sont rattaches aux factures et recalculent automatiquement leur statut."
            : "Vue d'ensemble des paiements enregistres et du niveau d'encaissement recent."}
        </p>
        {errorMessage ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {errorMessage}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiCreditCard />
            <span className="text-sm font-medium">Paiements</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{rows.length}</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiCheckCircle />
            <span className="text-sm font-medium">Montant encaisse</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {totalPaid.toLocaleString("fr-FR")}
          </p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiClock />
            <span className="text-sm font-medium">Avec reference</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{referencedCount}</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiCreditCard />
            <span className="text-sm font-medium">Cash</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{cashCount}</p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr,0.9fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Paiements recents</h3>
          <div className="mt-5 space-y-3">
            {rows.slice(0, 6).map((item) => (
              <div key={item.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {getPaiementDisplayLabel(item)}
                  </p>
                  <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                    {Number(item.montant ?? 0).toLocaleString("fr-FR")} {item.facture?.devise ?? "MGA"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{getPaiementSecondaryLabel(item)}</p>
              </div>
            ))}
            {rows.length === 0 ? (
              <p className="text-sm text-slate-500">Aucun paiement enregistre.</p>
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
                  Les paiements sont limites au solde restant et mettent a jour le statut de la facture associee.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
