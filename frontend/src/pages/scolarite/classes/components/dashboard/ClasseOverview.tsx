import { useEffect, useMemo, useState } from "react";
import {
  FiGrid,
  FiLayers,
  FiMapPin,
  FiSettings,
  FiUsers,
} from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import AnneeScolaireService from "../../../../../services/anneeScolaire.service";
import ClasseService from "../../../../../services/classe.service";
import type { AnneeScolaire, Classe } from "../../../../../types/models";

type Props = {
  mode?: "overview" | "settings";
};

type ClasseRecord = Classe & {
  annee?: {
    nom?: string | null;
    est_active?: boolean;
  } | null;
  niveau?: {
    nom?: string | null;
  } | null;
  site?: {
    nom?: string | null;
  } | null;
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

  return "Impossible de charger les classes.";
}

function ClasseOverview({ mode = "overview" }: Props) {
  const { etablissement_id } = useAuth();
  const [classes, setClasses] = useState<ClasseRecord[]>([]);
  const [currentYear, setCurrentYear] = useState<AnneeScolaire | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      if (!etablissement_id) {
        setClasses([]);
        setCurrentYear(null);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      try {
        const service = new ClasseService();
        const [classesResult, activeYear] = await Promise.all([
          service.getAll({
            page: 1,
            take: 400,
            includeSpec: JSON.stringify({
              annee: true,
              site: true,
              niveau: true,
            }),
            where: JSON.stringify({ etablissement_id }),
            orderBy: JSON.stringify([{ nom: "asc" }]),
          }),
          AnneeScolaireService.getCurrent(etablissement_id),
        ]);

        if (!active) return;

        setClasses(
          classesResult?.status.success
            ? ((classesResult.data.data as ClasseRecord[]) ?? [])
            : [],
        );
        setCurrentYear((activeYear as AnneeScolaire | null) ?? null);
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

  const classesThisYear = useMemo(
    () => classes.filter((classe) => classe.annee_scolaire_id === currentYear?.id).length,
    [classes, currentYear],
  );
  const representedLevels = useMemo(
    () => new Set(classes.map((classe) => classe.niveau_scolaire_id)).size,
    [classes],
  );
  const coveredSites = useMemo(
    () => new Set(classes.map((classe) => classe.site_id).filter(Boolean)).size,
    [classes],
  );

  return (
    <div className="space-y-6">
      {loading ? <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Chargement...</div> : null}
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiGrid />
            <span className="text-sm font-medium">Nombre de classes</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{classes.length}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiUsers />
            <span className="text-sm font-medium">Classes de l'annee active</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{classesThisYear}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiLayers />
            <span className="text-sm font-medium">Niveaux representes</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {representedLevels}
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiMapPin />
            <span className="text-sm font-medium">Sites couverts</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{coveredSites}</p>
        </div>
      </section>

      {mode === "settings" ? null : (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Apercu des classes</h3>
            <p className="text-sm text-slate-500">
              Les classes actuellement configurees pour l'etablissement actif.
            </p>
          </div>

          {classes.length > 0 ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {classes.slice(0, 6).map((classe) => (
                <article
                  key={classe.id}
                  className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <h4 className="text-base font-semibold text-slate-900">{classe.nom}</h4>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <p>Niveau: {classe.niveau?.nom ?? "Non renseigne"}</p>
                    <p>Site: {classe.site?.nom ?? "Non renseigne"}</p>
                    <p>Annee: {classe.annee?.nom ?? "Non renseignee"}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              Aucune classe n'est encore enregistree pour cet etablissement.
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default ClasseOverview;


