import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FiBookOpen,
  FiCalendar,
  FiCheckCircle,
  FiLayers,
} from "react-icons/fi";
import Spin from "../../../../../components/anim/Spin";
import { FieldWrapper } from "../../../../../components/Form/fields/FieldWrapper";
import { getInputClassName } from "../../../../../components/Form/fields/inputStyles";
import { useInfo } from "../../../../../hooks/useInfo";
import { useAuth } from "../../../../../hooks/useAuth";
import EvaluationService, {
  getEvaluationTypeLabel,
} from "../../../../../services/evaluation.service";
import { getCoursDisplayLabel, getCoursSecondaryLabel } from "../../../../../services/cours.service";
import { useEvaluationCreateStore } from "../../store/EvaluationCreateStore";

type EvaluationFormValues = {
  cours_id: string;
  periode_id: string;
  type: "DEVOIR" | "EXAMEN" | "ORAL" | "AUTRE";
  titre: string;
  date: string;
  note_max: number;
  poids: number | null;
  est_publiee: boolean;
};

const evaluationSchema = z.object({
  cours_id: z.string().min(1, "Le cours est requis."),
  periode_id: z.string().min(1, "La periode est requise."),
  type: z.enum(["DEVOIR", "EXAMEN", "ORAL", "AUTRE"]),
  titre: z
    .string()
    .trim()
    .min(2, "Le titre de l'evaluation est requis.")
    .max(150, "Le titre est trop long.")
    .transform((value) => value.replace(/\s+/g, " ")) ,
  date: z.string().min(1, "La date de l'evaluation est requise."),
  note_max: z.preprocess(
    (value) => Number(value),
    z.number().min(1, "La note maximale doit etre superieure a 0.").max(1000),
  ),
  poids: z.preprocess(
    (value) => {
      if (value === "" || value === null || value === undefined) return null;
      return Number(value);
    },
    z.number().min(0.1, "Le poids doit etre superieur a 0.").max(1000).nullable(),
  ),
  est_publiee: z.boolean(),
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

  return "L'evaluation n'a pas pu etre enregistree.";
}

function formatDateTimeLocal(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function EvaluationForm() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const service = useMemo(() => new EvaluationService(), []);

  const loading = useEvaluationCreateStore((state) => state.loading);
  const errorMessage = useEvaluationCreateStore((state) => state.errorMessage);
  const initialData = useEvaluationCreateStore((state) => state.initialData);
  const cours = useEvaluationCreateStore((state) => state.cours);
  const periodes = useEvaluationCreateStore((state) => state.periodes);
  const getOptions = useEvaluationCreateStore((state) => state.getOptions);

  useEffect(() => {
    if (etablissement_id) {
      void getOptions(etablissement_id);
    }
  }, [etablissement_id, getOptions]);

  const defaultValues = useMemo<EvaluationFormValues>(
    () => ({
      cours_id: initialData?.cours_id ?? "",
      periode_id: initialData?.periode_id ?? "",
      type: (initialData?.type as EvaluationFormValues["type"]) ?? "AUTRE",
      titre: initialData?.titre ?? "",
      date: formatDateTimeLocal(
        initialData?.date instanceof Date
          ? initialData.date
          : initialData?.date
            ? new Date(initialData.date)
            : new Date(),
      ),
      note_max: initialData?.note_max ?? 20,
      poids: initialData?.poids ?? null,
      est_publiee: initialData?.est_publiee ?? false,
    }),
    [initialData],
  );

  const form = useForm<EvaluationFormValues>({
    resolver: zodResolver(evaluationSchema),
    defaultValues,
    mode: "onSubmit",
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const { control, handleSubmit, watch, formState, reset, setError, clearErrors } = form;
  const selectedCoursId = watch("cours_id");
  const selectedPeriodeId = watch("periode_id");
  const selectedDate = watch("date");

  const selectedCours = useMemo(
    () => cours.find((item) => item.id === selectedCoursId) ?? null,
    [cours, selectedCoursId],
  );
  const selectedPeriode = useMemo(
    () => periodes.find((item) => item.id === selectedPeriodeId) ?? null,
    [periodes, selectedPeriodeId],
  );

  const typeOptions = useMemo(
    () => ["DEVOIR", "EXAMEN", "ORAL", "AUTRE"].map((value) => ({
      value,
      label: getEvaluationTypeLabel(value),
    })),
    [],
  );

  const selectedDateObject = useMemo(
    () => (selectedDate ? new Date(selectedDate) : null),
    [selectedDate],
  );

  const isDateOutOfPeriod = useMemo(() => {
    if (!selectedPeriode || !selectedDateObject || Number.isNaN(selectedDateObject.getTime())) {
      return false;
    }

    const start = new Date(selectedPeriode.date_debut);
    const end = new Date(selectedPeriode.date_fin);
    return selectedDateObject < start || selectedDateObject > end;
  }, [selectedDateObject, selectedPeriode]);

  const onSubmit = async (data: EvaluationFormValues) => {
    clearErrors("date");

    if (selectedPeriode && selectedDateObject) {
      const start = new Date(selectedPeriode.date_debut);
      const end = new Date(selectedPeriode.date_fin);
      if (selectedDateObject < start || selectedDateObject > end) {
        setError("date", {
          type: "manual",
          message: "La date doit rester comprise dans la periode selectionnee.",
        });
        return;
      }
    }

    try {
      await service.create({
        ...data,
        date: new Date(data.date),
      });
      info("Evaluation creee avec succes !", "success");
      reset({
        ...defaultValues,
        cours_id: "",
        periode_id: "",
        titre: "",
        date: formatDateTimeLocal(new Date()),
        poids: null,
        est_publiee: false,
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
                    <FiBookOpen />
                    Nouvelle evaluation
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      Preparer une evaluation exploitable jusqu'aux notes
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                      Choisis le bon cours, la bonne periode et les parametres de notation pour garder un flux propre jusqu'aux notes et bulletins.
                    </p>
                  </div>
                </div>
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-800">Reperes rapides</p>
                  <p className="mt-2">{cours.length} cours disponible(s)</p>
                  <p>{periodes.length} periode(s) chargee(s)</p>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <FiLayers />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Cadre pedagogique</h3>
                  <p className="text-sm text-slate-500">
                    Le cours et la periode doivent appartenir a la meme annee scolaire pour que l'evaluation reste coherent.
                  </p>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-[1.2fr_0.8fr]">
                <Controller
                  control={control}
                  name="cours_id"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="cours_id"
                      label="Cours"
                      required
                      error={fieldState.error?.message}
                      description="Le createur de l'evaluation sera derive automatiquement du cours si aucun createur explicite n'est fourni."
                    >
                      <select
                        id="cours_id"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        className={getInputClassName(Boolean(fieldState.error))}
                      >
                        <option value="">Selectionner un cours</option>
                        {cours.map((option) => (
                          <option key={option.id} value={option.id}>
                            {getCoursDisplayLabel(option)}
                          </option>
                        ))}
                      </select>
                    </FieldWrapper>
                  )}
                />

                <Controller
                  control={control}
                  name="periode_id"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="periode_id"
                      label="Periode"
                      required
                      error={fieldState.error?.message}
                      description="La date de l'evaluation devra rester dans les bornes de la periode choisie."
                    >
                      <select
                        id="periode_id"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        className={getInputClassName(Boolean(fieldState.error))}
                      >
                        <option value="">Selectionner une periode</option>
                        {periodes.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.nom}
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
                  <FiCalendar />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Definition de l'evaluation</h3>
                  <p className="text-sm text-slate-500">
                    Renseigne le type, l'intitule, la date et les parametres de notation pour une evaluation exploitable directement dans le suivi. 
                  </p>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-[1.1fr_0.9fr]">
                <Controller
                  control={control}
                  name="titre"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="titre"
                      label="Titre"
                      required
                      error={fieldState.error?.message}
                      description="Exemple: Devoir surveille 1, Examen final ou Oral d'expression."
                      className="md:col-span-2"
                    >
                      <input
                        id="titre"
                        type="text"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        placeholder="Ex: Devoir surveille 1"
                        className={getInputClassName(Boolean(fieldState.error))}
                      />
                    </FieldWrapper>
                  )}
                />

                <Controller
                  control={control}
                  name="type"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="type"
                      label="Type"
                      required
                      error={fieldState.error?.message}
                      description="Le type sert au repere pedagogique et au tri dans le suivi."
                    >
                      <select
                        id="type"
                        value={field.value}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        className={getInputClassName(Boolean(fieldState.error))}
                      >
                        {typeOptions.map((option) => (
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
                  name="date"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="date"
                      label="Date et heure"
                      required
                      error={fieldState.error?.message}
                      description="La date doit tomber dans la periode selectionnee."
                    >
                      <input
                        id="date"
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
                  name="note_max"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="note_max"
                      label="Note maximale"
                      required
                      error={fieldState.error?.message}
                      description="20 par defaut, mais tu peux definir une autre echelle si besoin."
                    >
                      <input
                        id="note_max"
                        type="number"
                        min={1}
                        step="0.5"
                        value={field.value ?? 20}
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
                  name="poids"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="poids"
                      label="Poids"
                      error={fieldState.error?.message}
                      description="Optionnel. Sert de coefficient ou poids dans les calculs selon le module aval."
                    >
                      <input
                        id="poids"
                        type="number"
                        min={0.1}
                        step="0.1"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        placeholder="Ex: 2"
                        className={getInputClassName(Boolean(fieldState.error))}
                      />
                    </FieldWrapper>
                  )}
                />
              </div>

              <Controller
                control={control}
                name="est_publiee"
                render={({ field }) => (
                  <label className="mt-5 flex items-start gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(field.value)}
                      onChange={(event) => field.onChange(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                    />
                    <span>
                      <span className="block font-semibold text-slate-900">Publier immediatement</span>
                      <span className="mt-1 block text-slate-600">
                        Active cette option seulement si l'evaluation peut etre visible sans attendre une validation supplementaire.
                      </span>
                    </span>
                  </label>
                )}
              />

              {isDateOutOfPeriod ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  La date selectionnee est en dehors de la periode choisie. Le back refusera l'enregistrement tant que cette incoherence persiste.
                </div>
              ) : null}
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <FiCheckCircle />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Lecture rapide</h3>
                    <p className="text-sm text-slate-500">
                      Les informations principales de l'evaluation avant validation.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-4 text-sm text-slate-700">
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="font-semibold text-slate-900">
                      {selectedCours ? getCoursDisplayLabel(selectedCours) : "Aucun cours selectionne"}
                    </p>
                    <p className="mt-1 text-slate-600">
                      {selectedCours ? getCoursSecondaryLabel(selectedCours) : "Le contexte du cours apparaitra ici."}
                    </p>
                  </div>

                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="font-semibold text-slate-900">
                      {selectedPeriode?.nom ?? "Aucune periode selectionnee"}
                    </p>
                    <p className="mt-1 text-slate-600">
                      {selectedPeriode
                        ? `Du ${new Intl.DateTimeFormat("fr-FR").format(new Date(selectedPeriode.date_debut))} au ${new Intl.DateTimeFormat("fr-FR").format(new Date(selectedPeriode.date_fin))}`
                        : "Les bornes de la periode apparaitront ici."}
                    </p>
                  </div>
                </div>
              </article>

              <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <FiLayers />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Conseils</h3>
                    <p className="text-sm text-slate-500">
                      Quelques reperes utiles pour une evaluation bien exploitee ensuite.
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
                  <p>La periode doit correspondre a la meme annee scolaire que le cours.</p>
                  <p className="mt-2">Une evaluation avec notes ne pourra plus etre supprimee directement.</p>
                  <p className="mt-2">Le poids est optionnel, mais utile si les calculs de moyenne s'appuient dessus.</p>
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
                <span>Enregistrer l'evaluation</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default EvaluationForm;
