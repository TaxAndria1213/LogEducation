import { useEffect, useMemo, useState } from "react";
import {
  FiBriefcase,
  FiSettings,
  FiShield,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import PersonnelService from "../../../../../services/personnel.service";
import type { Personnel } from "../../../../../types/models";

type Props = {
  mode?: "overview" | "settings";
};

type PersonnelRecord = Personnel & {
  utilisateur?: {
    profil?: {
      prenom?: string | null;
      nom?: string | null;
    } | null;
    roles?: Array<{
      role?: {
        nom?: string | null;
      } | null;
    }>;
  } | null;
  enseignant?: {
    id: string;
  } | null;
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

  return "Impossible de charger les personnels.";
}

function getPersonnelLabel(personnel: PersonnelRecord) {
  const prenom = personnel.utilisateur?.profil?.prenom?.trim() ?? "";
  const nom = personnel.utilisateur?.profil?.nom?.trim() ?? "";
  const fullName = `${prenom} ${nom}`.trim();
  return fullName || personnel.code_personnel || "Personnel sans nom";
}

function PersonnelOverview({ mode = "overview" }: Props) {
  const { etablissement_id, user } = useAuth();
  const [personnels, setPersonnels] = useState<PersonnelRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      if (!etablissement_id) {
        setPersonnels([]);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      try {
        const service = new PersonnelService();
        const result = await service.getAll({
          page: 1,
          take: 400,
          includeSpec: JSON.stringify({
            utilisateur: {
              include: {
                profil: true,
                roles: {
                  include: {
                    role: true,
                  },
                },
              },
            },
            enseignant: true,
          }),
          where: JSON.stringify({ etablissement_id }),
          orderBy: JSON.stringify([
            { date_embauche: "desc" },
            { created_at: "desc" },
          ]),
        });

        if (!active) return;

        setPersonnels(
          result?.status.success
            ? ((result.data.data as PersonnelRecord[]) ?? [])
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

  const linkedUsers = useMemo(
    () => personnels.filter((personnel) => Boolean(personnel.utilisateur_id)).length,
    [personnels],
  );
  const linkedTeachers = useMemo(
    () => personnels.filter((personnel) => Boolean(personnel.enseignant?.id)).length,
    [personnels],
  );
  const statusesCount = useMemo(
    () =>
      new Set(
        personnels
          .map((personnel) => personnel.statut?.trim())
          .filter((value): value is string => Boolean(value)),
      ).size,
    [personnels],
  );

  const recentPersonnels = useMemo(() => personnels.slice(0, 6), [personnels]);

  const roleDistribution = useMemo(() => {
    const counts = new Map<string, number>();

    personnels.forEach((personnel) => {
      const roles = personnel.utilisateur?.roles ?? [];

      if (roles.length === 0) {
        counts.set("Sans role", (counts.get("Sans role") ?? 0) + 1);
        return;
      }

      roles.forEach((entry) => {
        const key = entry.role?.nom?.trim() || "Role non renseigne";
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
    });

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6);
  }, [personnels]);

  const statusDistribution = useMemo(() => {
    const counts = new Map<string, number>();

    personnels.forEach((personnel) => {
      const key = personnel.statut?.trim() || "Non renseigne";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5);
  }, [personnels]);

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
              <FiBriefcase />
              Personnels
            </span>
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                {user?.etablissement?.nom ?? "Etablissement"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {mode === "settings"
                  ? "Retrouve ici les reperes utiles pour garder des fiches personnel propres, reliees aux bons comptes et aux bons roles."
                  : "Accueil du module Personnel avec une vue rapide sur les effectifs, les comptes lies et les profils enseignants deja rattaches."}
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
            <FiUsers />
            <span className="text-sm font-medium">Personnels enregistres</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {personnels.length}
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
            <FiBriefcase />
            <span className="text-sm font-medium">Profils enseignants</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {linkedTeachers}
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiShield />
            <span className="text-sm font-medium">Statuts distincts</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {statusesCount}
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
                Parametres du module Personnel
              </h3>
              <p className="text-sm text-slate-500">
                Une base personnel propre facilite ensuite les comptes, les affectations,
                les droits d'acces et les modules enseignants.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Rattachement compte
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Lie chaque fiche personnel au bon utilisateur pour garder une lecture
                claire des acces et des responsabilites dans l'etablissement.
              </p>
            </div>

            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Cohesion des roles
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Harmonise les postes, les statuts et les profils enseignants pour
                simplifier la suite des affectations et du suivi administratif.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Personnels recents
              </h3>
              <p className="text-sm text-slate-500">
                Les fiches les plus recentes avec leur compte, leur poste et leur date
                d'embauche.
              </p>
            </div>

            {recentPersonnels.length > 0 ? (
              <div className="mt-5 space-y-3">
                {recentPersonnels.map((personnel) => {
                  const roleNames = (personnel.utilisateur?.roles ?? [])
                    .map((entry) => entry.role?.nom?.trim())
                    .filter((value): value is string => Boolean(value));

                  return (
                    <div
                      key={personnel.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {getPersonnelLabel(personnel)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Code: {personnel.code_personnel || "Non renseigne"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Poste: {personnel.poste || "Non renseigne"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                          {personnel.statut || "Statut non renseigne"}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                          Embauche: {formatDate(personnel.date_embauche)}
                        </span>
                        <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                          {roleNames.length > 0 ? roleNames.join(", ") : "Sans role"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Aucun personnel n'est encore enregistre pour cet etablissement.
              </div>
            )}
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <FiShield />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Reperes rapides
                </h3>
                <p className="text-sm text-slate-500">
                  Une lecture rapide des roles et des statuts dans l'effectif actuel.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Repartition des roles
                </p>
                {roleDistribution.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {roleDistribution.map(([role, count]) => (
                      <div
                        key={role}
                        className="flex items-center justify-between gap-3 text-sm text-slate-700"
                      >
                        <span>{role}</span>
                        <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    Aucun role n'est encore visible sur les fiches personnel.
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
                    Les statuts apparaitront ici des que les fiches seront completees.
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

export default PersonnelOverview;
