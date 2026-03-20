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
  const { etablissement_id, user } = useAuth();
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
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
              <FiGrid />
              Classes
            </span>
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                {user?.etablissement?.nom ?? "Etablissement"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {mode === "settings"
                  ? "Retrouve ici les reperes utiles pour structurer les classes selon l'annee scolaire, le niveau et le site."
                  : "Accueil du module Classes avec une vue rapide sur les classes ouvertes, les niveaux representes et l'annee active."}
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

      {mode === "settings" ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <FiSettings />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Parametres du module Classes
              </h3>
              <p className="text-sm text-slate-500">
                Une classe bien parametree repose sur une annee scolaire claire, un niveau
                coherent et un site correctement defini.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Structure
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Chaque classe doit s'inscrire dans une annee scolaire et un niveau pour
                garder une lecture simple des inscriptions et des emplois du temps.
              </p>
            </div>

            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Localisation
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Associer les classes aux bons sites facilite ensuite la gestion des salles,
                des affectations et des evenements.
              </p>
            </div>
          </div>
        </section>
      ) : (
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
