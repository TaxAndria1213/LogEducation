import { useEffect, useMemo, useState } from "react";
import {
  FiBookOpen,
  FiLayers,
  FiSettings,
  FiUsers,
  FiUserCheck,
} from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import DepartementService from "../../../../../services/departement.service";
import type { Departement } from "../../../../../types/models";

type Props = {
  mode?: "overview" | "settings";
};

type DepartementRecord = Departement & {
  enseignants?: Array<{
    id: string;
  }>;
  matieres?: Array<{
    id: string;
    nom?: string | null;
  }>;
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

  return "Impossible de charger les departements.";
}

function DepartementOverview({ mode = "overview" }: Props) {
  const { etablissement_id } = useAuth();
  const [departements, setDepartements] = useState<DepartementRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      if (!etablissement_id) {
        setDepartements([]);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      try {
        const service = new DepartementService();
        const result = await service.getAll({
          page: 1,
          take: 300,
          includeSpec: JSON.stringify({
            enseignants: true,
            matieres: true,
          }),
          where: JSON.stringify({ etablissement_id }),
          orderBy: JSON.stringify([{ nom: "asc" }]),
        });

        if (!active) return;

        setDepartements(
          result?.status.success
            ? ((result.data.data as DepartementRecord[]) ?? [])
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

  const withTeachers = useMemo(
    () => departements.filter((item) => (item.enseignants?.length ?? 0) > 0).length,
    [departements],
  );
  const withSubjects = useMemo(
    () => departements.filter((item) => (item.matieres?.length ?? 0) > 0).length,
    [departements],
  );
  const totalTeachers = useMemo(
    () =>
      departements.reduce((sum, item) => sum + (item.enseignants?.length ?? 0), 0),
    [departements],
  );

  const recentDepartements = useMemo(
    () =>
      [...departements]
        .sort(
          (left, right) =>
            new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
        )
        .slice(0, 6),
    [departements],
  );

  const teacherDistribution = useMemo(() => {
    return [...departements]
      .map((item) => ({
        nom: item.nom,
        count: item.enseignants?.length ?? 0,
      }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 6);
  }, [departements]);

  const subjectDistribution = useMemo(() => {
    return [...departements]
      .map((item) => ({
        nom: item.nom,
        count: item.matieres?.length ?? 0,
      }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 6);
  }, [departements]);

  return (
    <div className="space-y-6">      {loading ? <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Chargement...</div> : null}      {errorMessage ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{errorMessage}</div> : null}      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiLayers />
            <span className="text-sm font-medium">Departements</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {departements.length}
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiUserCheck />
            <span className="text-sm font-medium">Avec enseignants</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{withTeachers}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiBookOpen />
            <span className="text-sm font-medium">Avec matieres</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{withSubjects}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiUsers />
            <span className="text-sm font-medium">Enseignants rattaches</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{totalTeachers}</p>
        </div>
      </section>

      {mode === "settings" ? null : (
        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Departements recents
              </h3>
              <p className="text-sm text-slate-500">
                Les derniers departements crees avec un apercu rapide de leurs
                rattachements.
              </p>
            </div>

            {recentDepartements.length > 0 ? (
              <div className="mt-5 space-y-3">
                {recentDepartements.map((departement) => (
                  <div
                    key={departement.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {departement.nom}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Cree le {formatDate(departement.created_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                        {departement.enseignants?.length ?? 0} enseignant(s)
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                        {departement.matieres?.length ?? 0} matiere(s)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Aucun departement n'est encore enregistre pour cet etablissement.
              </div>
            )}
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <FiBookOpen />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Reperes rapides
                </h3>
                <p className="text-sm text-slate-500">
                  Une lecture rapide des charges par departement.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Repartition des enseignants
                </p>
                {teacherDistribution.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {teacherDistribution.map((item) => (
                      <div
                        key={item.nom}
                        className="flex items-center justify-between gap-3 text-sm text-slate-700"
                      >
                        <span>{item.nom}</span>
                        <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    Aucun rattachement enseignant n'est encore visible.
                  </p>
                )}
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Repartition des matieres
                </p>
                {subjectDistribution.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {subjectDistribution.map((item) => (
                      <div
                        key={item.nom}
                        className="flex items-center justify-between gap-3 text-sm text-slate-700"
                      >
                        <span>{item.nom}</span>
                        <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    Aucune matiere n'est encore rattachee aux departements.
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

export default DepartementOverview;


