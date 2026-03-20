import { useEffect, useMemo, useState } from "react";
import {
  FiBookOpen,
  FiCalendar,
  FiLayers,
  FiSettings,
  FiUserCheck,
} from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import anneeScolaireService from "../../../../../services/anneeScolaire.service";
import CoursService, {
  getCoursDisplayLabel,
  getCoursSecondaryLabel,
  type CoursWithRelations,
} from "../../../../../services/cours.service";
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

  return "Impossible de charger les cours.";
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

function CoursOverview({ mode = "overview" }: Props) {
  const { etablissement_id, user } = useAuth();
  const [cours, setCours] = useState<CoursWithRelations[]>([]);
  const [currentYear, setCurrentYear] = useState<AnneeScolaire | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      if (!etablissement_id) {
        setCours([]);
        setCurrentYear(null);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      try {
        const service = new CoursService();
        const [result, activeYear] = await Promise.all([
          service.getForEtablissement(etablissement_id, {
            page: 1,
            take: 500,
            includeSpec: JSON.stringify({
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
              evaluations: true,
              emploiDuTemps: true,
            }),
            orderBy: JSON.stringify([{ created_at: "desc" }]),
          }),
          anneeScolaireService.getCurrent(etablissement_id),
        ]);

        if (!active) return;

        setCours(
          result?.status.success
            ? ((result.data.data as CoursWithRelations[]) ?? [])
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

  const currentYearCours = useMemo(
    () => cours.filter((item) => item.annee_scolaire_id === currentYear?.id).length,
    [cours, currentYear],
  );

  const coveredClasses = useMemo(
    () => new Set(cours.map((item) => item.classe_id).filter(Boolean)).size,
    [cours],
  );

  const coveredMatieres = useMemo(
    () => new Set(cours.map((item) => item.matiere_id).filter(Boolean)).size,
    [cours],
  );

  const linkedTeachers = useMemo(
    () => new Set(cours.map((item) => item.enseignant_id).filter(Boolean)).size,
    [cours],
  );

  const recentCours = useMemo(() => cours.slice(0, 6), [cours]);

  const matiereDistribution = useMemo(() => {
    const counts = new Map<string, number>();

    cours.forEach((item) => {
      const key = item.matiere?.nom?.trim() || "Matiere non renseignee";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6);
  }, [cours]);

  const teacherDistribution = useMemo(() => {
    const counts = new Map<string, number>();

    cours.forEach((item) => {
      const key = getCoursSecondaryLabel(item).split(" • ")[0] || "Enseignant non renseigne";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6);
  }, [cours]);

  const totalEvaluations = useMemo(
    () => cours.reduce((sum, item) => sum + (item.evaluations?.length ?? 0), 0),
    [cours],
  );

  const totalPlanningLinks = useMemo(
    () => cours.reduce((sum, item) => sum + (item.emploiDuTemps?.length ?? 0), 0),
    [cours],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
              <FiBookOpen />
              Cours
            </span>
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                {user?.etablissement?.nom ?? "Etablissement"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {mode === "settings"
                  ? "Retrouve ici les reperes utiles pour garder les cours coherents avec les classes, les programmes, les enseignants et les usages en aval."
                  : "Accueil du module Cours avec une vue rapide sur les affectations pedagogiques actives, les matieres couvertes et les liens vers l'evaluation et l'emploi du temps."}
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
            <span className="text-sm font-medium">Cours enregistres</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{cours.length}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiCalendar />
            <span className="text-sm font-medium">Cours de l'annee active</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{currentYearCours}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiLayers />
            <span className="text-sm font-medium">Classes couvertes</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{coveredClasses}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiUserCheck />
            <span className="text-sm font-medium">Enseignants mobilises</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{linkedTeachers}</p>
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
                Parametres du module Cours
              </h3>
              <p className="text-sm text-slate-500">
                Un cours propre depend d'une classe de la bonne annee, d'une matiere compatible avec le programme et d'un enseignant coherent avec le departement.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Coherence academique
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Garde les cours alignes avec les programmes du niveau pour faciliter ensuite les evaluations, les bulletins et les affectations horaires.
              </p>
            </div>

            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Usage aval
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Evite de supprimer un cours deja utilise dans l'emploi du temps ou les evaluations pour garder un historique fiable.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Cours recents</h3>
              <p className="text-sm text-slate-500">
                Les derniers cours crees avec leurs liaisons principales.
              </p>
            </div>

            {recentCours.length > 0 ? (
              <div className="mt-5 space-y-3">
                {recentCours.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {getCoursDisplayLabel(item)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {getCoursSecondaryLabel(item) || "Aucune information secondaire"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Cree le {formatDate(item.created_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                        {item.evaluations?.length ?? 0} evaluation(s)
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                        {item.emploiDuTemps?.length ?? 0} EDT
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Aucun cours n'est encore enregistre pour cet etablissement.
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
                  Une lecture rapide des matieres couvertes et des usages deja lies.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Matieres les plus presentes
                </p>
                {matiereDistribution.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {matiereDistribution.map(([matiere, count]) => (
                      <div
                        key={matiere}
                        className="flex items-center justify-between gap-3 text-sm text-slate-700"
                      >
                        <span>{matiere}</span>
                        <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    Les matieres apparaitront ici des que les premiers cours seront crees.
                  </p>
                )}
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Charge et usages
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                  <li>{coveredMatieres} matiere(s) distincte(s) couvertes actuellement.</li>
                  <li>{totalEvaluations} evaluation(s) deja rattachee(s) aux cours existants.</li>
                  <li>{totalPlanningLinks} liaison(s) avec l'emploi du temps deja visible(s).</li>
                </ul>
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Enseignants les plus sollicites
                </p>
                {teacherDistribution.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {teacherDistribution.map(([teacher, count]) => (
                      <div
                        key={teacher}
                        className="flex items-center justify-between gap-3 text-sm text-slate-700"
                      >
                        <span>{teacher}</span>
                        <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    Les affectations enseignant apparaitront ici des que les cours seront disponibles.
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

export default CoursOverview;
