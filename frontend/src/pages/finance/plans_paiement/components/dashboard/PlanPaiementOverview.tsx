import { useEffect, useMemo, useState } from "react";
import { FiCalendar, FiClock, FiSettings, FiUsers } from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import PlanPaiementEleveService, {
  getPlanPaiementEcheances,
  getPlanPaiementDisplayLabel,
  getPlanPaiementPaidAmount,
  getPlanPaiementRemainingAmount,
  getPlanPaiementSecondaryLabel,
  type PlanPaiementEleveWithRelations,
} from "../../../../../services/planPaiementEleve.service";

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
  return "Impossible de charger les plans de paiement.";
}

function formatMoney(value: number, devise = "MGA") {
  return `${value.toLocaleString("fr-FR")} ${devise}`;
}

export default function PlanPaiementOverview({ mode = "overview" }: Props) {
  const { etablissement_id } = useAuth();
  const [rows, setRows] = useState<PlanPaiementEleveWithRelations[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!etablissement_id) return;
      try {
        const service = new PlanPaiementEleveService();
        const result = await service.getForEtablissement(etablissement_id, {
          page: 1,
          take: 300,
          includeSpec: JSON.stringify({
            eleve: { include: { utilisateur: { include: { profil: true } } } },
            annee: true,
          }),
        });
        if (!active) return;
        setRows(result?.status.success ? ((result.data.data as PlanPaiementEleveWithRelations[]) ?? []) : []);
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

  const totalEcheances = useMemo(
    () =>
      rows.reduce(
        (sum, item) => sum + getPlanPaiementEcheances(item).length,
        0,
      ),
    [rows],
  );
  const echelonnes = useMemo(
    () => rows.filter((item) => (item.plan_json?.mode_paiement ?? "").toUpperCase() !== "COMPTANT").length,
    [rows],
  );
  const comptant = Math.max(0, rows.length - echelonnes);
  const montantRegle = useMemo(
    () => rows.reduce((sum, item) => sum + getPlanPaiementPaidAmount(item), 0),
    [rows],
  );
  const montantRestant = useMemo(
    () => rows.reduce((sum, item) => sum + getPlanPaiementRemainingAmount(item), 0),
    [rows],
  );
  const openEcheances = useMemo(
    () =>
      rows.reduce((sum, item) => {
        const count = getPlanPaiementEcheances(item).filter((echeance) => {
          const remaining = Number(echeance.remaining_amount ?? echeance.montant ?? 0);
          const statut = (echeance.statut ?? "").toUpperCase();
          return remaining > 0 && statut !== "PAYEE" && statut !== "ANNULEE";
        }).length;
        return sum + count;
      }, 0),
    [rows],
  );
  const overdueEcheances = useMemo(
    () =>
      rows.reduce((sum, item) => {
        const count = getPlanPaiementEcheances(item).filter(
          (echeance) => (echeance.statut ?? "").toUpperCase() === "EN_RETARD",
        ).length;
        return sum + count;
      }, 0),
    [rows],
  );
  const recentRows = useMemo(
    () =>
      [...rows]
        .sort(
          (a, b) =>
            new Date(b.updated_at ?? b.created_at ?? 0).getTime() -
            new Date(a.updated_at ?? a.created_at ?? 0).getTime(),
        )
        .slice(0, 8),
    [rows],
  );

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500"><FiUsers /><span className="text-sm font-medium">Plans</span></div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{rows.length}</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500"><FiCalendar /><span className="text-sm font-medium">Echeances ouvertes</span></div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{openEcheances}</p>
          <p className="mt-2 text-xs text-slate-500">{totalEcheances} tranche(s) au total</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500"><FiClock /><span className="text-sm font-medium">Echelonnes</span></div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{echelonnes}</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500"><FiClock /><span className="text-sm font-medium">Comptant</span></div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{comptant}</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500"><FiCalendar /><span className="text-sm font-medium">Montant regle</span></div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{montantRegle.toLocaleString("fr-FR")}</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500"><FiClock /><span className="text-sm font-medium">En retard</span></div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{overdueEcheances}</p>
          <p className="mt-2 text-xs text-slate-500">{formatMoney(montantRestant)}</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500"><FiClock /><span className="text-sm font-medium">Montant restant</span></div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{montantRestant.toLocaleString("fr-FR")}</p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr,0.9fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Plans recents</h3>
          <div className="mt-5 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
            {recentRows.map((item) => (
              <div key={item.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-sm font-semibold text-slate-900">{getPlanPaiementDisplayLabel(item)}</p>
                <p className="mt-1 text-xs text-slate-500">{getPlanPaiementSecondaryLabel(item)}</p>
                <p className="mt-2 text-xs font-medium text-slate-700">
                  Regle {formatMoney(getPlanPaiementPaidAmount(item), item.plan_json?.devise ?? "MGA")} - Reste {formatMoney(getPlanPaiementRemainingAmount(item), item.plan_json?.devise ?? "MGA")}
                </p>
              </div>
            ))}
            {rows.length === 0 ? <p className="text-sm text-slate-500">Aucun plan de paiement enregistre.</p> : null}
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
                  Le reechelonnement modifie uniquement les tranches encore ouvertes. Les echeances reglees restent verrouillees pour proteger l'historique comptable.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
