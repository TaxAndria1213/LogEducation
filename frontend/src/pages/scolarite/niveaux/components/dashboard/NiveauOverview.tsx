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
  const { etablissement_id } = useAuth();
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
    <div className="space-y-6">      {loading ? <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Chargement...</div> : null}      {errorMessage ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{errorMessage}</div> : null}      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

      {mode === "settings" ? null : (
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


