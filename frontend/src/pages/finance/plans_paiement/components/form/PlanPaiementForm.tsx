import { useEffect, useMemo } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FiCalendar, FiPlus, FiTrash2 } from "react-icons/fi";
import { FieldWrapper } from "../../../../../components/Form/fields/FieldWrapper";
import { getInputClassName } from "../../../../../components/Form/fields/inputStyles";
import Spin from "../../../../../components/anim/Spin";
import { useAuth } from "../../../../../auth/AuthContext";
import { useInfo } from "../../../../../hooks/useInfo";
import PlanPaiementEleveService from "../../../../../services/planPaiementEleve.service";
import { usePlanPaiementCreateStore } from "../../store/PlanPaiementCreateStore";

type EcheanceForm = {
  date: string;
  montant: number;
  statut?: string;
  note?: string;
};

type PlanPaiementFormValues = {
  eleve_id: string;
  annee_scolaire_id: string;
  mode_paiement: string;
  devise: string;
  notes: string;
  echeances: EcheanceForm[];
};

const emptyEcheance: EcheanceForm = {
  date: "",
  montant: 0,
  statut: "",
  note: "",
};

const echeanceSchema = z.object({
  date: z.string().min(1, "La date est requise."),
  montant: z.coerce.number().min(0, "Le montant doit etre positif ou nul."),
  statut: z.string().optional(),
  note: z.string().optional(),
});

const planSchema = z.object({
  eleve_id: z.string().min(1, "L'eleve est requis."),
  annee_scolaire_id: z.string().min(1, "L'annee scolaire est requise."),
  mode_paiement: z.string().min(1, "Le mode de paiement est requis."),
  devise: z.string().min(1, "La devise est requise."),
  notes: z.string().optional(),
  echeances: z.array(echeanceSchema).min(1, "Ajoute au moins une echeance."),
});

const modeOptions = [
  { value: "COMPTANT", label: "Comptant" },
  { value: "ECHELONNE", label: "Echelonne" },
];

export default function PlanPaiementForm() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const service = useMemo(() => new PlanPaiementEleveService(), []);

  const loading = usePlanPaiementCreateStore((state) => state.loading);
  const errorMessage = usePlanPaiementCreateStore((state) => state.errorMessage);
  const initialData = usePlanPaiementCreateStore((state) => state.initialData);
  const eleveOptions = usePlanPaiementCreateStore((state) => state.eleveOptions);
  const anneeScolaireOptions = usePlanPaiementCreateStore((state) => state.anneeScolaireOptions);
  const getOptions = usePlanPaiementCreateStore((state) => state.getOptions);

  useEffect(() => {
    if (etablissement_id) {
      void getOptions(etablissement_id);
    }
  }, [etablissement_id, getOptions]);

  const defaultValues = useMemo<PlanPaiementFormValues>(
    () => ({
      eleve_id: initialData?.eleve_id ?? "",
      annee_scolaire_id: initialData?.annee_scolaire_id ?? "",
      mode_paiement: "ECHELONNE",
      devise: initialData?.devise ?? "MGA",
      notes: "",
      echeances: [{ ...emptyEcheance }],
    }),
    [initialData],
  );

  const form = useForm<PlanPaiementFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues,
    mode: "onSubmit",
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const { control, handleSubmit, formState, reset } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "echeances",
  });

  const onSubmit = async (data: PlanPaiementFormValues) => {
    try {
      await service.create({
        eleve_id: data.eleve_id,
        annee_scolaire_id: data.annee_scolaire_id,
        mode_paiement: data.mode_paiement,
        devise: data.devise,
        notes: data.notes?.trim() || null,
        echeances: data.echeances.map((item) => ({
          date: item.date,
          montant: Number(item.montant),
          statut: item.statut?.trim() || null,
          note: item.note?.trim() || null,
        })),
      });
      info("Plan de paiement cree avec succes !", "success");
      reset({
        ...defaultValues,
        eleve_id: "",
        echeances: [{ ...emptyEcheance }],
        notes: "",
      });
    } catch (error) {
      console.error("Erreur creation plan", error);
      info("Le plan de paiement n'a pas pu etre cree.", "error");
    }
  };

  return (
    <div className="w-full">
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
                <h3 className="text-lg font-semibold text-slate-900">Nouveau plan de paiement</h3>
                <p className="text-sm leading-6 text-slate-500">
                  Definis le mode de reglement et prepare les echeances attendues pour l'eleve.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Controller
                  control={control}
                  name="eleve_id"
                  render={({ field, fieldState }) => (
                    <FieldWrapper id="eleve_id" label="Eleve" required error={fieldState.error?.message}>
                      <select
                        id="eleve_id"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        className={getInputClassName(Boolean(fieldState.error))}
                      >
                        <option value="">Selectionner un eleve</option>
                        {eleveOptions.map((option) => (
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
                  name="annee_scolaire_id"
                  render={({ field, fieldState }) => (
                    <FieldWrapper id="annee_scolaire_id" label="Annee scolaire" required error={fieldState.error?.message}>
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
                  name="mode_paiement"
                  render={({ field, fieldState }) => (
                    <FieldWrapper id="mode_paiement" label="Mode de paiement" required error={fieldState.error?.message}>
                      <select
                        id="mode_paiement"
                        value={field.value ?? "ECHELONNE"}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        className={getInputClassName(Boolean(fieldState.error))}
                      >
                        {modeOptions.map((option) => (
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
                  name="devise"
                  render={({ field, fieldState }) => (
                    <FieldWrapper id="devise" label="Devise" required error={fieldState.error?.message}>
                      <input
                        id="devise"
                        type="text"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value.toUpperCase())}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        className={getInputClassName(Boolean(fieldState.error))}
                      />
                    </FieldWrapper>
                  )}
                />

                <Controller
                  control={control}
                  name="notes"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="notes"
                      label="Notes"
                      error={fieldState.error?.message}
                      className="md:col-span-2"
                    >
                      <textarea
                        id="notes"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        rows={4}
                        className={getInputClassName(Boolean(fieldState.error))}
                      />
                    </FieldWrapper>
                  )}
                />
              </div>
            </section>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Echeances</h3>
                  <p className="text-sm text-slate-500">
                    Definis la date et le montant de chaque tranche attendue.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => append({ ...emptyEcheance })}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <FiPlus />
                  Ajouter une echeance
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {fields.map((item, index) => (
                  <article key={item.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <FiCalendar />
                        Echeance {index + 1}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (fields.length === 1) {
                            form.setValue("echeances.0", { ...emptyEcheance });
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

                    <div className="grid gap-4 md:grid-cols-2">
                      <Controller
                        control={control}
                        name={`echeances.${index}.date`}
                        render={({ field, fieldState }) => (
                          <FieldWrapper id={`echeances.${index}.date`} label="Date" required error={fieldState.error?.message}>
                            <input
                              id={`echeances.${index}.date`}
                              type="date"
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
                        name={`echeances.${index}.montant`}
                        render={({ field, fieldState }) => (
                          <FieldWrapper id={`echeances.${index}.montant`} label="Montant" required error={fieldState.error?.message}>
                            <input
                              id={`echeances.${index}.montant`}
                              type="number"
                              min={0}
                              step="0.01"
                              value={field.value ?? 0}
                              onChange={(event) => field.onChange(Number(event.target.value || 0))}
                              onBlur={field.onBlur}
                              ref={field.ref}
                              className={getInputClassName(Boolean(fieldState.error))}
                            />
                          </FieldWrapper>
                        )}
                      />

                      <Controller
                        control={control}
                        name={`echeances.${index}.statut`}
                        render={({ field, fieldState }) => (
                          <FieldWrapper id={`echeances.${index}.statut`} label="Statut interne" error={fieldState.error?.message}>
                            <input
                              id={`echeances.${index}.statut`}
                              type="text"
                              value={field.value ?? ""}
                              onChange={(event) => field.onChange(event.target.value)}
                              onBlur={field.onBlur}
                              ref={field.ref}
                              placeholder="Ex: A venir"
                              className={getInputClassName(Boolean(fieldState.error))}
                            />
                          </FieldWrapper>
                        )}
                      />

                      <Controller
                        control={control}
                        name={`echeances.${index}.note`}
                        render={({ field, fieldState }) => (
                          <FieldWrapper id={`echeances.${index}.note`} label="Note" error={fieldState.error?.message}>
                            <input
                              id={`echeances.${index}.note`}
                              type="text"
                              value={field.value ?? ""}
                              onChange={(event) => field.onChange(event.target.value)}
                              onBlur={field.onBlur}
                              ref={field.ref}
                              placeholder="Ex: Premiere tranche"
                              className={getInputClassName(Boolean(fieldState.error))}
                            />
                          </FieldWrapper>
                        )}
                      />
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={formState.isSubmitting}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {formState.isSubmitting ? <Spin inline /> : null}
                <span>Enregistrer le plan</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
