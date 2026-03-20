import { useEffect, useMemo, useState } from "react";
import {
  FiBookOpen,
  FiLayers,
  FiList,
  FiSettings,
  FiTrendingUp,
} from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import NiveauService from "../../../../../services/niveau.service";
import type { NiveauScolaire } from "../../../../../types/models";

type Props = {
  mode?: "overview" | "settings";
};

type NiveauRecord = NiveauScolaire & {
  classes?: Array<{
    id: string;
    nom?: string;
  }>;
  programmes?: Array<{
    id: string;
    titre?: string;
  }>;
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

  return "Impossible de charger les niveaux scolaires.";
}

function NiveauOverview({ mode = "overview" }: Props) {
  const { etablissement_id, user } = useAuth();
  const [niveaux, setNiveaux] = useState<NiveauRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      if (!etablissement_id) {
        setNiveaux([]);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      try {
        const service = new NiveauService();
        const result = await service.getAll({
          page: 1,
          take: 300,
          includeSpec: JSON.stringify({
            classes: true,
            programmes: true,
          }),
          where: JSON.stringify({ etablissement_id }),
          orderBy: JSON.stringify([{ ordre: "asc" }, { nom: "asc" }]),
        });

        if (!active) return;

        setNiveaux(
          result?.status.success ? ((result.data.data as NiveauRecord[]) ?? []) : [],
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

  const usedByClasses = useMemo(
    () => niveaux.filter((niveau) => (niveau.classes?.length ?? 0) > 0).length,
    [niveaux],
  );
  const totalProgrammes = useMemo(
    () =>
      niveaux.reduce((count, niveau) => count + (niveau.programmes?.length ?? 0), 0),
    [niveaux],
  );
  const nextOrder = useMemo(() => {
    if (niveaux.length === 0) return 1;

    const maxOrder = niveaux.reduce((highest, niveau) => {
      return Math.max(highest, niveau.ordre ?? 0);
    }, 0);

    return maxOrder + 1;
  }, [niveaux]);

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
              <FiLayers />
              Niveaux scolaires
            </span>
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                {user?.etablissement?.nom ?? "Etablissement"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {mode === "settings"
                  ? "Retrouve ici les reperes utiles pour organiser les niveaux de l'etablissement et garder une structure coherente."
                  : "Accueil du module Niveaux avec une lecture rapide des niveaux disponibles, de leur ordre et de leur usage."}
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
            <span className="text-sm font-medium">Nombre de niveaux</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{niveaux.length}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiTrendingUp />
            <span className="text-sm font-medium">Prochain ordre</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{nextOrder}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiList />
            <span className="text-sm font-medium">Niveaux utilises</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{usedByClasses}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiBookOpen />
            <span className="text-sm font-medium">Programmes rattaches</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{totalProgrammes}</p>
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
                Parametres du module Niveaux
              </h3>
              <p className="text-sm text-slate-500">
                Un bon ordonnancement des niveaux facilite ensuite la gestion des classes
                et des programmes.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Organisation
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Garde un ordre progressif entre les niveaux pour simplifier la lecture
                des classes, des inscriptions et des parcours.
              </p>
            </div>

            <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Cohérence pedagogique
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-700">
                Rattacher les programmes aux bons niveaux evite les decalages entre la
                structure scolaire et le contenu enseigne.
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Apercu des niveaux</h3>
            <p className="text-sm text-slate-500">
              Les niveaux actuellement disponibles pour l'etablissement actif.
            </p>
          </div>

          {niveaux.length > 0 ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {niveaux.slice(0, 6).map((niveau) => (
                <article
                  key={niveau.id}
                  className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-base font-semibold text-slate-900">{niveau.nom}</h4>
                    <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                      Ordre {niveau.ordre ?? "-"}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <p>{niveau.classes?.length ?? 0} classe(s) rattachee(s)</p>
                    <p>{niveau.programmes?.length ?? 0} programme(s) rattache(s)</p>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              Aucun niveau n'est encore enregistre pour cet etablissement.
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export default NiveauOverview;
