import { useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiClock,
  FiFileText,
  FiLayers,
  FiSettings,
  FiUsers,
} from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import IdentifiantEleveService from "../../../../../services/identifiantEleve.service";
import type { IdentifiantEleve } from "../../../../../types/models";

type Props = {
  mode?: "overview" | "settings";
};

type IdentifiantEleveRecord = IdentifiantEleve & {
  eleve?: {
    code_eleve?: string | null;
    utilisateur?: {
      profil?: {
        prenom?: string | null;
        nom?: string | null;
      } | null;
    } | null;
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

  return "Impossible de charger les identifiants des eleves.";
}

function getEleveLabel(identifiant: IdentifiantEleveRecord) {
  const prenom = identifiant.eleve?.utilisateur?.profil?.prenom?.trim() ?? "";
  const nom = identifiant.eleve?.utilisateur?.profil?.nom?.trim() ?? "";
  const fullName = `${prenom} ${nom}`.trim();
  const code = identifiant.eleve?.code_eleve?.trim() || identifiant.eleve_id;

  return fullName ? `${code} - ${fullName}` : code;
}

function IdentifiantEleveOverview({ mode = "overview" }: Props) {
  const { etablissement_id, user } = useAuth();
  const [identifiants, setIdentifiants] = useState<IdentifiantEleveRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      if (!etablissement_id) {
        setIdentifiants([]);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      try {
        const service = new IdentifiantEleveService();
        const result = await service.getAll({
          page: 1,
          take: 500,
          includeSpec: JSON.stringify({
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
          where: JSON.stringify({
            eleve: {
              etablissement_id,
            },
          }),
          orderBy: JSON.stringify([{ created_at: "desc" }]),
        });

        if (!active) return;

        setIdentifiants(
          result?.status.success
            ? ((result.data.data as IdentifiantEleveRecord[]) ?? [])
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

  const uniqueEleves = useMemo(
    () => new Set(identifiants.map((identifiant) => identifiant.eleve_id)).size,
    [identifiants],
  );
  const distinctTypes = useMemo(
    () =>
      new Set(
        identifiants
          .map((identifiant) => identifiant.type?.trim())
          .filter((value): value is string => Boolean(value)),
      ).size,
    [identifiants],
  );
  const expiredCount = useMemo(() => {
    const now = Date.now();
    return identifiants.filter((identifiant) => {
      if (!identifiant.expire_le) return false;
      return new Date(identifiant.expire_le).getTime() < now;
    }).length;
  }, [identifiants]);
  const expiringSoonCount = useMemo(() => {
    const now = Date.now();
    const limit = now + 30 * 24 * 60 * 60 * 1000;

    return identifiants.filter((identifiant) => {
      if (!identifiant.expire_le) return false;
      const expireAt = new Date(identifiant.expire_le).getTime();
      return expireAt >= now && expireAt <= limit;
    }).length;
  }, [identifiants]);

  const previewIdentifiants = useMemo(() => {
    return [...identifiants]
      .sort((left, right) => {
        const leftExpire = left.expire_le
          ? new Date(left.expire_le).getTime()
          : Number.MAX_SAFE_INTEGER;
        const rightExpire = right.expire_le
          ? new Date(right.expire_le).getTime()
          : Number.MAX_SAFE_INTEGER;

        if (leftExpire !== rightExpire) {
          return leftExpire - rightExpire;
        }

        return (
          new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
        );
      })
      .slice(0, 6);
  }, [identifiants]);

  const typeDistribution = useMemo(() => {
    const counts = new Map<string, number>();

    identifiants.forEach((identifiant) => {
      const key = identifiant.type?.trim() || "Sans type";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6);
  }, [identifiants]);

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
              <FiFileText />
              Identifiants des eleves
            </span>
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                {user?.etablissement?.nom ?? "Etablissement"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {mode === "settings"
                  ? "Retrouve ici les regles utiles pour organiser les pieces, references et dates de validite des identifiants eleves."
                  : "Accueil du module Identifiants des eleves avec une vue rapide sur la couverture des dossiers et les echeances a surveiller."}
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
            <FiFileText />
            <span className="text-sm font-medium">Identifiants enregistres</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {identifiants.length}
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiUsers />
            <span className="text-sm font-medium">Eleves couverts</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{uniqueEleves}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiLayers />
            <span className="text-sm font-medium">Types distincts</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{distinctTypes}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiAlertTriangle />
            <span className="text-sm font-medium">Expires ou proches</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {expiredCount + expiringSoonCount}
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
                Parametres du module Identifiants
              </h3>
              <p className="text-sm text-slate-500">
                Une gestion propre des types et des dates de validite facilite le suivi
                administratif des eleves.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Qualite des references
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Harmonise les types d'identifiants saisis pour garder une lecture claire
                entre numero scolaire, piece officielle et reference interne.
              </p>
            </div>

            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Suivi des echeances
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Surveille les dates d'expiration pour anticiper les renouvellements et
                garder les dossiers eleves a jour.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Identifiants a surveiller
              </h3>
              <p className="text-sm text-slate-500">
                Les identifiants expires ou les plus proches de leur date limite.
              </p>
            </div>

            {previewIdentifiants.length > 0 ? (
              <div className="mt-5 space-y-3">
                {previewIdentifiants.map((identifiant) => {
                  const expireAt = identifiant.expire_le
                    ? new Date(identifiant.expire_le).getTime()
                    : null;
                  const isExpired = expireAt !== null && expireAt < Date.now();

                  return (
                    <div
                      key={identifiant.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {identifiant.type || "Type non renseigne"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {getEleveLabel(identifiant)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Valeur: {identifiant.valeur}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                          Delivre: {formatDate(identifiant.delivre_le)}
                        </span>
                        <span
                          className={`rounded-full px-3 py-1 font-medium ${
                            isExpired
                              ? "bg-rose-100 text-rose-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          Expire: {formatDate(identifiant.expire_le)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Aucun identifiant n'est encore enregistre pour cet etablissement.
              </div>
            )}
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <FiClock />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Points de suivi
                </h3>
                <p className="text-sm text-slate-500">
                  Repartition des types et points d'attention rapides.
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
                      <div
                        key={type}
                        className="flex items-center justify-between gap-3 text-sm text-slate-700"
                      >
                        <span>{type}</span>
                        <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    Aucun type n'est encore disponible.
                  </p>
                )}
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Vigilance
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                  <li>{expiredCount} identifiant(s) deja expire(s).</li>
                  <li>{expiringSoonCount} identifiant(s) expirent dans les 30 prochains jours.</li>
                  <li>{distinctTypes} type(s) d'identifiants actuellement utilises.</li>
                </ul>
              </div>
            </div>
          </article>
        </section>
      )}
    </div>
  );
}

export default IdentifiantEleveOverview;
