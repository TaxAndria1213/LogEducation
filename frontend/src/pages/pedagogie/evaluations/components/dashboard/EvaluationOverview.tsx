import { useEffect, useMemo, useState } from "react";
import {
  FiBookOpen,
  FiCalendar,
  FiCheckCircle,
  FiLayers,
  FiSettings,
} from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import anneeScolaireService from "../../../../../services/anneeScolaire.service";
import EvaluationService, {
  getEvaluationDisplayLabel,
  getEvaluationSecondaryLabel,
  type EvaluationWithRelations,
} from "../../../../../services/evaluation.service";
import type { AnneeScolaire } from "../../../../../types/models";

type Props = {
  mode?: "overview" | "settings";
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

  return "Impossible de charger les evaluations.";
}

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

function EvaluationOverview({ mode = "overview" }: Props) {
  const { etablissement_id, user } = useAuth();
  const [evaluations, setEvaluations] = useState<EvaluationWithRelations[]>([]);
  const [currentYear, setCurrentYear] = useState<AnneeScolaire | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      if (!etablissement_id) {
        setEvaluations([]);
        setCurrentYear(null);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      try {
        const service = new EvaluationService();
        const [result, activeYear] = await Promise.all([
          service.getForEtablissement(etablissement_id, {
            page: 1,
            take: 500,
            includeSpec: JSON.stringify({
              cours: {
                include: {
                  annee: true,
                  classe: {
                    include: {
                      niveau: true,
                      site: true,
                    },
                  },
                  matiere: {
                    include: {
                      departement: true,
                    },
                  },
                  enseignant: {
                    include: {
                      departement: true,
                      personnel: {
                        include: {
                          utilisateur: {
                            include: {
                              profil: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              periode: true,
              typeRef: true,
              createur: {
                include: {
                  personnel: {
                    include: {
                      utilisateur: {
                        include: {
                          profil: true,
                        },
                      },
                    },
                  },
                },
              },
              notes: true,
            }),
            orderBy: JSON.stringify([{ date: "desc" }, { created_at: "desc" }]),
          }),
          anneeScolaireService.getCurrent(etablissement_id),
        ]);

        if (!active) return;

        setEvaluations(
          result?.status.success
            ? ((result.data.data as EvaluationWithRelations[]) ?? [])
            : [],
        );
        setCurrentYear((activeYear as AnneeScolaire | null) ?? null);
      } catch (error: unknown) {
        if (!active) return;
        setErrorMessage(getErrorMessage(error));
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

  const currentYearEvaluations = useMemo(
    () =>
      evaluations.filter((item) => item.cours?.annee_scolaire_id === currentYear?.id).length,
    [currentYear, evaluations],
  );

  const publishedEvaluations = useMemo(
    () => evaluations.filter((item) => item.est_publiee).length,
    [evaluations],
  );

  const withNotes = useMemo(
    () => evaluations.filter((item) => (item.notes?.length ?? 0) > 0).length,
    [evaluations],
  );

  const coveredCourses = useMemo(
    () => new Set(evaluations.map((item) => item.cours_id).filter(Boolean)).size,
    [evaluations],
  );

  const recentEvaluations = useMemo(() => evaluations.slice(0, 6), [evaluations]);

  const typeDistribution = useMemo(() => {
    const counts = new Map<string, number>();

    evaluations.forEach((item) => {
      const key = item.typeRef?.nom?.trim() || item.type || "AUTRE";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 6);
  }, [evaluations]);

  const periodDistribution = useMemo(() => {
    const counts = new Map<string, number>();

    evaluations.forEach((item) => {
      const key = item.periode?.nom?.trim() || "Periode non renseignee";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 6);
  }, [evaluations]);

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
              <FiBookOpen />
              Evaluations
            </span>
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                {user?.etablissement?.nom ?? "Etablissement"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {mode === "settings"
                  ? "Retrouve ici les reperes utiles pour garder les evaluations coherentes avec les cours, periodes et usages en aval dans les notes."
                  : "Accueil du module Evaluations avec une vue rapide sur les evaluations de l'annee, leur publication et leur passage vers les notes."}
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
            <FiBookOpen />
            <span className="text-sm font-medium">Evaluations</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{evaluations.length}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiCalendar />
            <span className="text-sm font-medium">Annee active</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{currentYearEvaluations}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiCheckCircle />
            <span className="text-sm font-medium">Publiees</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{publishedEvaluations}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiLayers />
            <span className="text-sm font-medium">Cours couverts</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{coveredCourses}</p>
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
                Parametres du module Evaluations
              </h3>
              <p className="text-sm text-slate-500">
                Une evaluation propre depend d'un cours valide, d'une periode de la meme annee et d'un parametrage de notation coherent.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Coherence temporelle
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Garde chaque evaluation dans les bornes de sa periode pour simplifier le suivi, les moyennes et les publications.
              </p>
            </div>

            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Flux notes
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Evite de supprimer une evaluation deja notee pour conserver un historique fiable et exploitable dans les modules aval.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Evaluations recentes</h3>
              <p className="text-sm text-slate-500">
                Les dernieres evaluations creees avec leur contexte principal.
              </p>
            </div>

            {recentEvaluations.length > 0 ? (
              <div className="mt-5 space-y-3">
                {recentEvaluations.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {getEvaluationDisplayLabel(item)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {getEvaluationSecondaryLabel(item) || "Aucun detail complementaire"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Prevues le {formatDate(item.date)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                        {item.notes?.length ?? 0} note(s)
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                        {item.est_publiee ? "Publiee" : "Brouillon"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Aucune evaluation n'est encore enregistree pour cet etablissement.
              </div>
            )}
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <FiLayers />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Reperes rapides</h3>
                <p className="text-sm text-slate-500">
                  Une lecture rapide des types, periodes et passage aux notes.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Repartition par type
                </p>
                {typeDistribution.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {typeDistribution.map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between gap-3 text-sm text-slate-700">
                        <span>{type}</span>
                        <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">{count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">Les types apparaitront ici des les premieres evaluations.</p>
                )}
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Repartition par periode
                </p>
                {periodDistribution.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {periodDistribution.map(([periode, count]) => (
                      <div key={periode} className="flex items-center justify-between gap-3 text-sm text-slate-700">
                        <span>{periode}</span>
                        <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">{count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">Les periodes apparaitront ici des les premieres evaluations.</p>
                )}
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Avancement
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                  <li>{publishedEvaluations} evaluation(s) publiee(s).</li>
                  <li>{withNotes} evaluation(s) avec au moins une note enregistree.</li>
                  <li>{evaluations.length - withNotes} evaluation(s) encore sans notes.</li>
                </ul>
              </div>
            </div>
          </article>
        </section>
      )}
    </div>
  );
}

export default EvaluationOverview;
