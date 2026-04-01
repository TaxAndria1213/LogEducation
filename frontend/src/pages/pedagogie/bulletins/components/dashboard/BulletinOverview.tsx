import { useEffect, useMemo, useState } from "react";
import {
  FiBookOpen,
  FiCalendar,
  FiCheckCircle,
  FiLayers,
  FiSettings,
} from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import BulletinService, {
  getBulletinAverage,
  getBulletinDisplayLabel,
  getBulletinSecondaryLabel,
  type BulletinWithRelations,
} from "../../../../../services/bulletin.service";

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

  return "Impossible de charger les bulletins.";
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

function BulletinOverview({ mode = "overview" }: Props) {
  const { etablissement_id } = useAuth();
  const [bulletins, setBulletins] = useState<BulletinWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      if (!etablissement_id) {
        setBulletins([]);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      try {
        const service = new BulletinService();
        const result = await service.getForEtablissement(etablissement_id, {
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
            periode: true,
            classe: {
              include: {
                niveau: true,
                site: true,
              },
            },
            lignes: {
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
        });

        if (!active) return;

        setBulletins(
          result?.status.success
            ? ((result.data.data as BulletinWithRelations[]) ?? [])
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

  const publishedBulletins = useMemo(
    () => bulletins.filter((item) => item.statut === "PUBLIE").length,
    [bulletins],
  );

  const generatedBulletins = useMemo(
    () => bulletins.filter((item) => (item.lignes?.length ?? 0) > 0).length,
    [bulletins],
  );

  const coveredClasses = useMemo(
    () => new Set(bulletins.map((item) => item.classe_id).filter(Boolean)).size,
    [bulletins],
  );

  const averageGeneral = useMemo(() => {
    const averages = bulletins
      .map((item) => getBulletinAverage(item.lignes))
      .filter((value): value is number => value !== null);

    if (averages.length === 0) return 0;
    return Math.round((averages.reduce((sum, value) => sum + value, 0) / averages.length) * 100) / 100;
  }, [bulletins]);

  const recentBulletins = useMemo(() => bulletins.slice(0, 6), [bulletins]);

  const classDistribution = useMemo(() => {
    const counts = new Map<string, number>();

    bulletins.forEach((item) => {
      const key = item.classe?.nom?.trim() || "Classe non renseignee";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 6);
  }, [bulletins]);

  const periodDistribution = useMemo(() => {
    const counts = new Map<string, number>();

    bulletins.forEach((item) => {
      const key = item.periode?.nom?.trim() || "Periode non renseignee";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 6);
  }, [bulletins]);

  return (
    <div className="space-y-6">      {loading ? <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Chargement...</div> : null}      {errorMessage ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{errorMessage}</div> : null}      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiBookOpen />
            <span className="text-sm font-medium">Bulletins</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{bulletins.length}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiCheckCircle />
            <span className="text-sm font-medium">Publies</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{publishedBulletins}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiLayers />
            <span className="text-sm font-medium">Avec lignes</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{generatedBulletins}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiCalendar />
            <span className="text-sm font-medium">Moyenne globale</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{averageGeneral}</p>
        </div>
      </section>

      {mode === "settings" ? null : (
        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Bulletins recents</h3>
              <p className="text-sm text-slate-500">
                Les derniers bulletins crees avec leur contexte principal.
              </p>
            </div>

            {recentBulletins.length > 0 ? (
              <div className="mt-5 space-y-3">
                {recentBulletins.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {getBulletinDisplayLabel(item)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {getBulletinSecondaryLabel(item) || "Aucun detail complementaire"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Cree le {formatDate(item.created_at)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                        {item.lignes?.length ?? 0} ligne(s)
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">
                        {item.statut ?? "-"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Aucun bulletin n'est encore enregistre pour cet etablissement.
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
                  Une lecture rapide des classes, periodes et publication.
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
                  <p className="mt-3 text-sm text-slate-500">Les classes apparaitront ici des les premiers bulletins.</p>
                )}
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Repartition par periode
                </p>
                {periodDistribution.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {periodDistribution.map(([periode, count]) => (
                      <div key={periode} className="flex items-center justify-between gap-3 text-sm text-slate-700">
                        <span>{periode}</span>
                        <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-700">{count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">Les periodes apparaitront ici des les premiers bulletins.</p>
                )}
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Avancement
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                  <li>{coveredClasses} classe(s) couverte(s).</li>
                  <li>{generatedBulletins} bulletin(s) avec lignes deja calculees.</li>
                  <li>{publishedBulletins} bulletin(s) publie(s).</li>
                </ul>
              </div>
            </div>
          </article>
        </section>
      )}
    </div>
  );
}

export default BulletinOverview;


