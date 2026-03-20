import { useEffect, useMemo, useState } from "react";
import {
  FiBookOpen,
  FiLayers,
  FiSettings,
  FiTag,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import MatiereService, {
  getMatiereDisplayLabel,
  type MatiereWithRelations,
} from "../../../../../services/matiere.service";

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

  return "Impossible de charger les matieres.";
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

function MatiereOverview({ mode = "overview" }: Props) {
  const { etablissement_id, user } = useAuth();
  const [matieres, setMatieres] = useState<MatiereWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      if (!etablissement_id) {
        setMatieres([]);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      try {
        const service = new MatiereService();
        const result = await service.getForEtablissement(etablissement_id, {
          page: 1,
          take: 500,
          includeSpec: JSON.stringify({
            departement: true,
            cours: {
              select: { id: true },
            },
            lignesProgramme: {
              include: {
                programme: {
                  select: {
                    id: true,
                    nom: true,
                  },
                },
              },
            },
          }),
          orderBy: JSON.stringify([{ created_at: "desc" }]),
        });

        if (!active) return;

        setMatieres(
          result?.status.success
            ? ((result.data.data as MatiereWithRelations[]) ?? [])
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

  const coveredDepartments = useMemo(
    () =>
      new Set(
        matieres
          .map((item) => item.departement?.nom?.trim())
          .filter((value): value is string => Boolean(value)),
      ).size,
    [matieres],
  );

  const usedInCourses = useMemo(
    () => matieres.filter((item) => (item.cours?.length ?? 0) > 0).length,
    [matieres],
  );

  const distinctProgrammes = useMemo(() => {
    const ids = new Set<string>();

    matieres.forEach((item) => {
      item.lignesProgramme?.forEach((line) => {
        if (line.programme?.id) {
          ids.add(line.programme.id);
        }
      });
    });

    return ids.size;
  }, [matieres]);

  const withoutDepartement = useMemo(
    () => matieres.filter((item) => !item.departement_id).length,
    [matieres],
  );

  const recentMatieres = useMemo(() => matieres.slice(0, 6), [matieres]);

  const departmentDistribution = useMemo(() => {
    const counts = new Map<string, number>();

    matieres.forEach((item) => {
      const key = item.departement?.nom?.trim() || "Sans departement";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6);
  }, [matieres]);

  const attentionItems = useMemo(
    () =>
      matieres
        .filter(
          (item) =>
            !item.departement_id ||
            ((item.cours?.length ?? 0) === 0 &&
              (item.lignesProgramme?.length ?? 0) === 0),
        )
        .slice(0, 5),
    [matieres],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
              <FiBookOpen />
              Matieres
            </span>
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                {user?.etablissement?.nom ?? "Etablissement"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {mode === "settings"
                  ? "Retrouve ici les reperes utiles pour garder une base de matieres coherente avec les departements, les cours et les programmes."
                  : "Accueil du module Matieres avec une vue rapide sur la structure pedagogique, l'usage des matieres et les points de vigilance."}
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
            <span className="text-sm font-medium">Matieres enregistrees</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {matieres.length}
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiLayers />
            <span className="text-sm font-medium">Departements couverts</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {coveredDepartments}
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiUsers />
            <span className="text-sm font-medium">Utilisees en cours</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {usedInCourses}
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiTrendingUp />
            <span className="text-sm font-medium">Programmes lies</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {distinctProgrammes}
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
                Parametres du module Matieres
              </h3>
              <p className="text-sm text-slate-500">
                Une matiere bien nommee et bien rattachee evite ensuite les doublons
                dans les cours, les programmes, les bulletins et l'emploi du temps.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Nommage
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Garde un seul nom clair par matiere et reserve les codes aux usages
                pratiques comme les listes, les horaires ou les exports.
              </p>
            </div>

            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Structure
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Associer les matieres aux bons departements aide ensuite les
                affectations enseignants, les programmes et les tableaux de bord.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Matieres recentes
              </h3>
              <p className="text-sm text-slate-500">
                Les dernieres matieres creees avec leur usage actuel.
              </p>
            </div>

            {recentMatieres.length > 0 ? (
              <div className="mt-5 space-y-3">
                {recentMatieres.map((matiere) => {
                  const programmeNames = Array.from(
                    new Set(
                      (matiere.lignesProgramme ?? [])
                        .map((line) => line.programme?.nom?.trim())
                        .filter((value): value is string => Boolean(value)),
                    ),
                  ).slice(0, 2);

                  return (
                    <div
                      key={matiere.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {getMatiereDisplayLabel(matiere)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Creee le {formatDate(matiere.created_at)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Programmes:{" "}
                          {programmeNames.length > 0
                            ? programmeNames.join(", ")
                            : "Aucun pour le moment"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                          {matiere.cours?.length ?? 0} cours
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                          {matiere.lignesProgramme?.length ?? 0} lien(s) programme
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Aucune matiere n'est encore enregistree pour cet etablissement.
              </div>
            )}
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <FiTag />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Points de suivi
                </h3>
                <p className="text-sm text-slate-500">
                  Une lecture rapide des repartitions et des points a nettoyer.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Repartition par departement
                </p>
                {departmentDistribution.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {departmentDistribution.map(([department, count]) => (
                      <div
                        key={department}
                        className="flex items-center justify-between gap-3 text-sm text-slate-700"
                      >
                        <span>{department}</span>
                        <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    Aucune repartition n'est encore disponible.
                  </p>
                )}
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Vigilance
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                  <li>{withoutDepartement} matiere(s) sans departement.</li>
                  <li>
                    {
                      matieres.filter(
                        (item) =>
                          (item.cours?.length ?? 0) === 0 &&
                          (item.lignesProgramme?.length ?? 0) === 0,
                      ).length
                    }{" "}
                    matiere(s) encore non utilisee(s).
                  </li>
                  <li>{distinctProgrammes} programme(s) distinct(s) relies aux matieres.</li>
                </ul>

                {attentionItems.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {attentionItems.map((matiere) => (
                      <div
                        key={matiere.id}
                        className="rounded-[18px] bg-white px-3 py-2 text-sm text-slate-700"
                      >
                        {getMatiereDisplayLabel(matiere)}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </article>
        </section>
      )}
    </div>
  );
}

export default MatiereOverview;
