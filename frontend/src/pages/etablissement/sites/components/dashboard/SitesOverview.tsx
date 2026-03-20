import { useEffect, useMemo, useState } from "react";
import { FiGlobe, FiMapPin, FiPhone, FiSettings, FiLayers } from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import SiteService from "../../../../../services/site.service";
import type { Site } from "../../../../../types/models";

type Props = {
  mode?: "overview" | "settings";
};

function SitesOverview({ mode = "overview" }: Props) {
  const { etablissement_id, user } = useAuth();
  const service = useMemo(() => new SiteService(), []);

  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const loadSites = async () => {
      if (!etablissement_id) {
        setSites([]);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      try {
        const result = await service.getAll({
          page: 1,
          take: 100,
          where: { etablissement_id },
        });

        if (!active) return;
        setSites(result?.status.success ? ((result.data.data as Site[]) ?? []) : []);
      } catch {
        if (!active) return;
        setErrorMessage("Impossible de charger les sites de l'etablissement.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadSites();

    return () => {
      active = false;
    };
  }, [etablissement_id, service]);

  const sitesWithPhone = sites.filter((site) => Boolean(site.telephone)).length;
  const sitesWithAddress = sites.filter((site) => Boolean(site.adresse)).length;
  const previewSites = sites.slice(0, 6);

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
              <FiGlobe />
              Sites de l'etablissement
            </span>
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                {user?.etablissement?.nom ?? "Etablissement"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {mode === "settings"
                  ? "Retrouve ici les regles utiles pour gerer les sites rattaches a l'etablissement connecte."
                  : "Vue d'ensemble des sites actuellement rattaches a l'etablissement de l'utilisateur."}
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
            <FiLayers />
            <span className="text-sm font-medium">Nombre de sites</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{sites.length}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiPhone />
            <span className="text-sm font-medium">Sites avec telephone</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{sitesWithPhone}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiMapPin />
            <span className="text-sm font-medium">Sites avec adresse</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{sitesWithAddress}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiSettings />
            <span className="text-sm font-medium">Etablissement actif</span>
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-900">
            {user?.etablissement?.nom ?? "Non defini"}
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
              <h3 className="text-lg font-semibold text-slate-900">Parametres du module Sites</h3>
              <p className="text-sm text-slate-500">
                Les sites crees ici sont automatiquement rattaches a l'etablissement de
                l'utilisateur connecte quand ce rattachement est connu.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Rattachement
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Chaque site doit appartenir a un etablissement. Dans cet espace, on
                privilegie l'etablissement de l'utilisateur pour eviter les erreurs
                d'affectation.
              </p>
            </div>

            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Qualite des donnees
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Renseigner l'adresse et le telephone des sites facilite ensuite la
                gestion des salles, des classes et des evenements.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Apercu des sites</h3>
              <p className="text-sm text-slate-500">
                Les premiers sites disponibles pour l'etablissement actif.
              </p>
            </div>
          </div>

          {previewSites.length > 0 ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {previewSites.map((site) => (
                <article
                  key={site.id}
                  className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <h4 className="text-base font-semibold text-slate-900">{site.nom}</h4>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <p className="flex items-start gap-2">
                      <FiMapPin className="mt-0.5 shrink-0" />
                      <span>{site.adresse || "Adresse non renseignee"}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <FiPhone className="shrink-0" />
                      <span>{site.telephone || "Telephone non renseigne"}</span>
                    </p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              Aucun site n'est encore enregistre pour cet etablissement.
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default SitesOverview;
