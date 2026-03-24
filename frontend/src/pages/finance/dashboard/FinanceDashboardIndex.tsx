import { useEffect, useMemo, useState } from "react";
import {
  FiAlertCircle,
  FiCalendar,
  FiCreditCard,
  FiDollarSign,
  FiFileText,
  FiLayers,
  FiPercent,
  FiRepeat,
} from "react-icons/fi";
import ERPPage from "../../../components/page/ERPPage";
import { hasAccess } from "../../../components/components.build";
import { useAuth } from "../../../hooks/useAuth";
import CatalogueFraisService, {
  getCatalogueFraisDisplayLabel,
  type CatalogueFraisWithRelations,
} from "../../../services/catalogueFrais.service";
import FactureService, {
  getFactureDisplayLabel,
  getFactureSecondaryLabel,
  type FactureWithRelations,
} from "../../../services/facture.service";
import PlanPaiementEleveService, {
  getPlanPaiementDisplayLabel,
  getPlanPaiementEcheances,
  getPlanPaiementSecondaryLabel,
  type PlanEcheance,
  type PlanPaiementEleveWithRelations,
} from "../../../services/planPaiementEleve.service";
import PaiementService, {
  getPaiementDisplayLabel,
  getPaiementSecondaryLabel,
  type PaiementWithRelations,
} from "../../../services/paiement.service";
import RemiseService, {
  getRemiseDisplayLabel,
  getRemiseTypeLabel,
  type RemiseWithRelations,
} from "../../../services/remise.service";
import NotFound from "../../NotFound";

type DashboardEcheance = {
  id: string;
  eleveLabel: string;
  secondaryLabel: string;
  date: string;
  montant: number;
  devise: string;
  mode: string;
};

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
  return "Impossible de charger le tableau de bord finance.";
}

function toNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatMoney(value: number, devise = "MGA") {
  return `${value.toLocaleString("fr-FR")} ${devise}`;
}

function formatDate(value?: string | Date | null) {
  if (!value) return "Date non renseignee";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Date non renseignee";
  return parsed.toLocaleDateString("fr-FR");
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export default function FinanceDashboardIndex() {
  const { user, roles, etablissement_id } = useAuth();
  const [factures, setFactures] = useState<FactureWithRelations[]>([]);
  const [paiements, setPaiements] = useState<PaiementWithRelations[]>([]);
  const [plans, setPlans] = useState<PlanPaiementEleveWithRelations[]>([]);
  const [catalogueFrais, setCatalogueFrais] = useState<CatalogueFraisWithRelations[]>([]);
  const [remises, setRemises] = useState<RemiseWithRelations[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const canAccess = useMemo(() => {
    if (!user || !roles) return false;
    return [
      "FIN.CATALOGUEFRAIS.MENUACTION.DASHBOARD",
      "FIN.REMISES.MENUACTION.DASHBOARD",
      "FIN.FACTURES.MENUACTION.DASHBOARD",
      "FIN.PAIEMENTS.MENUACTION.DASHBOARD",
      "FIN.PLANSPAIEMENT.MENUACTION.DASHBOARD",
    ].some((code) => hasAccess(user, roles, code));
  }, [roles, user]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!etablissement_id || !canAccess) {
        if (active) setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      try {
        const factureService = new FactureService();
        const paiementService = new PaiementService();
        const planService = new PlanPaiementEleveService();
        const catalogueService = new CatalogueFraisService();
        const remiseService = new RemiseService();

        const [facturesResult, paiementsResult, plansResult, catalogueResult, remisesResult] =
          await Promise.all([
            factureService.getForEtablissement(etablissement_id, {
              page: 1,
              take: 500,
              includeSpec: JSON.stringify({
                eleve: { include: { utilisateur: { include: { profil: true } } } },
                annee: true,
                lignes: { include: { frais: true } },
                paiements: true,
              }),
            }),
            paiementService.getForEtablissement(etablissement_id, {
              page: 1,
              take: 500,
              includeSpec: JSON.stringify({
                facture: {
                  include: {
                    eleve: { include: { utilisateur: { include: { profil: true } } } },
                    annee: true,
                  },
                },
              }),
            }),
            planService.getForEtablissement(etablissement_id, {
              page: 1,
              take: 400,
              includeSpec: JSON.stringify({
                eleve: { include: { utilisateur: { include: { profil: true } } } },
                annee: true,
              }),
            }),
            catalogueService.getForEtablissement(etablissement_id, {
              page: 1,
              take: 200,
            }),
            remiseService.getForEtablissement(etablissement_id, {
              page: 1,
              take: 200,
            }),
          ]);

        if (!active) return;

        setFactures(
          facturesResult?.status.success ? ((facturesResult.data.data as FactureWithRelations[]) ?? []) : [],
        );
        setPaiements(
          paiementsResult?.status.success ? ((paiementsResult.data.data as PaiementWithRelations[]) ?? []) : [],
        );
        setPlans(
          plansResult?.status.success ? ((plansResult.data.data as PlanPaiementEleveWithRelations[]) ?? []) : [],
        );
        setCatalogueFrais(
          catalogueResult?.status.success
            ? ((catalogueResult.data.data as CatalogueFraisWithRelations[]) ?? [])
            : [],
        );
        setRemises(
          remisesResult?.status.success ? ((remisesResult.data.data as RemiseWithRelations[]) ?? []) : [],
        );
      } catch (error) {
        if (!active) return;
        setErrorMessage(getErrorMessage(error));
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [canAccess, etablissement_id]);

  const totalFacture = useMemo(
    () =>
      factures
        .filter((item) => (item.statut ?? "").toUpperCase() !== "ANNULEE")
        .reduce((sum, item) => sum + toNumber(item.total_montant), 0),
    [factures],
  );

  const totalEncaisse = useMemo(
    () => paiements.reduce((sum, item) => sum + toNumber(item.montant), 0),
    [paiements],
  );

  const resteARecouvrer = useMemo(
    () =>
      factures.reduce((sum, item) => {
        if ((item.statut ?? "").toUpperCase() === "ANNULEE") return sum;
        const total = toNumber(item.total_montant);
        const paid = (item.paiements ?? []).reduce((subtotal, row) => subtotal + toNumber(row.montant), 0);
        return sum + Math.max(0, total - paid);
      }, 0),
    [factures],
  );

  const overdueInvoices = useMemo(
    () => factures.filter((item) => (item.statut ?? "").toUpperCase() === "EN_RETARD"),
    [factures],
  );

  const partiallyPaidInvoices = useMemo(
    () => factures.filter((item) => (item.statut ?? "").toUpperCase() === "PARTIELLE").length,
    [factures],
  );

  const paidInvoices = useMemo(
    () => factures.filter((item) => (item.statut ?? "").toUpperCase() === "PAYEE").length,
    [factures],
  );

  const collectionRate = totalFacture > 0 ? Math.min(100, (totalEncaisse / totalFacture) * 100) : 0;

  const echeances = useMemo<DashboardEcheance[]>(() => {
    return plans.flatMap((plan) => {
      const devise = plan.plan_json?.devise ?? "MGA";
      const mode = (plan.plan_json?.mode_paiement ?? "NON_RENSEIGNE").toString();
      const eleveLabel = getPlanPaiementDisplayLabel(plan);
      const secondaryLabel = getPlanPaiementSecondaryLabel(plan);
      return getPlanPaiementEcheances(plan).map((echeance: PlanEcheance, index) => ({
        id: `${plan.id}-${index}`,
        eleveLabel,
        secondaryLabel,
        date: echeance.date,
        montant: toNumber(echeance.montant),
        devise,
        mode,
      }));
    });
  }, [plans]);

  const today = useMemo(() => startOfDay(new Date()), []);
  const nextThirtyDays = useMemo(() => addDays(today, 30), [today]);

  const upcomingEcheances = useMemo(
    () =>
      echeances
        .filter((item) => {
          const date = startOfDay(new Date(item.date));
          return !Number.isNaN(date.getTime()) && date >= today && date <= nextThirtyDays;
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [echeances, nextThirtyDays, today],
  );

  const recentFactures = useMemo(
    () =>
      [...factures]
        .sort(
          (a, b) =>
            new Date(b.date_emission ?? b.created_at ?? 0).getTime() -
            new Date(a.date_emission ?? a.created_at ?? 0).getTime(),
        )
        .slice(0, 6),
    [factures],
  );

  const recentPaiements = useMemo(
    () =>
      [...paiements]
        .sort(
          (a, b) =>
            new Date(b.paye_le ?? b.created_at ?? 0).getTime() - new Date(a.paye_le ?? a.created_at ?? 0).getTime(),
        )
        .slice(0, 6),
    [paiements],
  );

  const topFrais = useMemo(() => {
    const usage = new Map<string, { label: string; count: number; montant: number }>();
    factures.forEach((facture) => {
      facture.lignes?.forEach((ligne) => {
        const label = ligne.frais?.nom?.trim() || ligne.libelle?.trim() || "Ligne sans libelle";
        const current = usage.get(label) ?? { label, count: 0, montant: 0 };
        current.count += 1;
        current.montant += toNumber(ligne.montant);
        usage.set(label, current);
      });
    });
    return [...usage.values()].sort((a, b) => b.count - a.count || b.montant - a.montant).slice(0, 5);
  }, [factures]);

  const recurrentFraisCount = useMemo(
    () => catalogueFrais.filter((item) => Boolean(item.est_recurrent)).length,
    [catalogueFrais],
  );

  const remiseStats = useMemo(
    () => ({
      percent: remises.filter((item) => (item.type ?? "").toUpperCase() === "PERCENT").length,
      fixed: remises.filter((item) => (item.type ?? "").toUpperCase() === "FIXED").length,
    }),
    [remises],
  );

  if (!canAccess) return <NotFound />;

  return (
    <ERPPage
      title="Finance"
      description="Tableau de bord global de la facturation, des encaissements et des echeanciers de l'etablissement."
    >
      <div className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <h2 className="text-2xl font-semibold text-slate-900">Vue d'ensemble financiere</h2>
              <p className="mt-2 text-sm text-slate-500">
                Suivi centralise des factures, paiements, plans de paiement, remises et frais reutilisables.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Taux de recouvrement
              </p>
              <p className="mt-1 text-2xl font-semibold text-emerald-900">
                {collectionRate.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}%
              </p>
            </div>
          </div>
          {errorMessage ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {errorMessage}
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500">
              <FiFileText />
              <span className="text-sm font-medium">Montant facture</span>
            </div>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{formatMoney(totalFacture)}</p>
            <p className="mt-2 text-xs text-slate-500">{factures.length} facture(s) suivie(s)</p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500">
              <FiCreditCard />
              <span className="text-sm font-medium">Montant encaisse</span>
            </div>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{formatMoney(totalEncaisse)}</p>
            <p className="mt-2 text-xs text-slate-500">{paiements.length} paiement(s) enregistre(s)</p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500">
              <FiDollarSign />
              <span className="text-sm font-medium">Reste a recouvrer</span>
            </div>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{formatMoney(resteARecouvrer)}</p>
            <p className="mt-2 text-xs text-slate-500">{partiallyPaidInvoices} facture(s) partielle(s)</p>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500">
              <FiAlertCircle />
              <span className="text-sm font-medium">Factures en retard</span>
            </div>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{overdueInvoices.length}</p>
            <p className="mt-2 text-xs text-slate-500">{paidInvoices} facture(s) deja soldee(s)</p>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.35fr,0.95fr]">
          <div className="space-y-4">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Factures recentes</h3>
                  <p className="text-sm text-slate-500">
                    Dernieres emissions et statut de recouvrement.
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {recentFactures.map((item) => (
                  <div key={item.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{getFactureDisplayLabel(item)}</p>
                        <p className="mt-1 text-xs text-slate-500">{getFactureSecondaryLabel(item)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">
                          {formatMoney(toNumber(item.total_montant), item.devise ?? "MGA")}
                        </p>
                        <p className="text-xs text-slate-500">{formatDate(item.date_emission)}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {!isLoading && recentFactures.length === 0 ? (
                  <p className="text-sm text-slate-500">Aucune facture disponible pour le moment.</p>
                ) : null}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Paiements recents</h3>
                  <p className="text-sm text-slate-500">
                    Encaissements saisis les plus recents.
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {recentPaiements.map((item) => (
                  <div key={item.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{getPaiementDisplayLabel(item)}</p>
                        <p className="mt-1 text-xs text-slate-500">{getPaiementSecondaryLabel(item)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">
                          {formatMoney(toNumber(item.montant), item.facture?.devise ?? "MGA")}
                        </p>
                        <p className="text-xs text-slate-500">{formatDate(item.paye_le)}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {!isLoading && recentPaiements.length === 0 ? (
                  <p className="text-sm text-slate-500">Aucun paiement enregistre pour le moment.</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Pilotage rapide</h3>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-center gap-3 text-slate-500">
                    <FiCalendar />
                    <span className="text-sm font-medium">Echeances a 30 jours</span>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-slate-900">{upcomingEcheances.length}</p>
                </div>
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-center gap-3 text-slate-500">
                    <FiLayers />
                    <span className="text-sm font-medium">Plans echelonnés</span>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-slate-900">
                    {plans.filter((item) => (item.plan_json?.mode_paiement ?? "").toUpperCase() !== "COMPTANT").length}
                  </p>
                </div>
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-center gap-3 text-slate-500">
                    <FiRepeat />
                    <span className="text-sm font-medium">Frais recurrents</span>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-slate-900">{recurrentFraisCount}</p>
                </div>
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex items-center gap-3 text-slate-500">
                    <FiPercent />
                    <span className="text-sm font-medium">Remises configurees</span>
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-slate-900">{remises.length}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {remiseStats.percent} en pourcentage, {remiseStats.fixed} fixes
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Prochaines echeances</h3>
              <div className="mt-5 space-y-3">
                {upcomingEcheances.slice(0, 5).map((item) => (
                  <div key={item.id} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.eleveLabel}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.secondaryLabel}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">{formatMoney(item.montant, item.devise)}</p>
                        <p className="text-xs text-slate-500">
                          {formatDate(item.date)} - {item.mode}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {!isLoading && upcomingEcheances.length === 0 ? (
                  <p className="text-sm text-slate-500">Aucune echeance planifiee sur les 30 prochains jours.</p>
                ) : null}
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Frais et remises</h3>
              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                    Frais les plus utilises
                  </p>
                  <div className="mt-3 space-y-2">
                    {topFrais.slice(0, 4).map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-slate-700">{item.label}</span>
                        <span className="font-semibold text-slate-900">{item.count}</span>
                      </div>
                    ))}
                    {!isLoading && topFrais.length === 0 ? (
                      <p className="text-sm text-slate-500">Aucune ligne de facture exploitable pour le moment.</p>
                    ) : null}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                    Catalogue recent
                  </p>
                  <div className="mt-3 space-y-2">
                    {catalogueFrais.slice(0, 3).map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-slate-700">{getCatalogueFraisDisplayLabel(item)}</span>
                        <span className="font-semibold text-slate-900">
                          {formatMoney(toNumber(item.montant), item.devise ?? "MGA")}
                        </span>
                      </div>
                    ))}
                    {!isLoading && catalogueFrais.length === 0 ? (
                      <p className="text-sm text-slate-500">Aucun frais catalogue.</p>
                    ) : null}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                    Remises recentes
                  </p>
                  <div className="mt-3 space-y-2">
                    {remises.slice(0, 3).map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-slate-700">{getRemiseDisplayLabel(item)}</span>
                        <span className="font-semibold text-slate-900">{getRemiseTypeLabel(item.type)}</span>
                      </div>
                    ))}
                    {!isLoading && remises.length === 0 ? (
                      <p className="text-sm text-slate-500">Aucune remise configuree.</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {isLoading ? (
          <section className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500 shadow-sm">
            Chargement des indicateurs financiers...
          </section>
        ) : null}
      </div>
    </ERPPage>
  );
}
