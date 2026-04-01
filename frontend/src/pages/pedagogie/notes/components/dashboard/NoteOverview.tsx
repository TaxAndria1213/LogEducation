import { useEffect, useMemo, useState } from "react";
import {
  FiBarChart2,
  FiCheckCircle,
  FiLayers,
  FiSettings,
  FiUsers,
} from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import NoteService, {
  getEleveDisplayLabel,
  getNotePercentage,
  type NoteWithRelations,
} from "../../../../../services/note.service";
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

  return "Impossible de charger les notes.";
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
  const [notes, setNotes] = useState<NoteWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      if (!etablissement_id) {
        setNotes([]);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      try {
        const service = new NoteService();
        const result = await service.getForEtablissement(etablissement_id, {
          page: 1,
          take: 500,
          includeSpec: JSON.stringify({
            evaluation: {
              include: {
                periode: true,
                cours: {
                  include: {
                    annee: true,
                    classe: true,
                    matiere: true,
                  },
                },
              },
            },
            eleve: {
              include: {
                utilisateur: {
                  include: {
                    profil: true,
                  },
                },
              },
            },
          }),
          orderBy: JSON.stringify([{ note_le: "desc" }, { created_at: "desc" }]),
        });

        if (!active) return;

        setNotes(
          result?.status.success
            ? ((result.data.data as NoteWithRelations[]) ?? [])
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

  const distinctEvaluations = useMemo(
    () => new Set(notes.map((item) => item.evaluation_id).filter(Boolean)).size,
    [notes],
  );

  const distinctStudents = useMemo(
    () => new Set(notes.map((item) => item.eleve_id).filter(Boolean)).size,
    [notes],
  );

  const withComment = useMemo(
    () => notes.filter((item) => Boolean(item.commentaire?.trim())).length,
    [notes],
  );

  const averagePercentage = useMemo(() => {
    const percentages = notes
      .map((item) => getNotePercentage(item))
      .filter((value): value is number => value !== null);

    if (percentages.length === 0) return 0;
    return Math.round((percentages.reduce((sum, value) => sum + value, 0) / percentages.length) * 10) / 10;
  }, [notes]);

  const recentNotes = useMemo(() => notes.slice(0, 6), [notes]);

  const classDistribution = useMemo(() => {
    const counts = new Map<string, number>();

    notes.forEach((item) => {
      const key = item.evaluation?.cours?.classe?.nom?.trim() || "Classe non renseignee";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 6);
  }, [notes]);

  const evaluationDistribution = useMemo(() => {
    const counts = new Map<string, number>();

    notes.forEach((item) => {
      const key = getEvaluationDisplayLabel(item.evaluation);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 6);
  }, [notes]);

  return (
    <div className="space-y-6">      {loading ? <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Chargement...</div> : null}      {errorMessage ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{errorMessage}</div> : null}      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiBarChart2 />
            <span className="text-sm font-medium">Notes saisies</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{notes.length}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiLayers />
            <span className="text-sm font-medium">Evaluations couvertes</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{distinctEvaluations}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiUsers />
            <span className="text-sm font-medium">Eleves notes</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{distinctStudents}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiCheckCircle />
            <span className="text-sm font-medium">Moyenne normalisee</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{averagePercentage}%</p>
        </div>
      </section>

      {mode === "settings" ? null : (
        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Notes recentes</h3>
              <p className="text-sm text-slate-500">
                Les dernieres notes enregistrees avec leur contexte principal.
              </p>
            </div>

            {recentNotes.length > 0 ? (
              <div className="mt-5 space-y-3">
                {recentNotes.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {getEleveDisplayLabel(item.eleve)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {getEvaluationDisplayLabel(item.evaluation)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Saisie le {formatDate(item.note_le)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                        {item.score}/{item.evaluation?.note_max ?? "-"}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                        {getNotePercentage(item) ?? "-"}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Aucune note n'est encore enregistree pour cet etablissement.
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
                  Une lecture rapide des classes, evaluations et commentaires.
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
                      <div key={classe} className="flex items-center justify-between gap-3 text-sm text-slate-700">
                        <span>{classe}</span>
                        <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">{count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">Les classes apparaitront ici des les premieres notes.</p>
                )}
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Evaluations les plus alimentees
                </p>
                {evaluationDistribution.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {evaluationDistribution.map(([evaluation, count]) => (
                      <div key={evaluation} className="flex items-center justify-between gap-3 text-sm text-slate-700">
                        <span>{evaluation}</span>
                        <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">{count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">Les evaluations apparaitront ici des les premieres notes.</p>
                )}
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Qualite de saisie
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                  <li>{withComment} note(s) avec commentaire.</li>
                  <li>{notes.length - withComment} note(s) sans commentaire.</li>
                  <li>{averagePercentage}% de moyenne normalisee sur l'ensemble visible.</li>
                </ul>
              </div>
            </div>
          </article>
        </section>
      )}
    </div>
  );
}

export default NoteOverview;


