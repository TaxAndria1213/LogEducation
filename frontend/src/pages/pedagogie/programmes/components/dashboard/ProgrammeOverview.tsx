import { useEffect, useMemo, useState } from "react";
import {
  FiBookOpen,
  FiLayers,
  FiSettings,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import anneeScolaireService from "../../../../../services/anneeScolaire.service";
import ProgrammeService, {
  getProgrammeDisplayLabel,
  getProgrammeMatiereSummary,
  type ProgrammeWithRelations,
} from "../../../../../services/programme.service";
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

  return "Impossible de charger les programmes.";
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

function ProgrammeOverview({ mode = "overview" }: Props) {
  const { etablissement_id, user } = useAuth();
  const [programmes, setProgrammes] = useState<ProgrammeWithRelations[]>([]);
  const [currentYear, setCurrentYear] = useState<AnneeScolaire | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      if (!etablissement_id) {
        setProgrammes([]);
        setCurrentYear(null);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      try {
        const service = new ProgrammeService();
        const [result, activeYear] = await Promise.all([
          service.getForEtablissement(etablissement_id, {
            page: 1,
            take: 500,
            includeSpec: JSON.stringify({
              annee: true,
              niveau: true,
              matieres: {
                include: {
                  matiere: {
                    include: {
                      departement: true,
                    },
                  },
                },
              },
            }),
            orderBy: JSON.stringify([{ created_at: "desc" }]),
          }),
          anneeScolaireService.getCurrent(etablissement_id),
        ]);

        if (!active) return;

        setProgrammes(
          result?.status.success
            ? ((result.data.data as ProgrammeWithRelations[]) ?? [])
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

  const currentYearProgrammes = useMemo(
    () => programmes.filter((item) => item.annee_scolaire_id === currentYear?.id).length,
    [currentYear, programmes],
  );

  const coveredLevels = useMemo(
    () =>
      new Set(
        programmes
          .map((item) => item.niveau?.nom?.trim())
          .filter((value): value is string => Boolean(value)),
      ).size,
    [programmes],
  );

  const totalSubjectLinks = useMemo(
    () => programmes.reduce((sum, item) => sum + (item.matieres?.length ?? 0), 0),
    [programmes],
  );

  const averageSubjects = useMemo(() => {
    if (programmes.length === 0) return 0;
    return Math.round((totalSubjectLinks / programmes.length) * 10) / 10;
  }, [programmes, totalSubjectLinks]);

  const recentProgrammes = useMemo(() => programmes.slice(0, 6), [programmes]);

  const levelDistribution = useMemo(() => {
    const counts = new Map<string, number>();

    programmes.forEach((item) => {
      const key = item.niveau?.nom?.trim() || "Niveau non renseigne";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6);
  }, [programmes]);

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
              <FiBookOpen />
              Programmes
            </span>
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                {user?.etablissement?.nom ?? "Etablissement"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {mode === "settings"
                  ? "Retrouve ici les reperes utiles pour garder des programmes coherents avec l'annee scolaire, le niveau et le contenu des matieres."
                  : "Accueil du module Programmes avec une vue rapide sur les programmes actifs, les niveaux couverts et le contenu pedagogique deja structure."}
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
            <span className="text-sm font-medium">Programmes</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{programmes.length}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiTrendingUp />
            <span className="text-sm font-medium">Programmes de l'annee active</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{currentYearProgrammes}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiLayers />
            <span className="text-sm font-medium">Niveaux couverts</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{coveredLevels}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiUsers />
            <span className="text-sm font-medium">Moyenne de matieres</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{averageSubjects}</p>
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
                Parametres du module Programmes
              </h3>
              <p className="text-sm text-slate-500">
                Un programme propre depend d'une annee scolaire claire, d'un niveau bien choisi et d'une liste de matieres sans doublons.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Structure
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Garde un programme par combinaison claire d'annee scolaire, niveau et nom pour eviter les doublons administratifs.
              </p>
            </div>

            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Contenu
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Maintiens les matieres, coefficients et volumes horaires a jour pour faciliter la suite des cours et des evaluations.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Programmes recents
              </h3>
              <p className="text-sm text-slate-500">
                Les derniers programmes crees avec leur structure principale.
              </p>
            </div>

            {recentProgrammes.length > 0 ? (
              <div className="mt-5 space-y-3">
                {recentProgrammes.map((programme) => (
                  <div
                    key={programme.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {getProgrammeDisplayLabel(programme)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Cree le {formatDate(programme.created_at)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {getProgrammeMatiereSummary(programme.matieres, 2)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                        {programme.matieres?.length ?? 0} matiere(s)
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                        {programme.niveau?.nom ?? "Niveau non renseigne"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Aucun programme n'est encore enregistre pour cet etablissement.
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
                  Une lecture rapide des niveaux et du contenu des programmes.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Repartition par niveau
                </p>
                {levelDistribution.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {levelDistribution.map(([niveau, count]) => (
                      <div
                        key={niveau}
                        className="flex items-center justify-between gap-3 text-sm text-slate-700"
                      >
                        <span>{niveau}</span>
                        <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    Aucun niveau n'est encore visible sur les programmes.
                  </p>
                )}
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Contenu pedagogique
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                  <li>{totalSubjectLinks} liaison(s) matiere-programme actuellement enregistree(s).</li>
                  <li>{averageSubjects} matiere(s) en moyenne par programme.</li>
                  <li>{currentYearProgrammes} programme(s) relie(s) a l'annee active.</li>
                </ul>
              </div>
            </div>
          </article>
        </section>
      )}
    </div>
  );
}

export default ProgrammeOverview;
