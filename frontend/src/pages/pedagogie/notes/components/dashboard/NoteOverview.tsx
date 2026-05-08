import { useEffect, useMemo, useState } from "react";
import {
  FiBarChart2,
  FiCheckCircle,
  FiLayers,
  FiUsers,
} from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import AssessmentResultService, {
  getAssessmentResultDisplayLabel,
  getAssessmentResultPercentage,
  getAssessmentResultStatusLabel,
  type AssessmentResultWithRelations,
} from "../../../../../services/assessmentResult.service";
import { getEleveDisplayLabel } from "../../../../../services/note.service";
import { getEvaluationDisplayLabel } from "../../../../../services/evaluation.service";

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

  return "Impossible de charger les resultats.";
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

function NoteOverview({ mode = "overview" }: Props) {
  const { etablissement_id } = useAuth();
  const [results, setResults] = useState<AssessmentResultWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      if (!etablissement_id) {
        setResults([]);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      try {
        const service = new AssessmentResultService();
        const result = await service.getForEtablissement(etablissement_id, {
          page: 1,
          take: 500,
          includeSpec: JSON.stringify({
            assessment: {
              include: {
                periode: true,
                gradingScale: {
                  include: {
                    levels: true,
                  },
                },
                cours: {
                  include: {
                    annee: true,
                    classe: true,
                    matiere: true,
                  },
                },
              },
            },
            student: {
              include: {
                utilisateur: {
                  include: {
                    profil: true,
                  },
                },
              },
            },
            scaleLevel: true,
          }),
          orderBy: JSON.stringify([{ updated_at: "desc" }, { created_at: "desc" }]),
        });

        if (!active) return;

        setResults(
          result?.status.success
            ? ((result.data.data as AssessmentResultWithRelations[]) ?? [])
            : [],
        );
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

  const distinctAssessments = useMemo(
    () => new Set(results.map((item) => item.assessment_id).filter(Boolean)).size,
    [results],
  );

  const distinctStudents = useMemo(
    () => new Set(results.map((item) => item.student_id).filter(Boolean)).size,
    [results],
  );

  const withObservation = useMemo(
    () => results.filter((item) => Boolean(item.observation?.trim())).length,
    [results],
  );

  const averagePercentage = useMemo(() => {
    const percentages = results
      .map((item) => getAssessmentResultPercentage(item))
      .filter((value): value is number => value !== null);

    if (percentages.length === 0) return 0;
    return Math.round(
      (percentages.reduce((sum, value) => sum + value, 0) / percentages.length) * 10,
    ) / 10;
  }, [results]);

  const recentResults = useMemo(() => results.slice(0, 6), [results]);

  const classDistribution = useMemo(() => {
    const counts = new Map<string, number>();

    results.forEach((item) => {
      const key =
        item.assessment?.cours?.classe?.nom?.trim() || "Classe non renseignee";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6);
  }, [results]);

  const assessmentDistribution = useMemo(() => {
    const counts = new Map<string, number>();

    results.forEach((item) => {
      const key = getEvaluationDisplayLabel(item.assessment);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6);
  }, [results]);

  const statusDistribution = useMemo(() => {
    const counts = new Map<string, number>();

    results.forEach((item) => {
      const key = getAssessmentResultStatusLabel(item.status);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6);
  }, [results]);

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Chargement...
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiBarChart2 />
            <span className="text-sm font-medium">Resultats saisis</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {results.length}
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiLayers />
            <span className="text-sm font-medium">Evaluations couvertes</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {distinctAssessments}
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiUsers />
            <span className="text-sm font-medium">Eleves evalues</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {distinctStudents}
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiCheckCircle />
            <span className="text-sm font-medium">Moyenne normalisee</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {averagePercentage}%
          </p>
        </div>
      </section>

      {mode === "settings" ? null : (
        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Resultats recents
              </h3>
              <p className="text-sm text-slate-500">
                Les derniers resultats enregistres avec leur contexte principal.
              </p>
            </div>

            {recentResults.length > 0 ? (
              <div className="mt-5 space-y-3">
                {recentResults.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {getEleveDisplayLabel(item.student)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {getEvaluationDisplayLabel(item.assessment)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Saisi le {formatDate(item.validated_at ?? item.updated_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                        {getAssessmentResultDisplayLabel(item)}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                        {getAssessmentResultStatusLabel(item.status)}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                        {getAssessmentResultPercentage(item) ?? "-"}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Aucun resultat n'est encore enregistre pour cet etablissement.
              </div>
            )}
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <FiLayers />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Reperes rapides
                </h3>
                <p className="text-sm text-slate-500">
                  Une lecture rapide des classes, evaluations et statuts de saisie.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Repartition par classe
                </p>
                {classDistribution.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {classDistribution.map(([classe, count]) => (
                      <div
                        key={classe}
                        className="flex items-center justify-between gap-3 text-sm text-slate-700"
                      >
                        <span>{classe}</span>
                        <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    Les classes apparaitront ici des les premiers resultats.
                  </p>
                )}
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Evaluations les plus alimentees
                </p>
                {assessmentDistribution.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {assessmentDistribution.map(([assessment, count]) => (
                      <div
                        key={assessment}
                        className="flex items-center justify-between gap-3 text-sm text-slate-700"
                      >
                        <span>{assessment}</span>
                        <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    Les evaluations apparaitront ici des les premiers resultats.
                  </p>
                )}
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Qualite de saisie
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                  <li>{withObservation} resultat(s) avec commentaire.</li>
                  <li>{results.length - withObservation} resultat(s) sans commentaire.</li>
                  <li>{averagePercentage}% de moyenne normalisee sur l'ensemble visible.</li>
                </ul>
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Repartition par statut
                </p>
                {statusDistribution.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {statusDistribution.map(([statusLabel, count]) => (
                      <div
                        key={statusLabel}
                        className="flex items-center justify-between gap-3 text-sm text-slate-700"
                      >
                        <span>{statusLabel}</span>
                        <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    Les statuts de saisie apparaitront ici des les premiers resultats.
                  </p>
                )}
              </div>
            </div>
          </article>
        </section>
      )}
    </div>
  );
}

export default NoteOverview;
