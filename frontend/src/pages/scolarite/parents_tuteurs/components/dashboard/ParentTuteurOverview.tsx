import { useEffect, useMemo, useState } from "react";
import {
  FiCoffee,
  FiCheckCircle,
  FiMail,
  FiPhone,
  FiSettings,
  FiUsers,
  FiUserCheck,
  FiTruck,
} from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import AbonnementCantineService from "../../../../../services/abonnementCantine.service";
import AbonnementTransportService from "../../../../../services/abonnementTransport.service";
import ParentTuteurService from "../../../../../services/parentTuteur.service";
import type {
  AbonnementCantine,
  AbonnementTransport,
  ParentTuteur,
} from "../../../../../types/models";

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

type ParentFamilyFinanceSummary = {
  id: string;
  nom_complet?: string | null;
  total_du: number;
  total_en_retard: number;
  nombre_enfants: number;
  nombre_echeances_ouvertes: number;
  enfants: Array<{
    eleve_id: string;
    nom_complet?: string | null;
    sibling_rank?: number | null;
    total_du: number;
    total_en_retard: number;
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
  const { etablissement_id } = useAuth();
  const [parents, setParents] = useState<ParentTuteurRecord[]>([]);
  const [familyFinance, setFamilyFinance] = useState<ParentFamilyFinanceSummary[]>([]);
  const [transportSubscriptions, setTransportSubscriptions] = useState<AbonnementTransport[]>(
    [],
  );
  const [cantineSubscriptions, setCantineSubscriptions] = useState<AbonnementCantine[]>(
    [],
  );
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
        const abonnementTransportService = new AbonnementTransportService();
        const abonnementCantineService = new AbonnementCantineService();
        const [result, financeResult, transportResult, cantineResult] = await Promise.all([
          service.getAll({
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
          }),
          service.getFamilyFinanceList(),
          abonnementTransportService.getForEtablissement(etablissement_id, {
            take: 1000,
            orderBy: JSON.stringify([{ created_at: "desc" }]),
          }),
          abonnementCantineService.getForEtablissement(etablissement_id, {
            take: 1000,
            orderBy: JSON.stringify([{ created_at: "desc" }]),
          }),
        ]);

        if (!active) return;

        setParents(
          result?.status.success
            ? ((result.data.data as ParentTuteurRecord[]) ?? [])
            : [],
        );
        setFamilyFinance(
          financeResult?.status.success
            ? ((financeResult.data as ParentFamilyFinanceSummary[]) ?? [])
            : [],
        );
        setTransportSubscriptions(
          transportResult?.status.success
            ? ((transportResult.data.data as AbonnementTransport[]) ?? [])
            : [],
        );
        setCantineSubscriptions(
          cantineResult?.status.success
            ? ((cantineResult.data.data as AbonnementCantine[]) ?? [])
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
  const familyDebtSnapshots = useMemo(
    () =>
      [...familyFinance]
        .filter((item) => item.total_du > 0)
        .sort((left, right) => right.total_du - left.total_du)
        .slice(0, 6),
    [familyFinance],
  );
  const familyServiceSnapshots = useMemo(() => {
    const activeTransport = transportSubscriptions.filter(
      (subscription) => (subscription.statut ?? "").toUpperCase() === "ACTIF",
    );
    const activeCantine = cantineSubscriptions.filter(
      (subscription) => (subscription.statut ?? "").toUpperCase() === "ACTIF",
    );

    return parents
      .map((parent) => {
        const childIds = (parent.eleves ?? []).map((link) => link.eleve_id);
        const transportCount = activeTransport.filter((subscription) =>
          childIds.includes(subscription.eleve_id),
        ).length;
        const cantineCount = activeCantine.filter((subscription) =>
          childIds.includes(subscription.eleve_id),
        ).length;

        return {
          id: parent.id,
          nom_complet: parent.nom_complet,
          nombre_enfants: childIds.length,
          transportCount,
          cantineCount,
        };
      })
      .filter((item) => item.transportCount > 0 || item.cantineCount > 0)
      .sort(
        (left, right) =>
          right.transportCount +
          right.cantineCount -
          (left.transportCount + left.cantineCount),
      )
      .slice(0, 6);
  }, [cantineSubscriptions, parents, transportSubscriptions]);

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
    <div className="space-y-6">      {loading ? <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Chargement...</div> : null}      {errorMessage ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{errorMessage}</div> : null}      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

      {mode !== "settings" ? (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500">
              <FiTruck />
              <span className="text-sm font-medium">Abonnements transport actifs</span>
            </div>
            <p className="mt-3 text-3xl font-semibold text-slate-900">
              {
                transportSubscriptions.filter(
                  (subscription) => (subscription.statut ?? "").toUpperCase() === "ACTIF",
                ).length
              }
            </p>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3 text-slate-500">
              <FiCoffee />
              <span className="text-sm font-medium">Abonnements cantine actifs</span>
            </div>
            <p className="mt-3 text-3xl font-semibold text-slate-900">
              {
                cantineSubscriptions.filter(
                  (subscription) => (subscription.statut ?? "").toUpperCase() === "ACTIF",
                ).length
              }
            </p>
          </div>
        </section>
      ) : null}

      {mode === "settings" ? null : (
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

      {mode !== "settings" ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Vue services par famille
              </h3>
              <p className="text-sm text-slate-500">
                Lecture consolidee du transport et de la cantine pour les fratries rattachees.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {familyServiceSnapshots.length} famille(s) concernee(s)
            </span>
          </div>

          {familyServiceSnapshots.length > 0 ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {familyServiceSnapshots.map((family) => (
                <article
                  key={family.id}
                  className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {family.nom_complet || "Parent / tuteur"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {family.nombre_enfants} enfant(s) rattache(s)
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[18px] bg-white px-3 py-3 text-sm text-slate-700">
                      <div className="flex items-center gap-2 text-slate-500">
                        <FiTruck />
                        <span>Transport actif</span>
                      </div>
                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {family.transportCount}
                      </p>
                    </div>
                    <div className="rounded-[18px] bg-white px-3 py-3 text-sm text-slate-700">
                      <div className="flex items-center gap-2 text-slate-500">
                        <FiCoffee />
                        <span>Cantine active</span>
                      </div>
                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {family.cantineCount}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              Aucun service transport ou cantine actif n'est encore rattache aux familles de cet etablissement.
            </div>
          )}
        </section>
      ) : null}

      {mode !== "settings" ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Vue finance par famille
              </h3>
              <p className="text-sm text-slate-500">
                Les dettes restent par eleve, mais cette lecture consolidee aide a suivre la fratrie.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
              {familyDebtSnapshots.length} famille(s) avec solde
            </span>
          </div>

          {familyDebtSnapshots.length > 0 ? (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {familyDebtSnapshots.map((family) => (
                <article
                  key={family.id}
                  className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {family.nom_complet || "Parent / tuteur"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {family.nombre_enfants} enfant(s) | {family.nombre_echeances_ouvertes} echeance(s) ouverte(s)
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Total du
                      </p>
                      <p className="text-lg font-semibold text-slate-900">
                        {family.total_du.toLocaleString("fr-FR")} MGA
                      </p>
                      {family.total_en_retard > 0 ? (
                        <p className="mt-1 text-xs font-medium text-rose-600">
                          Retard: {family.total_en_retard.toLocaleString("fr-FR")} MGA
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    {family.enfants.slice(0, 3).map((child) => (
                      <div
                        key={child.eleve_id}
                        className="rounded-[18px] bg-white px-3 py-2 text-sm text-slate-700"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            {child.nom_complet || "Eleve"}
                            {child.sibling_rank ? ` â€¢ Rang ${child.sibling_rank}` : ""}
                          </span>
                          <span className="font-medium text-slate-900">
                            {child.total_du.toLocaleString("fr-FR")} MGA
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              Aucune dette consolidee n'est encore ouverte pour les familles de cet etablissement.
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}

export default ParentTuteurOverview;


