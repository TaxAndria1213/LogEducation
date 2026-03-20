import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FiBookOpen,
  FiCalendar,
  FiGrid,
  FiLayers,
  FiUserCheck,
} from "react-icons/fi";
import Spin from "../../../../../components/anim/Spin";
import { FieldWrapper } from "../../../../../components/Form/fields/FieldWrapper";
import { getInputClassName } from "../../../../../components/Form/fields/inputStyles";
import { useInfo } from "../../../../../hooks/useInfo";
import { useAuth } from "../../../../../hooks/useAuth";
import CoursService, {
  getTeacherDisplayLabel,
  type ClasseWithRelations,
  type EnseignantWithRelations,
} from "../../../../../services/cours.service";
import { getMatiereDisplayLabel } from "../../../../../services/matiere.service";
import { useCoursCreateStore } from "../../store/CoursCreateStore";

type CoursFormValues = {
  etablissement_id: string;
  annee_scolaire_id: string;
  classe_id: string;
  matiere_id: string;
  enseignant_id: string;
  coefficient_override: number | null;
};

const coursSchema = z.object({
  etablissement_id: z.string().min(1, "L'etablissement est requis."),
  annee_scolaire_id: z.string().min(1, "L'annee scolaire est requise."),
  classe_id: z.string().min(1, "La classe est requise."),
  matiere_id: z.string().min(1, "La matiere est requise."),
  enseignant_id: z.string().min(1, "L'enseignant est requis."),
  coefficient_override: z.preprocess(
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

  return "Le cours n'a pas pu etre enregistre.";
}

function CoursForm() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const service = useMemo(() => new CoursService(), []);

  const loading = useCoursCreateStore((state) => state.loading);
  const errorMessage = useCoursCreateStore((state) => state.errorMessage);
  const initialData = useCoursCreateStore((state) => state.initialData);
  const anneeScolaireOptions = useCoursCreateStore(
    (state) => state.anneeScolaireOptions,
  );
  const classeOptions = useCoursCreateStore((state) => state.classeOptions);
  const matiereOptions = useCoursCreateStore((state) => state.matiereOptions);
  const enseignants = useCoursCreateStore((state) => state.enseignants);
  const classes = useCoursCreateStore((state) => state.classes);
  const matieres = useCoursCreateStore((state) => state.matieres);
  const programmes = useCoursCreateStore((state) => state.programmes);
  const getOptions = useCoursCreateStore((state) => state.getOptions);

  useEffect(() => {
    if (etablissement_id) {
      void getOptions(etablissement_id);
    }
  }, [etablissement_id, getOptions]);

  const defaultValues = useMemo<CoursFormValues>(
    () => ({
      etablissement_id: initialData?.etablissement_id ?? etablissement_id ?? "",
      annee_scolaire_id: initialData?.annee_scolaire_id ?? "",
      classe_id: initialData?.classe_id ?? "",
      matiere_id: initialData?.matiere_id ?? "",
      enseignant_id: initialData?.enseignant_id ?? "",
      coefficient_override: initialData?.coefficient_override ?? null,
    }),
    [etablissement_id, initialData],
  );

  const form = useForm<CoursFormValues>({
    resolver: zodResolver(coursSchema),
    defaultValues,
    mode: "onSubmit",
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const { control, handleSubmit, watch, formState, reset, setValue, setError, clearErrors } =
    form;

  const selectedYearId = watch("annee_scolaire_id");
  const selectedClasseId = watch("classe_id");
  const selectedMatiereId = watch("matiere_id");
  const selectedEnseignantId = watch("enseignant_id");

  const selectedClass = useMemo(
    () => classes.find((item) => item.id === selectedClasseId) ?? null,
    [classes, selectedClasseId],
  );
  const selectedMatiere = useMemo(
    () => matieres.find((item) => item.id === selectedMatiereId) ?? null,
    [matieres, selectedMatiereId],
  );
  const selectedTeacher = useMemo(
    () => enseignants.find((item) => item.id === selectedEnseignantId) ?? null,
    [enseignants, selectedEnseignantId],
  );

  const matchingProgrammes = useMemo(
    () =>
      programmes.filter(
        (programme) =>
          programme.annee_scolaire_id === selectedYearId &&
          programme.niveau_scolaire_id === selectedClass?.niveau_scolaire_id,
      ),
    [programmes, selectedClass?.niveau_scolaire_id, selectedYearId],
  );

  const programmeLines = useMemo(() => {
    const lineMap = new Map<string, { coefficient: number | null; programmeNames: string[] }>();

    matchingProgrammes.forEach((programme) => {
      programme.matieres?.forEach((line) => {
        if (!line.matiere_id) return;
        const existing = lineMap.get(line.matiere_id);
        if (existing) {
          existing.programmeNames.push(programme.nom);
          if (existing.coefficient === null && line.coefficient !== null) {
            existing.coefficient = line.coefficient;
          }
          return;
        }

        lineMap.set(line.matiere_id, {
          coefficient: line.coefficient ?? null,
          programmeNames: [programme.nom],
        });
      });
    });

    return lineMap;
  }, [matchingProgrammes]);

  const allowedMatiereIds = useMemo(
    () => new Set([...programmeLines.keys()]),
    [programmeLines],
  );

  const filteredMatiereOptions = useMemo(() => {
    if (matchingProgrammes.length === 0) {
      return matiereOptions;
    }

    return matiereOptions.filter((option) => allowedMatiereIds.has(option.value));
  }, [allowedMatiereIds, matchingProgrammes.length, matiereOptions]);

  const enseignantOptions = useMemo(() => {
    const selectedDepartementId = selectedMatiere?.departement_id ?? null;

    const sorted = [...enseignants].sort((left, right) => {
      const leftMatch =
        selectedDepartementId && left.departement_principal_id === selectedDepartementId
          ? 1
          : 0;
      const rightMatch =
        selectedDepartementId && right.departement_principal_id === selectedDepartementId
          ? 1
          : 0;

      if (leftMatch !== rightMatch) {
        return rightMatch - leftMatch;
      }

      return getTeacherDisplayLabel(left).localeCompare(getTeacherDisplayLabel(right));
    });

    return sorted.map((item) => ({
      value: item.id,
      label: getTeacherDisplayLabel(item),
    }));
  }, [enseignants, selectedMatiere?.departement_id]);

  const recommendedCoefficient = useMemo(() => {
    if (!selectedMatiereId) return null;
    return programmeLines.get(selectedMatiereId)?.coefficient ?? null;
  }, [programmeLines, selectedMatiereId]);

  useEffect(() => {
    if (selectedMatiereId && matchingProgrammes.length > 0 && !allowedMatiereIds.has(selectedMatiereId)) {
      setValue("matiere_id", "", { shouldValidate: true });
    }
  }, [allowedMatiereIds, matchingProgrammes.length, selectedMatiereId, setValue]);

  useEffect(() => {
    const currentCoefficient = form.getValues("coefficient_override");

    if (
      recommendedCoefficient !== null &&
      (currentCoefficient === null || currentCoefficient === undefined)
    ) {
      setValue("coefficient_override", recommendedCoefficient, {
        shouldDirty: true,
      });
    }
  }, [form, recommendedCoefficient, setValue]);

  const onSubmit = async (data: CoursFormValues) => {
    clearErrors("matiere_id");

    if (matchingProgrammes.length > 0 && !allowedMatiereIds.has(data.matiere_id)) {
      setError("matiere_id", {
        type: "manual",
        message:
          "La matiere selectionnee n'apparait dans aucun programme du niveau pour l'annee choisie.",
      });
      return;
    }

    try {
      await service.create(data);
      info("Cours cree avec succes !", "success");
      reset({
        ...defaultValues,
        classe_id: "",
        matiere_id: "",
        enseignant_id: "",
        coefficient_override: null,
      });
    } catch (error: unknown) {
      info(getErrorMessage(error), "error");
    }
  };

  const selectedTeacherDepartmentMismatch =
    selectedMatiere?.departement_id &&
    selectedTeacher?.departement_principal_id &&
    selectedTeacher.departement_principal_id !== selectedMatiere.departement_id;

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
                    Nouveau cours
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      Construire une affectation pedagogique claire
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                      Rattache le cours a la bonne annee, a la bonne classe, a une matiere compatible avec le programme et a l'enseignant le plus coherent.
                    </p>
                  </div>
                </div>
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-800">Reperes rapides</p>
                  <p className="mt-2">{classes.length} classe(s) disponible(s)</p>
                  <p>{matieres.length} matiere(s) chargee(s)</p>
                  <p>{enseignants.length} enseignant(s) charge(s)</p>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <FiCalendar />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Contexte du cours</h3>
                  <p className="text-sm text-slate-500">
                    L'annee active est preselectionnee et les classes visibles sont deja filtrees pour cette annee.
                  </p>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Controller
                  control={control}
                  name="annee_scolaire_id"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="annee_scolaire_id"
                      label="Annee scolaire"
                      required
                      error={fieldState.error?.message}
                      description="Le cours sera cree pour l'annee scolaire active de l'etablissement."
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
                  name="classe_id"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="classe_id"
                      label="Classe"
                      required
                      error={fieldState.error?.message}
                      description="La classe determine le niveau, les programmes relies et les futurs usages dans l'emploi du temps et les evaluations."
                    >
                      <select
                        id="classe_id"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        className={getInputClassName(Boolean(fieldState.error))}
                      >
                        <option value="">Selectionner une classe</option>
                        {classeOptions.map((option) => (
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
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <FiGrid />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Affectation pedagogique</h3>
                  <p className="text-sm text-slate-500">
                    Les matieres peuvent etre filtrees automatiquement a partir des programmes du niveau. Les enseignants du meme departement remontent en priorite.
                  </p>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-[1.1fr_1.1fr_0.8fr]">
                <Controller
                  control={control}
                  name="matiere_id"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="matiere_id"
                      label="Matiere"
                      required
                      error={fieldState.error?.message}
                      description={
                        matchingProgrammes.length > 0
                          ? "Liste restreinte aux matieres deja presentes dans les programmes du niveau choisi."
                          : "Aucun programme detecte pour ce niveau: toutes les matieres de l'etablissement restent disponibles."
                      }
                    >
                      <select
                        id="matiere_id"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        disabled={!selectedClasseId}
                        className={getInputClassName(Boolean(fieldState.error))}
                      >
                        <option value="">Selectionner une matiere</option>
                        {filteredMatiereOptions.map((option) => (
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
                  name="enseignant_id"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="enseignant_id"
                      label="Enseignant"
                      required
                      error={fieldState.error?.message}
                      description="Les enseignants du departement de la matiere sont proposes en tete de liste quand l'information existe."
                    >
                      <select
                        id="enseignant_id"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        className={getInputClassName(Boolean(fieldState.error))}
                      >
                        <option value="">Selectionner un enseignant</option>
                        {enseignantOptions.map((option) => (
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
                  name="coefficient_override"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="coefficient_override"
                      label="Coefficient du cours"
                      error={fieldState.error?.message}
                      description={
                        recommendedCoefficient !== null
                          ? `Suggestion issue du programme: ${recommendedCoefficient}`
                          : "Optionnel. Laisse vide pour utiliser les reperes du programme ou des evaluations."
                      }
                    >
                      <input
                        id="coefficient_override"
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

              {selectedTeacherDepartmentMismatch ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  L'enseignant selectionne n'est pas rattache au meme departement principal que la matiere. Le back bloquera l'enregistrement si cette incoherence persiste.
                </div>
              ) : null}
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <FiLayers />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Controle de coherence</h3>
                    <p className="text-sm text-slate-500">
                      Un resume des dependances visibles avant l'enregistrement du cours.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Classe cible
                    </p>
                    <p className="mt-3 text-sm font-semibold text-slate-900">
                      {selectedClass?.nom ?? "Aucune classe selectionnee"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Niveau: {selectedClass?.niveau?.nom ?? "Non renseigne"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      Site: {selectedClass?.site?.nom ?? "Non renseigne"}
                    </p>
                  </div>

                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Programme du niveau
                    </p>
                    <p className="mt-3 text-sm font-semibold text-slate-900">
                      {matchingProgrammes.length} programme(s) detecte(s)
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {matchingProgrammes.length > 0
                        ? matchingProgrammes.map((programme) => programme.nom).join(", ")
                        : "Aucun programme rattache a ce niveau pour l'annee active."}
                    </p>
                  </div>
                </div>
              </article>

              <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <FiUserCheck />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Selection actuelle</h3>
                    <p className="text-sm text-slate-500">
                      Une lecture rapide avant validation.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-4 text-sm text-slate-700">
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="font-semibold text-slate-900">
                      {selectedMatiere ? getMatiereDisplayLabel(selectedMatiere) : "Matiere non choisie"}
                    </p>
                    <p className="mt-1 text-slate-600">
                      Enseignant: {selectedTeacher ? getTeacherDisplayLabel(selectedTeacher) : "Aucun enseignant choisi"}
                    </p>
                    <p className="mt-1 text-slate-600">
                      Coefficient: {watch("coefficient_override") ?? "Non renseigne"}
                    </p>
                  </div>

                  <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Conseils
                    </p>
                    <ul className="mt-3 space-y-2 leading-6 text-slate-700">
                      <li>Choisis d'abord la classe pour activer les controles lies au niveau et au programme.</li>
                      <li>Si un programme existe, la matiere doit y figurer pour passer la validation back.</li>
                      <li>Un coefficient manuel est utile quand le cours doit deroger au coefficient du programme.</li>
                    </ul>
                  </div>
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
                <span>Enregistrer le cours</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default CoursForm;
