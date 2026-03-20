import { useEffect, useMemo, useState } from "react";
import {
  FiCheckCircle,
  FiMail,
  FiPhone,
  FiSettings,
  FiUsers,
  FiUserCheck,
} from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import ParentTuteurService from "../../../../../services/parentTuteur.service";
import type { ParentTuteur } from "../../../../../types/models";

type Props = {
  mode?: "overview" | "settings";
};

type ParentTuteurRecord = ParentTuteur & {
  eleves?: Array<{
    eleve_id: string;
    relation?: string | null;
    est_principal: boolean;
    autorise_recuperation: boolean;
    eleve?: {
      code_eleve?: string | null;
      utilisateur?: {
        profil?: {
          prenom?: string | null;
          nom?: string | null;
        } | null;
      } | null;
    } | null;
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

  return "Impossible de charger les parents et tuteurs.";
}

function getEleveLabel(link: NonNullable<ParentTuteurRecord["eleves"]>[number]) {
  const prenom = link.eleve?.utilisateur?.profil?.prenom?.trim() ?? "";
  const nom = link.eleve?.utilisateur?.profil?.nom?.trim() ?? "";
  const fullName = `${prenom} ${nom}`.trim();
  const code = link.eleve?.code_eleve?.trim() || link.eleve_id;

  return fullName ? `${code} - ${fullName}` : code;
}

function ParentTuteurOverview({ mode = "overview" }: Props) {
  const { etablissement_id, user } = useAuth();
  const [parents, setParents] = useState<ParentTuteurRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      if (!etablissement_id) {
        setParents([]);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      try {
        const service = new ParentTuteurService();
        const result = await service.getAll({
          page: 1,
          take: 500,
          includeSpec: JSON.stringify({
            eleves: {
              include: {
                eleve: {
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
          }),
          where: JSON.stringify({ etablissement_id }),
          orderBy: JSON.stringify([{ created_at: "desc" }]),
        });

        if (!active) return;

        setParents(
          result?.status.success
            ? ((result.data.data as ParentTuteurRecord[]) ?? [])
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

  const withPhone = useMemo(
    () => parents.filter((parent) => Boolean(parent.telephone?.trim())).length,
    [parents],
  );
  const withEmail = useMemo(
    () => parents.filter((parent) => Boolean(parent.email?.trim())).length,
    [parents],
  );
  const uniqueEleves = useMemo(() => {
    const ids = new Set<string>();

    parents.forEach((parent) => {
      parent.eleves?.forEach((link) => ids.add(link.eleve_id));
    });

    return ids.size;
  }, [parents]);
  const principalLinks = useMemo(
    () =>
      parents.reduce((count, parent) => {
        return count + (parent.eleves?.filter((link) => link.est_principal).length ?? 0);
      }, 0),
    [parents],
  );

  const recentParents = useMemo(() => parents.slice(0, 6), [parents]);

  const relationDistribution = useMemo(() => {
    const counts = new Map<string, number>();

    parents.forEach((parent) => {
      parent.eleves?.forEach((link) => {
        const key = link.relation?.trim() || "Non renseignee";
        counts.set(key, (counts.get(key) ?? 0) + 1);
      });
    });

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6);
  }, [parents]);

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
              <FiUsers />
              Parents et tuteurs
            </span>
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                {user?.etablissement?.nom ?? "Etablissement"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {mode === "settings"
                  ? "Retrouve ici les repères utiles pour maintenir des contacts fiables et des liens eleve-tuteur cohérents."
                  : "Accueil du module Parents/Tuteurs avec une lecture rapide des contacts disponibles et des rattachements aux eleves."}
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
            <span className="text-sm font-medium">Parents/Tuteurs</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{parents.length}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiUserCheck />
            <span className="text-sm font-medium">Eleves rattaches</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{uniqueEleves}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiPhone />
            <span className="text-sm font-medium">Contacts telephone</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{withPhone}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiMail />
            <span className="text-sm font-medium">Contacts email</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{withEmail}</p>
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
                Parametres du module Parents/Tuteurs
              </h3>
              <p className="text-sm text-slate-500">
                Des fiches de contact propres améliorent ensuite les inscriptions, les
                communications et la recuperation des eleves.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Coordonnees
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Garde au moins un moyen de contact fiable par parent ou tuteur pour
                faciliter les echanges avec l'etablissement.
              </p>
            </div>

            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Liens eleves
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Verifie les statuts de tuteur principal et d'autorisation de recuperation
                pour garder les informations administratives coherentes.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Parents/Tuteurs recents
              </h3>
              <p className="text-sm text-slate-500">
                Les fiches de contact les plus recentes et leurs rattachements connus.
              </p>
            </div>

            {recentParents.length > 0 ? (
              <div className="mt-5 space-y-3">
                {recentParents.map((parent) => (
                  <div
                    key={parent.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {parent.nom_complet}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Email: {parent.email || "Non renseigne"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Telephone: {parent.telephone || "Non renseigne"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                        {parent.eleves?.length ?? 0} eleve(s)
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                        Cree le {formatDate(parent.created_at)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Aucun parent ou tuteur n'est encore enregistre pour cet etablissement.
              </div>
            )}
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <FiCheckCircle />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Cadre de suivi
                </h3>
                <p className="text-sm text-slate-500">
                  Repartition rapide des liens et vigilance sur les fiches de contact.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Liens principaux
                </p>
                <p className="mt-3 text-2xl font-semibold text-slate-900">
                  {principalLinks}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Liens marques comme tuteur principal dans les rattachements actuels.
                </p>
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Repartition des relations
                </p>
                {relationDistribution.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {relationDistribution.map(([relation, count]) => (
                      <div
                        key={relation}
                        className="flex items-center justify-between gap-3 text-sm text-slate-700"
                      >
                        <span>{relation}</span>
                        <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    Aucun lien eleve-parent n'est encore disponible.
                  </p>
                )}
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Apercu des eleves lies
                </p>
                {recentParents.some((parent) => (parent.eleves?.length ?? 0) > 0) ? (
                  <div className="mt-3 space-y-2">
                    {recentParents
                      .flatMap((parent) =>
                        (parent.eleves ?? []).slice(0, 1).map((link) => ({
                          key: `${parent.id}-${link.eleve_id}`,
                          parent: parent.nom_complet,
                          eleve: getEleveLabel(link),
                        })),
                      )
                      .slice(0, 4)
                      .map((item) => (
                        <div
                          key={item.key}
                          className="rounded-[18px] bg-white px-3 py-2 text-sm text-slate-700"
                        >
                          {item.parent}: {item.eleve}
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    Les rattachements eleves apparaitront ici quand ils seront disponibles.
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

export default ParentTuteurOverview;
