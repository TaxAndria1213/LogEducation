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
import AssessmentResultService from "../../../../../services/assessmentResult.service";
import NoteService, {
  getEleveDisplayLabel,
  getNotePercentage,
} from "../../../../../services/note.service";
import { useNoteCreateStore } from "../../store/NoteCreateStore";

type NoteFormValues = {
  evaluation_id: string;
  eleve_id: string;
  score: number | null;
  status: string;
  scale_level_id: string | null;
  text_value: string;
  commentaire: string;
  note_le: string;
};

const noteSchema = z.object({
  evaluation_id: z.string().min(1, "L'evaluation est requise."),
  eleve_id: z.string().min(1, "L'eleve est requis."),
  score: z.preprocess(
    (value) => {
      if (value === "" || value === null || value === undefined) return null;
      return Number(value);
    },
    z.number().min(0, "Le score doit etre positif ou nul.").max(1000).nullable(),
  ),
  status: z.string().min(1, "Le statut est requis."),
  scale_level_id: z.string().trim().min(1).nullable(),
  text_value: z.string().max(1000, "La valeur descriptive est trop longue."),
  commentaire: z.string().max(500, "Le commentaire est trop long.").optional().or(z.literal("")),
  note_le: z.string().min(1, "La date de notation est requise."),
});

const RESULT_STATUS_OPTIONS = [
  { value: "GRADED", label: "Note" },
  { value: "NOT_EVALUATED", label: "Non evalue" },
  { value: "JUSTIFIED_ABSENCE", label: "Absence justifiee" },
  { value: "UNJUSTIFIED_ABSENCE", label: "Absence non justifiee" },
  { value: "EXEMPTED", label: "Dispense" },
  { value: "NOT_SUBMITTED", label: "Non rendu" },
];

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
  const assessmentResultService = useMemo(() => new AssessmentResultService(), []);
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
      score: initialData?.score ?? null,
      status: "GRADED",
      scale_level_id: null,
      text_value: "",
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
  const status = watch("status");
  const scaleLevelId = watch("scale_level_id");
  const textValue = watch("text_value");

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
    if ((selectedEvaluation.gradingScale?.grading_type ?? "POINTS") !== "POINTS") return null;
    return getNotePercentage({
      score,
      evaluation: selectedEvaluation,
    });
  }, [score, selectedEvaluation]);

  const gradingType = selectedEvaluation?.gradingScale?.grading_type ?? "POINTS";
  const gradingLevels = selectedEvaluation?.gradingScale?.levels ?? [];
  const isEvaluationLocked =
    selectedEvaluation?.status === "VALIDATED" ||
    selectedEvaluation?.status === "LOCKED" ||
    selectedEvaluation?.status === "ARCHIVED";

  useEffect(() => {
    if (selectedEleveId && selectedEvaluation && !eligibleEleveIds.has(selectedEleveId)) {
      form.setValue("eleve_id", "", { shouldValidate: true });
    }
  }, [eligibleEleveIds, form, selectedEleveId, selectedEvaluation]);

  useEffect(() => {
    if (!selectedEvaluation) return;

    const currentType = selectedEvaluation.gradingScale?.grading_type ?? "POINTS";
    if (currentType === "POINTS" || currentType === "PERCENTAGE") {
      form.setValue("scale_level_id", null, { shouldDirty: true });
      form.setValue("text_value", "", { shouldDirty: true });
      return;
    }

    if (currentType === "DESCRIPTIVE") {
      form.setValue("score", null, { shouldDirty: true });
      form.setValue("scale_level_id", null, { shouldDirty: true });
      return;
    }

    form.setValue("score", null, { shouldDirty: true });
    form.setValue("text_value", "", { shouldDirty: true });
  }, [form, selectedEvaluationId]);

  const onSubmit = async (data: NoteFormValues) => {
    clearErrors("score");
    clearErrors("eleve_id");
    clearErrors("scale_level_id");
    clearErrors("text_value");

    if (
      selectedEvaluation &&
      typeof data.score === "number" &&
      data.score > selectedEvaluation.note_max
    ) {
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
      if (isEvaluationLocked) {
        info(
          "Cette evaluation est deja validee ou verrouillee et ne peut plus recevoir de nouveaux resultats.",
          "error",
        );
        return;
      }

      const currentGradingType = selectedEvaluation?.gradingScale?.grading_type ?? "POINTS";

      if (currentGradingType === "POINTS" || currentGradingType === "PERCENTAGE") {
        if (data.status === "GRADED" && typeof data.score !== "number") {
          setError("score", {
            type: "manual",
            message: "Le score est requis pour cette evaluation.",
          });
          return;
        }
      } else if (currentGradingType === "DESCRIPTIVE") {
        if (data.status === "GRADED" && !data.text_value.trim()) {
          setError("text_value", {
            type: "manual",
            message: "Une valeur descriptive est requise pour cette evaluation.",
          });
          return;
        }
      } else if (data.status === "GRADED" && !data.scale_level_id) {
        setError("scale_level_id", {
          type: "manual",
          message: "Un niveau de notation est requis pour cette evaluation.",
        });
        return;
      }

      await assessmentResultService.create({
        assessment_id: data.evaluation_id,
        student_id: data.eleve_id,
        raw_score: data.status === "GRADED" ? data.score : null,
        scale_level_id: data.status === "GRADED" ? data.scale_level_id : null,
        text_value: data.status === "GRADED" ? data.text_value.trim() || null : null,
        status: data.status as
          | "GRADED"
          | "JUSTIFIED_ABSENCE"
          | "UNJUSTIFIED_ABSENCE"
          | "EXEMPTED"
          | "NOT_SUBMITTED"
          | "NOT_EVALUATED",
        observation: data.commentaire.trim() || null,
        validated_at: new Date(data.note_le),
      });
      info("Resultat enregistre avec succes !", "success");
      reset({
        ...defaultValues,
        evaluation_id: "",
        eleve_id: "",
        score: null,
        status: "GRADED",
        scale_level_id: null,
        text_value: "",
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

          {isEvaluationLocked ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              Cette evaluation est deja validee ou verrouillee. La saisie standard des resultats est desactivee.
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
                  name="status"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="status"
                      label="Statut"
                      required
                      error={fieldState.error?.message}
                      description="Permet de distinguer une note saisie d'une absence, dispense ou copie non rendue."
                    >
                      <select
                        id="status"
                        value={field.value ?? "GRADED"}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        disabled={isEvaluationLocked}
                        className={getInputClassName(Boolean(fieldState.error))}
                      >
                        {RESULT_STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </FieldWrapper>
                  )}
                />

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
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        disabled={
                          isEvaluationLocked ||
                          status !== "GRADED" ||
                          (gradingType !== "POINTS" && gradingType !== "PERCENTAGE")
                        }
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
                        disabled={isEvaluationLocked}
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
                        disabled={isEvaluationLocked}
                        placeholder="Observation, encouragement, axe de progression..."
                        className={getInputClassName(Boolean(fieldState.error))}
                      />
                    </FieldWrapper>
                  )}
                />
              </div>

              {(gradingType === "LETTER" ||
                gradingType === "LEVEL" ||
                gradingType === "VALIDATION") && status === "GRADED" ? (
                <div className="mt-5">
                  <Controller
                    control={control}
                    name="scale_level_id"
                    render={({ field, fieldState }) => (
                      <FieldWrapper
                        id="scale_level_id"
                        label="Niveau de notation"
                        required
                        error={fieldState.error?.message}
                        description="Choisis la lettre, le niveau ou l'etat de validation correspondant."
                      >
                        <select
                          id="scale_level_id"
                          value={field.value ?? ""}
                          onChange={(event) =>
                            field.onChange(event.target.value ? event.target.value : null)
                          }
                          onBlur={field.onBlur}
                          ref={field.ref}
                          disabled={isEvaluationLocked}
                          className={getInputClassName(Boolean(fieldState.error))}
                        >
                          <option value="">Selectionner un niveau</option>
                          {gradingLevels.map((level) => (
                            <option key={level.id} value={level.id}>
                              {level.code} - {level.label}
                            </option>
                          ))}
                        </select>
                      </FieldWrapper>
                    )}
                  />
                </div>
              ) : null}

              {gradingType === "DESCRIPTIVE" && status === "GRADED" ? (
                <div className="mt-5">
                  <Controller
                    control={control}
                    name="text_value"
                    render={({ field, fieldState }) => (
                      <FieldWrapper
                        id="text_value"
                        label="Resultat descriptif"
                        required
                        error={fieldState.error?.message}
                        description="Saisis ici la valeur affichable sur le bulletin quand l'evaluation est descriptive."
                      >
                        <textarea
                          id="text_value"
                          value={field.value ?? ""}
                          onChange={(event) => field.onChange(event.target.value)}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          rows={3}
                          disabled={isEvaluationLocked}
                          placeholder="Lecture correcte mais manque de fluidite..."
                          className={getInputClassName(Boolean(fieldState.error))}
                        />
                      </FieldWrapper>
                    )}
                  />
                </div>
              ) : null}
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
                  <p>Type de notation: {gradingType}</p>
                  <p className="mt-2">Statut: {status}</p>
                  <p className="mt-2">Score saisi: {score ?? "Non renseigne"}</p>
                  <p className="mt-2">Niveau choisi: {scaleLevelId ?? "Non renseigne"}</p>
                  <p className="mt-2">Texte descriptif: {textValue.trim() || "Non renseigne"}</p>
                  <p className="mt-2">Note max: {selectedEvaluation?.note_max ?? "Non renseignee"}</p>
                  <p className="mt-2">Pourcentage: {scorePercent !== null ? `${scorePercent}%` : "Non calcule"}</p>
                  <p className="mt-2">Commentaire: {watch("commentaire")?.trim() ? "Oui" : "Non"}</p>
                </div>
              </article>
            </section>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={formState.isSubmitting || isEvaluationLocked}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {formState.isSubmitting ? <Spin inline /> : null}
                <span>{isEvaluationLocked ? "Evaluation verrouillee" : "Enregistrer la note"}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default NoteForm;
