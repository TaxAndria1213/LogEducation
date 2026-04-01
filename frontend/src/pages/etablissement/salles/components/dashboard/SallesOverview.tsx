import { useEffect, useMemo, useState } from "react";
import { FiGrid, FiHome, FiLayers, FiMapPin, FiSettings } from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import salleService from "../../../../../services/salle.service";
import type { Salle } from "../../../../../types/models";

type Props = {
  mode?: "overview" | "settings";
};

function SallesOverview({ mode = "overview" }: Props) {
  const { etablissement_id } = useAuth();

  const [salles, setSalles] = useState<Salle[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const loadSalles = async () => {
      if (!etablissement_id) {
        setSalles([]);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      try {
        const result = await salleService.getAll({
          page: 1,
          take: 200,
          includes: ["site"],
          where: { site: { etablissement_id } },
        });

        if (!active) return;
        setSalles(result?.status.success ? ((result.data.data as Salle[]) ?? []) : []);
      } catch {
        if (!active) return;
        setErrorMessage("Impossible de charger les salles de l'etablissement.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadSalles();

    return () => {
      active = false;
    };
  }, [etablissement_id]);

  const siteCount = useMemo(() => {
    return new Set(salles.map((salle) => salle.site_id).filter(Boolean)).size;
  }, [salles]);

  const totalCapacity = useMemo(() => {
    return salles.reduce((sum, salle) => sum + (salle.capacite ?? 0), 0);
  }, [salles]);

  const typedCount = useMemo(() => {
    return salles.filter((salle) => Boolean(salle.type)).length;
  }, [salles]);

  const previewSalles = salles.slice(0, 6);

  return (
    <div className="space-y-6">      {loading ? <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Chargement...</div> : null}      {errorMessage ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{errorMessage}</div> : null}      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiLayers />
            <span className="text-sm font-medium">Nombre de salles</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{salles.length}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiMapPin />
            <span className="text-sm font-medium">Sites couverts</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{siteCount}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiGrid />
            <span className="text-sm font-medium">Capacite totale</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{totalCapacity}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiSettings />
            <span className="text-sm font-medium">Salles typees</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{typedCount}</p>
        </div>
      </section>

      {mode === "settings" ? null : (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Apercu des salles</h3>
            <p className="text-sm text-slate-500">
              Les premieres salles disponibles pour l'etablissement actif.
            </p>
          </div>

          {previewSalles.length > 0 ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {previewSalles.map((salle) => (
                <article
                  key={salle.id}
                  className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <h4 className="text-base font-semibold text-slate-900">{salle.nom}</h4>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <p className="flex items-center gap-2">
                      <FiMapPin className="shrink-0" />
                      <span>{salle.site?.nom ?? "Site non renseigne"}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <FiGrid className="shrink-0" />
                      <span>Capacite: {salle.capacite ?? "Non renseignee"}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <FiLayers className="shrink-0" />
                      <span>Type: {salle.type || "Non renseigne"}</span>
                    </p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              Aucune salle n'est encore enregistree pour cet etablissement.
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default SallesOverview;


