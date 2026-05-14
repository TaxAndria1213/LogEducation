import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FiLayers, FiSettings } from "react-icons/fi";
import Spin from "../../../../../components/anim/Spin";
import { FieldWrapper } from "../../../../../components/Form/fields/FieldWrapper";
import { getInputClassName } from "../../../../../components/Form/fields/inputStyles";
import { useInfo } from "../../../../../hooks/useInfo";
import { useAuth } from "../../../../../hooks/useAuth";
import TypeEvaluationRefService, {
  getTypeEvaluationCodeLabel,
} from "../../../../../services/typeEvaluationRef.service";
import { useTypeEvaluationRefStore } from "../../store/TypeEvaluationRefIndexStore";
import type { TypeEvaluation } from "../../../../../types/models";

type TypeEvaluationRefFormValues = {
  code: TypeEvaluation;
  nom: string;
  poids_defaut: number | null;
  default_max_score: number | null;
  include_in_average: boolean;
  show_in_report_card: boolean;
  is_final_exam: boolean;
  is_active: boolean;
};

const schema = z.object({
  code: z.enum(["DEVOIR", "EXAMEN", "ORAL", "AUTRE"]),
  nom: z
    .string()
    .trim()
    .min(2, "Le nom du type d'evaluation est requis.")
    .max(120, "Le nom est trop long.")
    .transform((value) => value.replace(/\s+/g, " ")),
  poids_defaut: z.preprocess(
    (value) => {
      if (value === "" || value === null || value === undefined) return null;
      return Number(value);
    },
    z.number().min(0.1, "Le poids par defaut doit etre superieur a 0.").max(1000).nullable(),
  ),
  default_max_score: z.preprocess(
    (value) => {
      if (value === "" || value === null || value === undefined) return null;
      return Number(value);
    },
    z
      .number()
      .min(0.1, "La note maximale par defaut doit etre superieure a 0.")
      .max(1000)
      .nullable(),
  ),
  include_in_average: z.boolean(),
  show_in_report_card: z.boolean(),
  is_final_exam: z.boolean(),
  is_active: z.boolean(),
});

type TypeEvaluationRefFormData = z.output<typeof schema>;

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

  return "Le type d'evaluation n'a pas pu etre enregistre.";
}

function normalizeNumberInputValue(value: unknown, fallback: string | number = "") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") return value;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function TypeEvaluationRefForm() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const service = useMemo(() => new TypeEvaluationRefService(), []);
  const editingItem = useTypeEvaluationRefStore((state) => state.editingItem);
  const clearEditingItem = useTypeEvaluationRefStore((state) => state.clearEditingItem);
  const setRenderedComponent = useTypeEvaluationRefStore((state) => state.setRenderedComponent);

  const defaultValues = useMemo<TypeEvaluationRefFormValues>(
    () => ({
      code: editingItem?.code ?? "AUTRE",
      nom: editingItem?.nom ?? "",
      poids_defaut: editingItem?.poids_defaut ?? null,
      default_max_score: editingItem?.default_max_score ?? 20,
      include_in_average: editingItem?.include_in_average ?? true,
      show_in_report_card: editingItem?.show_in_report_card ?? false,
      is_final_exam: editingItem?.is_final_exam ?? false,
      is_active: editingItem?.is_active ?? true,
    }),
    [editingItem],
  );

  const form = useForm<z.input<typeof schema>, undefined, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: "onSubmit",
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const { control, handleSubmit, formState, reset } = form;

  const onSubmit = async (data: TypeEvaluationRefFormData) => {
    if (!etablissement_id) {
      info("Aucun etablissement actif n'est defini.", "error");
      return;
    }

    try {
      if (editingItem) {
        await service.update(editingItem.id, {
          ...data,
          etablissement_id,
        });
        info("Type d'evaluation mis a jour avec succes.", "success");
      } else {
        await service.create({
          ...data,
          etablissement_id,
        });
        info("Type d'evaluation cree avec succes.", "success");
      }

      clearEditingItem();
      reset({
        code: "AUTRE",
        nom: "",
        poids_defaut: null,
        default_max_score: 20,
        include_in_average: true,
        show_in_report_card: false,
        is_final_exam: false,
        is_active: true,
      });
      setRenderedComponent("list");
    } catch (error) {
      info(getErrorMessage(error), "error");
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
              <FiLayers />
              {editingItem ? "Edition" : "Nouveau type"}
            </span>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {editingItem
                  ? "Mettre a jour un type d'evaluation"
                  : "Configurer un type d'evaluation reutilisable"}
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Ces parametres servent de base aux enseignants au moment de creer
                leurs evaluations, tout en laissant la main sur les exceptions.
              </p>
            </div>
          </div>

          {editingItem ? (
            <button
              type="button"
              onClick={() => {
                clearEditingItem();
                reset({
                  code: "AUTRE",
                  nom: "",
                  poids_defaut: null,
                  default_max_score: 20,
                  include_in_average: true,
                  show_in_report_card: false,
                  is_final_exam: false,
                  is_active: true,
                });
              }}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Annuler l'edition
            </button>
          ) : null}
        </div>
      </section>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <FiSettings />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Definition du type</h3>
              <p className="text-sm text-slate-500">
                Le code permet de garder une lecture uniforme dans tout le module.
              </p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Controller
              control={control}
              name="code"
              render={({ field, fieldState }) => (
                <FieldWrapper
                  id="code"
                  label="Code"
                  required
                  error={fieldState.error?.message}
                >
                  <select
                    id="code"
                    value={field.value}
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    className={getInputClassName(Boolean(fieldState.error))}
                  >
                    {(["DEVOIR", "EXAMEN", "ORAL", "AUTRE"] as TypeEvaluation[]).map((value) => (
                      <option key={value} value={value}>
                        {getTypeEvaluationCodeLabel(value)}
                      </option>
                    ))}
                  </select>
                </FieldWrapper>
              )}
            />

            <Controller
              control={control}
              name="nom"
              render={({ field, fieldState }) => (
                <FieldWrapper
                  id="nom"
                  label="Libelle"
                  required
                  error={fieldState.error?.message}
                >
                  <input
                    id="nom"
                    type="text"
                    value={normalizeNumberInputValue(field.value)}
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    placeholder="Ex: Composition trimestrielle"
                    className={getInputClassName(Boolean(fieldState.error))}
                  />
                </FieldWrapper>
              )}
            />

            <Controller
              control={control}
              name="poids_defaut"
              render={({ field, fieldState }) => (
                <FieldWrapper
                  id="poids_defaut"
                  label="Poids par defaut"
                  error={fieldState.error?.message}
                >
                  <input
                    id="poids_defaut"
                    type="number"
                    min={0.1}
                    step="0.1"
                    value={normalizeNumberInputValue(field.value)}
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    placeholder="Ex: 2"
                    className={getInputClassName(Boolean(fieldState.error))}
                  />
                </FieldWrapper>
              )}
            />

            <Controller
              control={control}
              name="default_max_score"
              render={({ field, fieldState }) => (
                <FieldWrapper
                  id="default_max_score"
                  label="Note maximale par defaut"
                  error={fieldState.error?.message}
                >
                  <input
                    id="default_max_score"
                    type="number"
                    min={0.1}
                    step="0.5"
                    value={normalizeNumberInputValue(field.value)}
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    placeholder="Ex: 20"
                    className={getInputClassName(Boolean(fieldState.error))}
                  />
                </FieldWrapper>
              )}
            />
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Comportement par defaut</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {(
              [
                {
                  name: "include_in_average" as const,
                  title: "Inclure dans la moyenne",
                  description:
                    "L'evaluation de ce type participera par defaut aux calculs.",
                },
                {
                  name: "show_in_report_card" as const,
                  title: "Visible dans le bulletin",
                  description:
                    "Ce type pourra apparaitre dans les bulletins detailles.",
                },
                {
                  name: "is_final_exam" as const,
                  title: "Examen final",
                  description:
                    "Utile pour les modeles qui n'affichent que la composition.",
                },
                {
                  name: "is_active" as const,
                  title: "Actif",
                  description:
                    "Un type inactif reste historise mais n'est plus propose par defaut.",
                },
              ] as const
            ).map((item) => (
              <Controller
                key={item.name}
                control={control}
                name={item.name}
                render={({ field }) => (
                  <label className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(field.value)}
                      onChange={(event) => field.onChange(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                    />
                    <span>
                      <span className="block font-semibold text-slate-900">{item.title}</span>
                      <span className="mt-1 block text-slate-600">{item.description}</span>
                    </span>
                  </label>
                )}
              />
            ))}
          </div>
        </section>

        <div className="flex justify-end gap-3">
          {editingItem ? (
            <button
              type="button"
              onClick={() => {
                clearEditingItem();
                setRenderedComponent("list");
              }}
              className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Retour a la liste
            </button>
          ) : null}
          <button
            type="submit"
            disabled={formState.isSubmitting}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {formState.isSubmitting ? <Spin inline /> : null}
            <span>{editingItem ? "Mettre a jour" : "Enregistrer le type"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default TypeEvaluationRefForm;
