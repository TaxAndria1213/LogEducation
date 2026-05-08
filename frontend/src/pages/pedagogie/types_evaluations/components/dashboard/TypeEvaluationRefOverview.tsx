import { useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiEye, FiLayers, FiTarget } from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import TypeEvaluationRefService, {
  type TypeEvaluationRefWithRelations,
} from "../../../../../services/typeEvaluationRef.service";

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

  return "Impossible de charger les types d'evaluation.";
}

function TypeEvaluationRefOverview({ mode = "overview" }: Props) {
  const { etablissement_id } = useAuth();
  const [items, setItems] = useState<TypeEvaluationRefWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!etablissement_id) {
        setItems([]);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      try {
        const service = new TypeEvaluationRefService();
        const result = await service.getForEtablissement(etablissement_id, {
          page: 1,
          take: 100,
        });

        if (!active) return;
        setItems(
          result?.status.success
            ? ((result.data.data as TypeEvaluationRefWithRelations[]) ?? [])
            : [],
        );
      } catch (error) {
        if (!active) return;
        setErrorMessage(getErrorMessage(error));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [etablissement_id]);

  const activeItems = useMemo(() => items.filter((item) => item.is_active).length, [items]);
  const includedInAverage = useMemo(
    () => items.filter((item) => item.include_in_average).length,
    [items],
  );
  const visibleInReport = useMemo(
    () => items.filter((item) => item.show_in_report_card).length,
    [items],
  );
  const finalExamTypes = useMemo(
    () => items.filter((item) => item.is_final_exam).length,
    [items],
  );

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Chargement...
        </div>
      ) : null}
      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiLayers />
            <span className="text-sm font-medium">Types configures</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{items.length}</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiCheckCircle />
            <span className="text-sm font-medium">Actifs</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{activeItems}</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiTarget />
            <span className="text-sm font-medium">Inclus moyenne</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{includedInAverage}</p>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiEye />
            <span className="text-sm font-medium">Visibles bulletin</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{visibleInReport}</p>
        </div>
      </section>

      {mode === "settings" ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Ce que pilote cet ecran</h3>
          <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
            <p>Les types d'evaluation servent de base reutilisable pour les enseignants.</p>
            <p className="mt-2">
              Tu definis ici les valeurs par defaut de notation, la participation a la
              moyenne et la visibilite potentielle dans les bulletins.
            </p>
            <p className="mt-2">
              Les regles restent ajustables evaluation par evaluation si un cas particulier
              l'exige.
            </p>
            <p className="mt-2">{finalExamTypes} type(s) sont actuellement marques comme examen final.</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default TypeEvaluationRefOverview;
