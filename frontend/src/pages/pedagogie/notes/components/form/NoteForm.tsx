import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FiBarChart2,
  FiBookOpen,
  FiCheckCircle,
  FiUsers,
} from "react-icons/fi";
import Spin from "../../../../../components/anim/Spin";
import { FieldWrapper } from "../../../../../components/Form/fields/FieldWrapper";
import { getInputClassName } from "../../../../../components/Form/fields/inputStyles";
import { useInfo } from "../../../../../hooks/useInfo";
import { useAuth } from "../../../../../hooks/useAuth";
import {
  getEvaluationDisplayLabel,
  getEvaluationSecondaryLabel,
} from "../../../../../services/evaluation.service";
import NoteService, {
  getEleveDisplayLabel,
  getNotePercentage,
} from "../../../../../services/note.service";
import { useNoteCreateStore } from "../../store/NoteCreateStore";

type NoteFormValues = {
  evaluation_id: string;
  eleve_id: string;
  score: number;
  commentaire: string;
  note_le: string;
};

const noteSchema = z.object({
  evaluation_id: z.string().min(1, "L'evaluation est requise."),
  eleve_id: z.string().min(1, "L'eleve est requis."),
  score: z.preprocess(
    (value) => Number(value),
    z.number().min(0, "Le score doit etre positif ou nul.").max(1000),
  ),
  commentaire: z.string().max(500, "Le commentaire est trop long.").optional().or(z.literal("")),
  note_le: z.string().min(1, "La date de notation est requise."),
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

  return "La note n'a pas pu etre enregistree.";
}

function formatDateTimeLocal(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function NoteForm() {
  const service = useMemo(() => new NoteService(), []);
  const { etablissement_id } = useAuth();
  const { info } = useInfo();

  const loading = useNoteCreateStore((state) => state.loading);
  const errorMessage = useNoteCreateStore((state) => state.errorMessage);
  const initialData = useNoteCreateStore((state) => state.initialData);
  const evaluations = useNoteCreateStore((state) => state.evaluations);
  const eleves = useNoteCreateStore((state) => state.eleves);
  const getOptions = useNoteCreateStore((state) => state.getOptions);

  useEffect(() => {
    if (etablissement_id) {
      void getOptions(etablissement_id);
    }
  }, [etablissement_id, getOptions]);

  const defaultValues = useMemo<NoteFormValues>(
    () => ({
      evaluation_id: initialData?.evaluation_id ?? "",
      eleve_id: initialData?.eleve_id ?? "",
      score: initialData?.score ?? 0,
      commentaire: initialData?.commentaire ?? "",
      note_le: formatDateTimeLocal(
        initialData?.note_le instanceof Date
          ? initialData.note_le
          : initialData?.note_le
            ? new Date(initialData.note_le)
            : new Date(),
      ),
    }),
    [initialData],
  );

  const form = useForm<NoteFormValues>({
    resolver: zodResolver(noteSchema),
    defaultValues,
    mode: "onSubmit",
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const { control, handleSubmit, watch, formState, reset, setError, clearErrors } = form;
  const selectedEvaluationId = watch("evaluation_id");
  const selectedEleveId = watch("eleve_id");
  const score = watch("score");

  const selectedEvaluation = useMemo(
    () => evaluations.find((item) => item.id === selectedEvaluationId) ?? null,
    [evaluations, selectedEvaluationId],
  );
  const selectedEleve = useMemo(
    () => eleves.find((item) => item.id === selectedEleveId) ?? null,
    [eleves, selectedEleveId],
  );

  const eligibleEleves = useMemo(() => {
    if (!selectedEvaluation) return [];

    const classeId = selectedEvaluation.cours?.classe_id;
    const anneeId = selectedEvaluation.cours?.annee_scolaire_id;

    if (!classeId || !anneeId) return [];

    return eleves.filter((eleve) =>
      eleve.inscriptions?.some(
        (inscription) =>
          inscription.classe_id === classeId &&
          inscription.annee_scolaire_id === anneeId,
      ),
    );
  }, [eleves, selectedEvaluation]);

  const eligibleEleveIds = useMemo(
    () => new Set(eligibleEleves.map((item) => item.id)),
    [eligibleEleves],
  );

  const scorePercent = useMemo(() => {
    if (!selectedEvaluation) return null;
    return getNotePercentage({
      score,
      evaluation: selectedEvaluation,
    });
  }, [score, selectedEvaluation]);

  useEffect(() => {
    if (selectedEleveId && selectedEvaluation && !eligibleEleveIds.has(selectedEleveId)) {
      form.setValue("eleve_id", "", { shouldValidate: true });
    }
  }, [eligibleEleveIds, form, selectedEleveId, selectedEvaluation]);

  const onSubmit = async (data: NoteFormValues) => {
    clearErrors("score");
    clearErrors("eleve_id");

    if (selectedEvaluation && data.score > selectedEvaluation.note_max) {
      setError("score", {
        type: "manual",
        message: `Le score ne peut pas depasser ${selectedEvaluation.note_max}.`,
      });
      return;
    }

    if (selectedEvaluation && !eligibleEleveIds.has(data.eleve_id)) {
      setError("eleve_id", {
        type: "manual",
        message:
          "L'eleve selectionne n'est pas inscrit dans la classe de cette evaluation.",
      });
      return;
    }

    try {
      await service.create({
        ...data,
        commentaire: data.commentaire.trim() || null,
        note_le: new Date(data.note_le),
      });
      info("Note creee avec succes !", "success");
      reset({
        ...defaultValues,
        evaluation_id: "",
        eleve_id: "",
        score: 0,
        commentaire: "",
        note_le: formatDateTimeLocal(new Date()),
      });
    } catch (error: unknown) {
      info(getErrorMessage(error), "error");
    }
  };

  return (
    <div className="w-[100%]">
      {loading ? (
        <Spin label="Chargement des ressources..." showLabel />
      ) : (
        <div className="space-y-5">
          {errorMessage ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {errorMessage}
            </div>
          ) : null}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
                    <FiBarChart2 />
                    Nouvelle note
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      Saisir une note directement exploitable
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                      Choisis d'abord l'evaluation, puis l'eleve reellement inscrit dans la classe concernee. Le score sera verifie par rapport a la note maximale.
                    </p>
                  </div>
                </div>
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-800">Reperes rapides</p>
                  <p className="mt-2">{evaluations.length} evaluation(s) disponible(s)</p>
                  <p>{eleves.length} eleve(s) charge(s)</p>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <FiBookOpen />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Contexte d'evaluation</h3>
                  <p className="text-sm text-slate-500">
                    L'eleve ne devient selectable qu'une fois l'evaluation choisie, avec filtrage sur les inscriptions de la bonne classe et de la bonne annee.
                  </p>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Controller
                  control={control}
                  name="evaluation_id"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="evaluation_id"
                      label="Evaluation"
                      required
                      error={fieldState.error?.message}
                      description="La note sera rattachee a cette evaluation et heritera de sa note maximale."
                    >
                      <select
                        id="evaluation_id"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        className={getInputClassName(Boolean(fieldState.error))}
                      >
                        <option value="">Selectionner une evaluation</option>
                        {evaluations.map((evaluation) => (
                          <option key={evaluation.id} value={evaluation.id}>
                            {getEvaluationDisplayLabel(evaluation)}
                          </option>
                        ))}
                      </select>
                    </FieldWrapper>
                  )}
                />

                <Controller
                  control={control}
                  name="eleve_id"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="eleve_id"
                      label="Eleve"
                      required
                      error={fieldState.error?.message}
                      description="Seuls les eleves inscrits dans la classe de l'evaluation sont proposes."
                    >
                      <select
                        id="eleve_id"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        disabled={!selectedEvaluation}
                        className={getInputClassName(Boolean(fieldState.error))}
                      >
                        <option value="">Selectionner un eleve</option>
                        {eligibleEleves.map((eleve) => (
                          <option key={eleve.id} value={eleve.id}>
                            {getEleveDisplayLabel(eleve)}
                          </option>
                        ))}
                      </select>
                    </FieldWrapper>
                  )}
                />
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <FiCheckCircle />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Saisie de la note</h3>
                  <p className="text-sm text-slate-500">
                    Le score est controle par rapport a la note maximale de l'evaluation et peut etre complete par un commentaire.
                  </p>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-[0.8fr_0.8fr_1.4fr]">
                <Controller
                  control={control}
                  name="score"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="score"
                      label="Score"
                      required
                      error={fieldState.error?.message}
                      description={
                        selectedEvaluation
                          ? `Maximum autorise: ${selectedEvaluation.note_max}`
                          : "Choisis d'abord une evaluation pour voir la borne de notation."
                      }
                    >
                      <input
                        id="score"
                        type="number"
                        min={0}
                        step="0.1"
                        value={field.value ?? 0}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        className={getInputClassName(Boolean(fieldState.error))}
                      />
                    </FieldWrapper>
                  )}
                />

                <Controller
                  control={control}
                  name="note_le"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="note_le"
                      label="Notee le"
                      required
                      error={fieldState.error?.message}
                      description="Date et heure de saisie ou de validation de la note."
                    >
                      <input
                        id="note_le"
                        type="datetime-local"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        className={getInputClassName(Boolean(fieldState.error))}
                      />
                    </FieldWrapper>
                  )}
                />

                <Controller
                  control={control}
                  name="commentaire"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="commentaire"
                      label="Commentaire"
                      error={fieldState.error?.message}
                      description="Optionnel. Utile pour ajouter un retour qualitatif ou une precision sur la copie."
                    >
                      <textarea
                        id="commentaire"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        rows={4}
                        placeholder="Observation, encouragement, axe de progression..."
                        className={getInputClassName(Boolean(fieldState.error))}
                      />
                    </FieldWrapper>
                  )}
                />
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <FiUsers />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Lecture rapide</h3>
                    <p className="text-sm text-slate-500">
                      Le contexte complet de la note avant enregistrement.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-4 text-sm text-slate-700">
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="font-semibold text-slate-900">
                      {selectedEvaluation ? getEvaluationDisplayLabel(selectedEvaluation) : "Aucune evaluation selectionnee"}
                    </p>
                    <p className="mt-1 text-slate-600">
                      {selectedEvaluation ? getEvaluationSecondaryLabel(selectedEvaluation) : "Le contexte de l'evaluation apparaitra ici."}
                    </p>
                  </div>

                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="font-semibold text-slate-900">
                      {selectedEleve ? getEleveDisplayLabel(selectedEleve) : "Aucun eleve selectionne"}
                    </p>
                    <p className="mt-1 text-slate-600">
                      {selectedEvaluation ? `${eligibleEleves.length} eleve(s) eligible(s) pour cette evaluation.` : "Choisis une evaluation pour afficher les eleves eligibles."}
                    </p>
                  </div>
                </div>
              </article>

              <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <FiBarChart2 />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Apercu du score</h3>
                    <p className="text-sm text-slate-500">
                      Un repere rapide sur la notation en cours de saisie.
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  <p>Score saisi: {score ?? 0}</p>
                  <p className="mt-2">Note max: {selectedEvaluation?.note_max ?? "Non renseignee"}</p>
                  <p className="mt-2">Pourcentage: {scorePercent !== null ? `${scorePercent}%` : "Non calcule"}</p>
                  <p className="mt-2">Commentaire: {watch("commentaire")?.trim() ? "Oui" : "Non"}</p>
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
                <span>Enregistrer la note</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default NoteForm;
