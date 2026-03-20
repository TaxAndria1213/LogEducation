import { useEffect, useMemo } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FiBookOpen, FiPlus, FiTrash2 } from "react-icons/fi";
import ProgrammeService from "../../../../../services/programme.service";
import { useAuth } from "../../../../../auth/AuthContext";
import { useProgrammeCreateStore } from "../../store/ProgrammeCreateStore";
import Spin from "../../../../../components/anim/Spin";
import { useInfo } from "../../../../../hooks/useInfo";
import { FieldWrapper } from "../../../../../components/Form/fields/FieldWrapper";
import { getInputClassName } from "../../../../../components/Form/fields/inputStyles";

type ProgrammeLineForm = {
  matiere_id: string;
  heures_semaine: number | null;
  coefficient: number | null;
};

type ProgrammeFormValues = {
  etablissement_id: string;
  annee_scolaire_id: string;
  niveau_scolaire_id: string;
  nom: string;
  matieres: ProgrammeLineForm[];
};

const emptyLine: ProgrammeLineForm = {
  matiere_id: "",
  heures_semaine: null,
  coefficient: null,
};

const lineSchema = z.object({
  matiere_id: z.string().min(1, "La matiere est requise."),
  heures_semaine: z.preprocess(
    (value) => {
      if (value === "" || value === undefined || value === null) return null;
      return Number(value);
    },
    z
      .number()
      .int("Le volume horaire doit etre un entier.")
      .min(0, "Le volume horaire doit etre positif.")
      .max(80, "Le volume horaire semble trop eleve.")
      .nullable(),
  ),
  coefficient: z.preprocess(
    (value) => {
      if (value === "" || value === undefined || value === null) return null;
      return Number(value);
    },
    z
      .number()
      .min(0, "Le coefficient doit etre positif.")
      .max(100, "Le coefficient semble trop eleve.")
      .nullable(),
  ),
});

const programmeSchema = z
  .object({
    etablissement_id: z.string().min(1, "L'etablissement est requis."),
    annee_scolaire_id: z.string().min(1, "L'annee scolaire est requise."),
    niveau_scolaire_id: z.string().min(1, "Le niveau scolaire est requis."),
    nom: z
      .string()
      .trim()
      .min(2, "Le nom du programme est requis.")
      .max(120, "Le nom du programme est trop long.")
      .transform((value) => value.replace(/\s+/g, " ")),
    matieres: z.array(lineSchema).min(1, "Ajoute au moins une matiere au programme."),
  })
  .superRefine((value, ctx) => {
    const ids = value.matieres.map((item) => item.matiere_id).filter(Boolean);
    if (new Set(ids).size !== ids.length) {
      value.matieres.forEach((item, index) => {
        if (!item.matiere_id) return;
        if (ids.filter((id) => id === item.matiere_id).length > 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Cette matiere est deja presente dans le programme.",
            path: ["matieres", index, "matiere_id"],
          });
        }
      });
    }
  });

function ProgrammeForm() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const service = useMemo(() => new ProgrammeService(), []);

  const loading = useProgrammeCreateStore((state) => state.loading);
  const errorMessage = useProgrammeCreateStore((state) => state.errorMessage);
  const initialData = useProgrammeCreateStore((state) => state.initialData);
  const anneeScolaireOptions = useProgrammeCreateStore(
    (state) => state.anneeScolaireOptions,
  );
  const niveauOptions = useProgrammeCreateStore((state) => state.niveauOptions);
  const matiereOptions = useProgrammeCreateStore((state) => state.matiereOptions);
  const getOptions = useProgrammeCreateStore((state) => state.getOptions);

  useEffect(() => {
    if (etablissement_id) {
      void getOptions(etablissement_id);
    }
  }, [etablissement_id, getOptions]);

  const defaultValues = useMemo<ProgrammeFormValues>(
    () => ({
      etablissement_id: initialData?.etablissement_id ?? etablissement_id ?? "",
      annee_scolaire_id: initialData?.annee_scolaire_id ?? "",
      niveau_scolaire_id: initialData?.niveau_scolaire_id ?? "",
      nom: initialData?.nom ?? "",
      matieres:
        initialData?.matieres && initialData.matieres.length > 0
          ? initialData.matieres.map((line) => ({
              matiere_id: line.matiere_id ?? "",
              heures_semaine: line.heures_semaine ?? null,
              coefficient: line.coefficient ?? null,
            }))
          : [emptyLine],
    }),
    [etablissement_id, initialData],
  );

  const form = useForm<ProgrammeFormValues>({
    resolver: zodResolver(programmeSchema),
    defaultValues,
    mode: "onSubmit",
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const { control, handleSubmit, formState, watch, reset } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "matieres",
  });

  const lines = watch("matieres");

  const onSubmit = async (data: ProgrammeFormValues) => {
    try {
      await service.create(data);
      info("Programme cree avec succes !", "success");
      reset({
        ...defaultValues,
        nom: "",
        matieres: [emptyLine],
      });
    } catch (error) {
      console.log(error);
      info("Programme non cree.", "error");
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
              <div className="mb-5 space-y-2">
                <h3 className="text-lg font-semibold text-slate-900">
                  Nouveau programme
                </h3>
                <p className="text-sm leading-6 text-slate-500">
                  Definis le cadre du programme puis compose sa liste de matieres,
                  avec le volume horaire et le coefficient quand ils sont connus.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Controller
                  control={control}
                  name="nom"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="nom"
                      label="Nom du programme"
                      required
                      error={fieldState.error?.message}
                      className="md:col-span-2"
                      description="Exemple: Programme fondamental, Programme scientifique ou Tronc commun."
                    >
                      <input
                        id="nom"
                        type="text"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        placeholder="Ex: Programme du college"
                        className={getInputClassName(Boolean(fieldState.error))}
                      />
                    </FieldWrapper>
                  )}
                />

                <Controller
                  control={control}
                  name="annee_scolaire_id"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="annee_scolaire_id"
                      label="Annee scolaire"
                      required
                      error={fieldState.error?.message}
                      description="L'annee active est preselectionnee quand elle existe."
                    >
                      <select
                        id="annee_scolaire_id"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        className={getInputClassName(Boolean(fieldState.error))}
                      >
                        <option value="">Selectionner une annee</option>
                        {anneeScolaireOptions.map((option) => (
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
                  name="niveau_scolaire_id"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="niveau_scolaire_id"
                      label="Niveau scolaire"
                      required
                      error={fieldState.error?.message}
                      description="Le niveau aide a structurer ensuite les classes, cours et evaluations."
                    >
                      <select
                        id="niveau_scolaire_id"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        className={getInputClassName(Boolean(fieldState.error))}
                      >
                        <option value="">Selectionner un niveau</option>
                        {niveauOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </FieldWrapper>
                  )}
                />
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Matieres du programme
                  </h3>
                  <p className="text-sm text-slate-500">
                    Ajoute les matieres qui composent ce programme et precise les informations utiles.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => append({ ...emptyLine })}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <FiPlus />
                  Ajouter une matiere
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {fields.map((item, index) => {
                  const selectedIds = lines
                    ?.map((line, lineIndex) => (lineIndex === index ? null : line?.matiere_id))
                    .filter((value): value is string => Boolean(value));
                  const lineError = formState.errors.matieres?.[index];

                  return (
                    <article
                      key={item.id}
                      className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                          <FiBookOpen />
                          Matiere {index + 1}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (fields.length === 1) {
                              form.setValue("matieres.0", { ...emptyLine });
                              return;
                            }
                            remove(index);
                          }}
                          className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50"
                        >
                          <FiTrash2 />
                          Retirer
                        </button>
                      </div>

                      <div className="grid gap-4 md:grid-cols-[1.5fr_0.7fr_0.7fr]">
                        <Controller
                          control={control}
                          name={`matieres.${index}.matiere_id`}
                          render={({ field, fieldState }) => (
                            <FieldWrapper
                              id={`matieres.${index}.matiere_id`}
                              label="Matiere"
                              required
                              error={fieldState.error?.message}
                              description="Chaque matiere ne peut apparaitre qu'une seule fois dans le programme."
                            >
                              <select
                                id={`matieres.${index}.matiere_id`}
                                value={field.value ?? ""}
                                onChange={(event) => field.onChange(event.target.value)}
                                onBlur={field.onBlur}
                                ref={field.ref}
                                className={getInputClassName(Boolean(fieldState.error))}
                              >
                                <option value="">Selectionner une matiere</option>
                                {matiereOptions.map((option) => (
                                  <option
                                    key={option.value}
                                    value={option.value}
                                    disabled={selectedIds?.includes(option.value)}
                                  >
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </FieldWrapper>
                          )}
                        />

                        <Controller
                          control={control}
                          name={`matieres.${index}.heures_semaine`}
                          render={({ field, fieldState }) => (
                            <FieldWrapper
                              id={`matieres.${index}.heures_semaine`}
                              label="Heures / semaine"
                              error={fieldState.error?.message}
                              description="Optionnel"
                            >
                              <input
                                id={`matieres.${index}.heures_semaine`}
                                type="number"
                                min={0}
                                step={1}
                                value={field.value ?? ""}
                                onChange={(event) => field.onChange(event.target.value)}
                                onBlur={field.onBlur}
                                ref={field.ref}
                                placeholder="Ex: 4"
                                className={getInputClassName(Boolean(fieldState.error))}
                              />
                            </FieldWrapper>
                          )}
                        />

                        <Controller
                          control={control}
                          name={`matieres.${index}.coefficient`}
                          render={({ field, fieldState }) => (
                            <FieldWrapper
                              id={`matieres.${index}.coefficient`}
                              label="Coefficient"
                              error={fieldState.error?.message}
                              description="Optionnel"
                            >
                              <input
                                id={`matieres.${index}.coefficient`}
                                type="number"
                                min={0}
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

                      {lineError && !lineError.matiere_id && !lineError.heures_semaine && !lineError.coefficient ? (
                        <p className="mt-3 text-sm text-rose-600">
                          Ligne incomplete ou invalide.
                        </p>
                      ) : null}
                    </article>
                  );
                })}
              </div>

              {typeof formState.errors.matieres?.message === "string" ? (
                <p className="mt-4 text-sm font-medium text-rose-600">
                  {formState.errors.matieres.message}
                </p>
              ) : null}
            </section>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={formState.isSubmitting}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {formState.isSubmitting ? <Spin inline /> : null}
                <span>Enregistrer le programme</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default ProgrammeForm;
