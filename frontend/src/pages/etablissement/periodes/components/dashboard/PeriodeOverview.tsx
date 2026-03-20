import { useEffect, useMemo, useState } from "react";
import { FiCalendar, FiClock, FiLayers, FiSettings } from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import AnneeScolaireService from "../../../../../services/anneeScolaire.service";
import PeriodeService from "../../../../../services/periode.service";
import type { AnneeScolaire, Periode } from "../../../../../types/models";

type Props = {
  mode?: "overview" | "settings";
};

function formatDate(value?: Date | string | null) {
  if (!value) return "Non renseignee";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Non renseignee";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function PeriodeOverview({ mode = "overview" }: Props) {
  const { etablissement_id, user } = useAuth();
  const [periodes, setPeriodes] = useState<Periode[]>([]);
  const [annees, setAnnees] = useState<AnneeScolaire[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      if (!etablissement_id) {
        setPeriodes([]);
        setAnnees([]);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      try {
        const [periodesResult, anneesResult] = await Promise.all([
          PeriodeService.getAll({
            page: 1,
            take: 200,
            includes: ["annee"],
            where: { annee: { etablissement_id } },
            orderBy: [{ ordre: "asc" }, { date_debut: "asc" }],
          }),
          AnneeScolaireService.getAll({
            page: 1,
            take: 100,
            where: { etablissement_id },
            orderBy: [{ date_debut: "desc" }],
          }),
        ]);

        if (!active) return;

        setPeriodes(
          periodesResult?.status.success ? ((periodesResult.data.data as Periode[]) ?? []) : [],
        );
        setAnnees(
          anneesResult?.status.success ? ((anneesResult.data.data as AnneeScolaire[]) ?? []) : [],
        );
      } catch {
        if (!active) return;
        setErrorMessage("Impossible de charger les periodes de l'etablissement.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      active = false;
    };
  }, [etablissement_id]);

  const activeYear = useMemo(
    () => annees.find((annee) => annee.est_active) ?? null,
    [annees],
  );
  const activeYearPeriodes = useMemo(
    () => periodes.filter((periode) => periode.annee_scolaire_id === activeYear?.id),
    [periodes, activeYear],
  );
  const orderedPeriodes = useMemo(() => {
    return [...periodes].sort((left, right) => {
      const leftOrder = left.ordre ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.ordre ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return new Date(left.date_debut).getTime() - new Date(right.date_debut).getTime();
    });
  }, [periodes]);
  const previewPeriodes = useMemo(() => orderedPeriodes.slice(0, 6), [orderedPeriodes]);

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
              <FiCalendar />
              Periodes scolaires
            </span>
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                {user?.etablissement?.nom ?? "Etablissement"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {mode === "settings"
                  ? "Retrouve ici les regles de parametrage des periodes pour les annees scolaires de l'etablissement."
                  : "Vue d'ensemble des periodes rattachees aux annees scolaires de l'etablissement connecte."}
              </p>
            </div>
          </div>
          {loading ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              Chargement...
            </span>
          ) : null}
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
            <FiLayers />
            <span className="text-sm font-medium">Nombre de periodes</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{periodes.length}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiCalendar />
            <span className="text-sm font-medium">Annee active</span>
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-900">
            {activeYear?.nom ?? "Aucune annee active"}
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiClock />
            <span className="text-sm font-medium">Periodes de l'annee active</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {activeYearPeriodes.length}
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiSettings />
            <span className="text-sm font-medium">Prochain ordre</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {activeYearPeriodes.length
              ? Math.max(...activeYearPeriodes.map((periode) => periode.ordre ?? 0)) + 1
              : 1}
          </p>
        </div>
      </section>

      {mode === "settings" ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <FiSettings />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Parametres du module Periodes
              </h3>
              <p className="text-sm text-slate-500">
                Chaque periode doit rester incluse dans son annee scolaire et ne pas chevaucher une autre periode.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Bornes de dates
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Les periodes doivent toujours rester comprises dans les dates de l'annee scolaire choisie.
              </p>
            </div>

            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Organisation
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                L'ordre des periodes facilite ensuite la lecture des evaluations, bulletins et statistiques.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Apercu des periodes</h3>
            <p className="text-sm text-slate-500">
              Les premieres periodes configurees pour l'etablissement actif.
            </p>
          </div>

          {previewPeriodes.length > 0 ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {previewPeriodes.map((periode) => (
                <article
                  key={periode.id}
                  className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-base font-semibold text-slate-900">{periode.nom}</h4>
                    <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      Ordre {periode.ordre ?? "-"}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <p>Annee: {periode.annee?.nom ?? "Non renseignee"}</p>
                    <p>Debut: {formatDate(periode.date_debut)}</p>
                    <p>Fin: {formatDate(periode.date_fin)}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              Aucune periode n'est encore enregistree pour cet etablissement.
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default PeriodeOverview;
