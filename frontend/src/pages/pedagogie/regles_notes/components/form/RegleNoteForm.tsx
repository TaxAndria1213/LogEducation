import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FiPercent, FiSettings } from "react-icons/fi";
import Spin from "../../../../../components/anim/Spin";
import { FieldWrapper } from "../../../../../components/Form/fields/FieldWrapper";
import { getInputClassName } from "../../../../../components/Form/fields/inputStyles";
import { useInfo } from "../../../../../hooks/useInfo";
import { useAuth } from "../../../../../hooks/useAuth";
import PedagogieInitialisationService, {
  type PedagogieInitialisationConfigRecord,
} from "../../../../../services/pedagogieInitialisation.service";
import {
  buildNoteRulesSavePayload,
  DEFAULT_NOTE_RULES,
  readPersistedNoteRules,
  type NoteRulesDraft,
} from "../../regleNoteRules";

const schema = z.object({
  moyenne: z.enum(["PONDEREE", "SIMPLE"]),
  arrondi: z.enum(["0.25", "0.5", "1"]),
  absence_non_notee: z.boolean(),
  autoriser_rattrapage: z.boolean(),
  missing_grade_policy: z.enum(["IGNORE", "ZERO", "BLOCK"]),
  ranking_mode: z.enum(["COMPETITION", "DENSE"]),
  exclude_ungraded_from_ranking: z.boolean(),
});

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

  return "Les regles de notes n'ont pas pu etre enregistrees.";
}

function RegleNoteForm() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const [configRecord, setConfigRecord] =
    useState<PedagogieInitialisationConfigRecord | null>(null);
  const [loading, setLoading] = useState(false);

  const defaultValues = useMemo<NoteRulesDraft>(
    () => readPersistedNoteRules(configRecord),
    [configRecord],
  );

  const form = useForm<NoteRulesDraft>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onSubmit",
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!etablissement_id) {
        setConfigRecord(null);
        return;
      }

      setLoading(true);

      try {
        const response = await PedagogieInitialisationService.getConfig(etablissement_id);
        if (!active) return;
        setConfigRecord(
          ((response.data as { config?: PedagogieInitialisationConfigRecord | null })?.config ??
            null) as PedagogieInitialisationConfigRecord | null,
        );
      } catch {
        if (!active) return;
        setConfigRecord(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [etablissement_id]);

  const { control, handleSubmit, formState, watch } = form;
  const currentValues = watch();

  const onSubmit = async (data: NoteRulesDraft) => {
    if (!etablissement_id) {
      info("Aucun etablissement actif n'est defini.", "error");
      return;
    }

    try {
      const payload = buildNoteRulesSavePayload({
        etablissementId: etablissement_id,
        existingConfig: configRecord,
        noteRules: data,
      });

      const response = await PedagogieInitialisationService.saveConfig(payload);
      const nextConfig =
        ((response.data as { config?: PedagogieInitialisationConfigRecord | null })?.config ??
          null) as PedagogieInitialisationConfigRecord | null;

      setConfigRecord(nextConfig);
      info("Regles de notes enregistrees avec succes.", "success");
    } catch (error) {
      info(getErrorMessage(error), "error");
    }
  };

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Chargement de la configuration active...
        </div>
      ) : null}

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
            <FiPercent />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Regles globales de calcul des notes
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Cette configuration s'applique a l'annee scolaire courante. Elle
              complete les types d'evaluation et reste separee des modeles de bulletin.
            </p>
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <FiSettings />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Moteur de calcul</h3>
              <p className="text-sm text-slate-500">
                Definis comment les moyennes sont calculees et comment les cas particuliers sont traites.
              </p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Controller
              control={control}
              name="moyenne"
              render={({ field, fieldState }) => (
                <FieldWrapper
                  id="moyenne"
                  label="Calcul de moyenne"
                  required
                  error={fieldState.error?.message}
                  description="La moyenne ponderee tient compte des poids d'evaluation."
                >
                  <select
                    id="moyenne"
                    value={field.value}
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    className={getInputClassName(Boolean(fieldState.error))}
                  >
                    <option value="PONDEREE">Moyenne ponderee</option>
                    <option value="SIMPLE">Moyenne simple</option>
                  </select>
                </FieldWrapper>
              )}
            />

            <Controller
              control={control}
              name="arrondi"
              render={({ field, fieldState }) => (
                <FieldWrapper
                  id="arrondi"
                  label="Precision d'arrondi"
                  required
                  error={fieldState.error?.message}
                  description="Exemple: 0.25 autorise les moyennes comme 14.25 ou 14.50."
                >
                  <select
                    id="arrondi"
                    value={field.value}
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    className={getInputClassName(Boolean(fieldState.error))}
                  >
                    <option value="0.25">0.25</option>
                    <option value="0.5">0.5</option>
                    <option value="1">1</option>
                  </select>
                </FieldWrapper>
              )}
            />

            <Controller
              control={control}
              name="missing_grade_policy"
              render={({ field, fieldState }) => (
                <FieldWrapper
                  id="missing_grade_policy"
                  label="Gestion des notes manquantes"
                  required
                  error={fieldState.error?.message}
                  description="Choisit le comportement si une evaluation incluse n'a pas encore de note."
                >
                  <select
                    id="missing_grade_policy"
                    value={field.value}
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    className={getInputClassName(Boolean(fieldState.error))}
                  >
                    <option value="IGNORE">Ignorer la note manquante</option>
                    <option value="ZERO">Compter la note manquante comme 0</option>
                    <option value="BLOCK">Bloquer la moyenne tant qu'il manque une note</option>
                  </select>
                </FieldWrapper>
              )}
            />

            <Controller
              control={control}
              name="ranking_mode"
              render={({ field, fieldState }) => (
                <FieldWrapper
                  id="ranking_mode"
                  label="Mode de classement"
                  required
                  error={fieldState.error?.message}
                  description="Competition: 1, 2, 2, 4. Dense: 1, 2, 2, 3."
                >
                  <select
                    id="ranking_mode"
                    value={field.value}
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    className={getInputClassName(Boolean(fieldState.error))}
                  >
                    <option value="COMPETITION">Competition</option>
                    <option value="DENSE">Dense</option>
                  </select>
                </FieldWrapper>
              )}
            />
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Cas particuliers</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Controller
              control={control}
              name="absence_non_notee"
              render={({ field }) => (
                <label className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(field.value)}
                    onChange={(event) => field.onChange(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                  />
                  <span>
                    <span className="block font-semibold text-slate-900">
                      Autoriser l'absence non notee
                    </span>
                    <span className="mt-1 block text-slate-600">
                      Permet de conserver une evaluation sans note effective pour certains eleves.
                    </span>
                  </span>
                </label>
              )}
            />

            <Controller
              control={control}
              name="autoriser_rattrapage"
              render={({ field }) => (
                <label className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(field.value)}
                    onChange={(event) => field.onChange(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                  />
                  <span>
                    <span className="block font-semibold text-slate-900">
                      Autoriser le rattrapage
                    </span>
                    <span className="mt-1 block text-slate-600">
                      Garde un cadre explicite pour les evaluations de remplacement ou de rattrapage.
                    </span>
                  </span>
                </label>
              )}
            />

            <Controller
              control={control}
              name="exclude_ungraded_from_ranking"
              render={({ field }) => (
                <label className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(field.value)}
                    onChange={(event) => field.onChange(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                  />
                  <span>
                    <span className="block font-semibold text-slate-900">
                      Exclure les eleves non classes du rang
                    </span>
                    <span className="mt-1 block text-slate-600">
                      Si des notes sont absentes ou bloquees, l'eleve reste hors classement au lieu d'etre pousse en bas du rang.
                    </span>
                  </span>
                </label>
              )}
            />
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Lecture rapide</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <p>Methode: {currentValues.moyenne === "SIMPLE" ? "Moyenne simple" : "Moyenne ponderee"}</p>
              <p>Arrondi: {currentValues.arrondi ?? DEFAULT_NOTE_RULES.arrondi}</p>
              <p>
                Note manquante: {currentValues.missing_grade_policy === "ZERO"
                  ? "Compte comme 0"
                  : currentValues.missing_grade_policy === "BLOCK"
                    ? "Bloque la moyenne"
                    : "Ignoree"}
              </p>
              <p>
                Classement: {currentValues.ranking_mode === "DENSE" ? "Dense" : "Competition"}
              </p>
              <p>Absence non notee: {currentValues.absence_non_notee ? "Oui" : "Non"}</p>
              <p>Rattrapage: {currentValues.autoriser_rattrapage ? "Autorise" : "Bloque"}</p>
              <p>Eleves non classes exclus: {currentValues.exclude_ungraded_from_ranking ? "Oui" : "Non"}</p>
            </div>
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Positionnement</h3>
            <div className="mt-4 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
              <p>Les types d'evaluation definissent les valeurs par defaut par nature d'evaluation.</p>
              <p className="mt-2">Cette page pilote le calcul global des notes pour l'annee active.</p>
              <p className="mt-2">Les modeles de bulletin pilotent ensuite uniquement l'affichage final.</p>
            </div>
          </article>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={formState.isSubmitting}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {formState.isSubmitting ? <Spin inline /> : null}
            <span>Enregistrer les regles</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default RegleNoteForm;
