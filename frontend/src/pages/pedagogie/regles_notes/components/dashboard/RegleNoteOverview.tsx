import { useEffect, useMemo, useState } from "react";
import {
  FiCheckCircle,
  FiEdit3,
  FiPercent,
  FiSliders,
} from "react-icons/fi";
import { useAuth } from "../../../../../hooks/useAuth";
import PedagogieInitialisationService, {
  type PedagogieInitialisationConfigRecord,
} from "../../../../../services/pedagogieInitialisation.service";
import {
  getNoteRulesSummaryLabel,
  readPersistedNoteRules,
} from "../../regleNoteRules";

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

  return "Impossible de charger les regles de notes.";
}

function RegleNoteOverview({ mode = "overview" }: Props) {
  const { etablissement_id } = useAuth();
  const [config, setConfig] = useState<PedagogieInitialisationConfigRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!etablissement_id) {
        setConfig(null);
        return;
      }

      setLoading(true);
      setErrorMessage("");

      try {
        const response = await PedagogieInitialisationService.getConfig(etablissement_id);
        if (!active) return;
        setConfig(
          ((response.data as { config?: PedagogieInitialisationConfigRecord | null })?.config ??
            null) as PedagogieInitialisationConfigRecord | null,
        );
      } catch (error) {
        if (!active) return;
        setErrorMessage(getErrorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [etablissement_id]);

  const noteRules = useMemo(() => readPersistedNoteRules(config), [config]);

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
            <FiPercent />
            <span className="text-sm font-medium">Calcul</span>
          </div>
          <p className="mt-3 text-lg font-semibold text-slate-900">
            {noteRules.moyenne === "SIMPLE" ? "Moyenne simple" : "Moyenne ponderee"}
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiSliders />
            <span className="text-sm font-medium">Arrondi</span>
          </div>
          <p className="mt-3 text-lg font-semibold text-slate-900">{noteRules.arrondi}</p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiCheckCircle />
            <span className="text-sm font-medium">Absence non notee</span>
          </div>
          <p className="mt-3 text-lg font-semibold text-slate-900">
            {noteRules.absence_non_notee ? "Autorisee" : "Bloquee"}
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-500">
            <FiEdit3 />
            <span className="text-sm font-medium">Notes manquantes</span>
          </div>
          <p className="mt-3 text-lg font-semibold text-slate-900">
            {noteRules.missing_grade_policy === "ZERO"
              ? "Compte comme 0"
              : noteRules.missing_grade_policy === "BLOCK"
                ? "Bloque la moyenne"
                : "Ignoree"}
          </p>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Lecture rapide</h3>
        <p className="mt-2 text-sm text-slate-600">
          {getNoteRulesSummaryLabel(noteRules)}
        </p>

        {mode === "settings" ? (
          <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
            <p>Cette page pilote les regles globales de calcul des notes de l'annee courante.</p>
            <p className="mt-2">
              Les types d'evaluation gerent les valeurs par defaut par nature d'evaluation,
              tandis que cette page gere le moteur de calcul transversal.
            </p>
            <p className="mt-2">
              Les options d'affichage du bulletin restent dans les modeles de bulletin pour
              eviter de melanger calcul et presentation.
            </p>
            <p className="mt-2">
              Le moteur bulletin reprend maintenant aussi la politique de notes manquantes,
              le mode de classement et l'arrondi definis ici.
            </p>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Classement</p>
          <p className="mt-3 text-lg font-semibold text-slate-900">
            {noteRules.ranking_mode === "DENSE" ? "Dense" : "Competition"}
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Rattrapage</p>
          <p className="mt-3 text-lg font-semibold text-slate-900">
            {noteRules.autoriser_rattrapage ? "Autorise" : "Non autorise"}
          </p>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Eleves non classes</p>
          <p className="mt-3 text-lg font-semibold text-slate-900">
            {noteRules.exclude_ungraded_from_ranking ? "Exclus du rang" : "Classes en bas"}
          </p>
        </div>
      </section>
    </div>
  );
}

export default RegleNoteOverview;
