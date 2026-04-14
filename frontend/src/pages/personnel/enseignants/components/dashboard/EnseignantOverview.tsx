import { useEffect, useMemo, useState } from "react";
import {
  FiBookOpen,
  FiCopy,
  FiLayers,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import { useInfo } from "../../../../../hooks/useInfo";
import { useAuth } from "../../../../../hooks/useAuth";
import EnseignantService from "../../../../../services/enseignant.service";
import RoleService from "../../../../../services/role.service";
import type { Enseignant, Role } from "../../../../../types/models";
import {
  buildAccountCreationUrl,
  findRoleByTemplate,
} from "../../../../../utils/accountCreationLink";

type Props = {
  mode?: "overview" | "settings";
};

type EnseignantRecord = Enseignant & {
  personnel?: {
    id: string;
    code_personnel?: string | null;
    utilisateur_id?: string | null;
    statut?: string | null;
    poste?: string | null;
    utilisateur?: {
      profil?: {
        prenom?: string | null;
        nom?: string | null;
      } | null;
    } | null;
  } | null;
  departement?: {
    nom?: string | null;
  } | null;
  cours?: Array<{
    id: string;
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

  return "Impossible de charger les enseignants.";
}

function getEnseignantLabel(enseignant: EnseignantRecord) {
  const prenom = enseignant.personnel?.utilisateur?.profil?.prenom?.trim() ?? "";
  const nom = enseignant.personnel?.utilisateur?.profil?.nom?.trim() ?? "";
  const fullName = `${prenom} ${nom}`.trim();
  return fullName || enseignant.personnel?.code_personnel || "Enseignant sans nom";
}

function EnseignantOverview({ mode = "overview" }: Props) {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const [enseignants, setEnseignants] = useState<EnseignantRecord[]>([]);
  const [teacherRole, setTeacherRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);
  const [teacherRoleLoading, setTeacherRoleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      if (!etablissement_id) {
        setEnseignants([]);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      try {
        const service = new EnseignantService();
        const result = await service.getAll({
          page: 1,
          take: 400,
          includeSpec: JSON.stringify({
            personnel: {
              include: {
                utilisateur: {
                  include: {
                    profil: true,
                  },
                },
              },
            },
            departement: true,
            cours: true,
          }),
          where: JSON.stringify({
            personnel: {
              etablissement_id,
            },
          }),
          orderBy: JSON.stringify([{ created_at: "desc" }]),
        });

        if (!active) return;

        setEnseignants(
          result?.status.success
            ? ((result.data.data as EnseignantRecord[]) ?? [])
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

  useEffect(() => {
    let active = true;

    const loadTeacherRole = async () => {
      if (!etablissement_id) {
        setTeacherRole(null);
        return;
      }

      setTeacherRoleLoading(true);

      try {
        const service = new RoleService();
        const result = await service.getAll({
          page: 1,
          take: 200,
          where: JSON.stringify({ etablissement_id }),
          orderBy: JSON.stringify([{ created_at: "desc" }]),
        });

        if (!active) return;

        const roles = result?.status.success ? ((result.data.data as Role[]) ?? []) : [];
        setTeacherRole(findRoleByTemplate(roles, "ENSEIGNANT"));
      } catch (error) {
        if (!active) return;
        console.warn("Impossible de charger le role enseignant.", error);
        setTeacherRole(null);
      } finally {
        if (active) {
          setTeacherRoleLoading(false);
        }
      }
    };

    void loadTeacherRole();

    return () => {
      active = false;
    };
  }, [etablissement_id]);

  const linkedUsers = useMemo(
    () =>
      enseignants.filter((enseignant) => Boolean(enseignant.personnel?.utilisateur_id))
        .length,
    [enseignants],
  );

  const coveredDepartments = useMemo(
    () =>
      new Set(
        enseignants
          .map((enseignant) => enseignant.departement?.nom?.trim())
          .filter((value): value is string => Boolean(value)),
      ).size,
    [enseignants],
  );

  const withCourses = useMemo(
    () =>
      enseignants.filter((enseignant) => (enseignant.cours?.length ?? 0) > 0).length,
    [enseignants],
  );

  const recentEnseignants = useMemo(() => enseignants.slice(0, 6), [enseignants]);

  const departmentDistribution = useMemo(() => {
    const counts = new Map<string, number>();

    enseignants.forEach((enseignant) => {
      const key = enseignant.departement?.nom?.trim() || "Sans departement";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6);
  }, [enseignants]);

  const statusDistribution = useMemo(() => {
    const counts = new Map<string, number>();

    enseignants.forEach((enseignant) => {
      const key = enseignant.personnel?.statut?.trim() || "Non renseigne";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5);
  }, [enseignants]);

  const teacherRoleLabel = teacherRole?.nom?.trim() || "Role enseignant";

  const copyTeacherCreationLink = async () => {
    if (!teacherRole || !etablissement_id) {
      info(
        "Aucun role enseignant exploitable n'est encore configure pour cet etablissement.",
        "warning",
      );
      return;
    }

    try {
      const finalUrl = buildAccountCreationUrl({
        roleId: teacherRole.id,
        etablissementId: etablissement_id,
        roleName: teacherRole.nom,
      });

      await navigator.clipboard.writeText(finalUrl);
      info(
        `Lien de creation utilisateur pour ${teacherRoleLabel} copie dans le presse-papiers.`,
        "success",
      );
    } catch (error) {
      console.warn("Impossible de copier le lien de creation enseignant.", error);
      info("Impossible de copier le lien de creation enseignant.", "error");
    }
  };

  const creationLinkDisabled = teacherRoleLoading || !teacherRole || !etablissement_id;

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

      <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Creation rapide enseignant
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Copie un lien de creation deja rattache au role enseignant de
              l'etablissement.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                teacherRole
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {teacherRoleLoading
                ? "Recherche du role enseignant..."
                : teacherRole
                  ? teacherRoleLabel
                  : "Role enseignant a configurer"}
            </span>

            <button
              type="button"
              onClick={() => void copyTeacherCreationLink()}
              disabled={creationLinkDisabled}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-900 hover:text-slate-900 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            >
              <FiCopy />
              <span>Copier le lien de creation</span>
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiUsers />
            <span className="text-sm font-medium">Enseignants enregistres</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {enseignants.length}
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiUserCheck />
            <span className="text-sm font-medium">Comptes lies</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{linkedUsers}</p>
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
            <FiBookOpen />
            <span className="text-sm font-medium">Enseignants avec cours</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{withCourses}</p>
        </div>
      </section>

      {mode === "settings" ? null : (
        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Enseignants recents
              </h3>
              <p className="text-sm text-slate-500">
                Les derniers profils enseignants crees avec leur rattachement
                principal.
              </p>
            </div>

            {recentEnseignants.length > 0 ? (
              <div className="mt-5 space-y-3">
                {recentEnseignants.map((enseignant) => (
                  <div
                    key={enseignant.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {getEnseignantLabel(enseignant)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Code: {enseignant.personnel?.code_personnel || "Non renseigne"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Departement: {enseignant.departement?.nom || "Non renseigne"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                        {enseignant.personnel?.statut || "Statut non renseigne"}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                        {enseignant.cours?.length ?? 0} cours
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                        Cree le {formatDate(enseignant.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Aucun enseignant n'est encore enregistre pour cet etablissement.
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
                  Une lecture rapide des departements et des statuts visibles.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Repartition des departements
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
                    Aucun departement n'est encore visible sur les fiches
                    enseignants.
                  </p>
                )}
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Repartition des statuts
                </p>
                {statusDistribution.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {statusDistribution.map(([status, count]) => (
                      <div
                        key={status}
                        className="flex items-center justify-between gap-3 text-sm text-slate-700"
                      >
                        <span>{status}</span>
                        <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    Les statuts apparaitront ici quand les fiches seront
                    completees.
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

export default EnseignantOverview;
