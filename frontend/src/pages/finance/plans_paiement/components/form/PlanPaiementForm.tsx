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
import PlanPaiementEleveService, {
  getPlanPaiementEcheances,
} from "../../../../../services/planPaiementEleve.service";
import { usePlanPaiementCreateStore } from "../../store/PlanPaiementCreateStore";
import { usePlanPaiementStore } from "../../store/PlanPaiementIndexStore";

type EcheanceForm = {
  echeance_paiement_id?: string;
  date: string;
  montant: number;
  statut?: string;
  note?: string;
  libelle?: string;
  paid_amount?: number;
  remaining_amount?: number;
  locked?: boolean;
};

type PlanPaiementFormValues = {
  eleve_id: string;
  annee_scolaire_id: string;
  remise_id: string;
  mode_paiement: string;
  devise: string;
  notes: string;
  echeances: EcheanceForm[];
};

type PlanPaiementFormProps = {
  mode?: "create" | "edit";
};

const emptyEcheance: EcheanceForm = {
  date: "",
  montant: 0,
  statut: "",
  note: "",
  libelle: "",
  paid_amount: 0,
  remaining_amount: 0,
  locked: false,
};

const echeanceSchema = z.object({
  echeance_paiement_id: z.string().optional(),
  date: z.string().min(1, "La date est requise."),
  montant: z.coerce.number().min(0, "Le montant doit etre positif ou nul."),
  statut: z.string().optional(),
  note: z.string().optional(),
  libelle: z.string().optional(),
  paid_amount: z.coerce.number().optional(),
  remaining_amount: z.coerce.number().optional(),
  locked: z.boolean().optional(),
});

const planSchema = z.object({
  eleve_id: z.string().min(1, "L'eleve est requis."),
  annee_scolaire_id: z.string().min(1, "L'annee scolaire est requise."),
  remise_id: z.string().optional(),
  mode_paiement: z.string().min(1, "Le mode de paiement est requis."),
  devise: z.string().min(1, "La devise est requise."),
  notes: z.string().optional(),
  echeances: z.array(echeanceSchema).min(1, "Ajoute au moins une echeance."),
});

const modeOptions = [
  { value: "COMPTANT", label: "Comptant" },
  { value: "ECHELONNE", label: "Echelonne" },
];

function buildDefaultValues(
  initialData: {
    eleve_id?: string;
    annee_scolaire_id?: string;
    devise?: string;
    remise_id?: string;
  } | null,
  selectedPlan?: {
    eleve_id?: string;
    annee_scolaire_id?: string;
    remise_id?: string | null;
    plan_json?: {
      mode_paiement?: string | null;
      devise?: string | null;
      notes?: string | null;
    } | null;
  } | null,
  selectedEcheances?: EcheanceForm[],
): PlanPaiementFormValues {
  return {
    eleve_id: selectedPlan?.eleve_id ?? initialData?.eleve_id ?? "",
    annee_scolaire_id: selectedPlan?.annee_scolaire_id ?? initialData?.annee_scolaire_id ?? "",
    remise_id: selectedPlan?.remise_id ?? initialData?.remise_id ?? "",
    mode_paiement: selectedPlan?.plan_json?.mode_paiement ?? "ECHELONNE",
    devise: selectedPlan?.plan_json?.devise ?? initialData?.devise ?? "MGA",
    notes: selectedPlan?.plan_json?.notes ?? "",
    echeances:
      selectedEcheances && selectedEcheances.length > 0
        ? selectedEcheances
        : [{ ...emptyEcheance }],
  };
}

export default function PlanPaiementForm({ mode = "create" }: PlanPaiementFormProps) {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const service = useMemo(() => new PlanPaiementEleveService(), []);

  const loading = usePlanPaiementCreateStore((state) => state.loading);
  const errorMessage = usePlanPaiementCreateStore((state) => state.errorMessage);
  const initialData = usePlanPaiementCreateStore((state) => state.initialData);
  const eleveOptions = usePlanPaiementCreateStore((state) => state.eleveOptions);
  const anneeScolaireOptions = usePlanPaiementCreateStore((state) => state.anneeScolaireOptions);
  const remiseOptions = usePlanPaiementCreateStore((state) => state.remiseOptions);
  const getOptions = usePlanPaiementCreateStore((state) => state.getOptions);
  const selectedPlan = usePlanPaiementStore((state) => state.selectedPlanPaiement);
  const setRenderedComponent = usePlanPaiementStore((state) => state.setRenderedComponent);

  useEffect(() => {
    if (etablissement_id) {
      void getOptions(etablissement_id);
    }
  }, [etablissement_id, getOptions]);

  const selectedPlanEcheances = useMemo<EcheanceForm[]>(
    () =>
      getPlanPaiementEcheances(selectedPlan).map((item) => ({
        echeance_paiement_id: item.id,
        date: item.date,
        montant: Number(item.montant ?? 0),
        statut: item.statut ?? "",
        note: item.note ?? "",
        libelle: item.libelle ?? "",
        paid_amount: Number(item.paid_amount ?? 0),
        remaining_amount: Number(item.remaining_amount ?? item.montant ?? 0),
        locked:
          Number(item.paid_amount ?? 0) > 0 ||
          ["PAYEE", "PARTIELLE"].includes((item.statut ?? "").toUpperCase()),
      })),
    [selectedPlan],
  );

  const lockedInstallmentCount = useMemo(
    () => selectedPlanEcheances.filter((item) => item.locked).length,
    [selectedPlanEcheances],
  );

  const editableInstallmentCount = useMemo(
    () => Math.max(0, selectedPlanEcheances.length - lockedInstallmentCount),
    [lockedInstallmentCount, selectedPlanEcheances.length],
  );

  const defaultValues = useMemo<PlanPaiementFormValues>(
    () => buildDefaultValues(initialData, selectedPlan, selectedPlanEcheances),
    [initialData, selectedPlan, selectedPlanEcheances],
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
  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "echeances",
  });

  const onSubmit = async (data: PlanPaiementFormValues) => {
    try {
      const payload = {
        eleve_id: data.eleve_id,
        annee_scolaire_id: data.annee_scolaire_id,
        remise_id: data.remise_id?.trim() || null,
        mode_paiement: data.mode_paiement,
        devise: data.devise,
        notes: data.notes?.trim() || null,
        echeances: data.echeances.map((item, index) => ({
          echeance_paiement_id: item.echeance_paiement_id?.trim() || null,
          date: item.date,
          montant: Number(item.montant),
          statut: item.statut?.trim() || null,
          note: item.note?.trim() || null,
          libelle: item.libelle?.trim() || item.note?.trim() || `Tranche ${index + 1}`,
        })),
      };

      if (mode === "edit" && selectedPlan?.id) {
        await service.update(selectedPlan.id, payload);
        info("Plan de paiement mis a jour avec succes !", "success");
        setRenderedComponent("list");
        return;
      }

      await service.create(payload);
      info("Plan de paiement cree avec succes !", "success");
      reset(buildDefaultValues(initialData, null, [{ ...emptyEcheance }]));
      replace([{ ...emptyEcheance }]);
    } catch (error) {
      console.error(mode === "edit" ? "Erreur mise a jour plan" : "Erreur creation plan", error);
      info(
        mode === "edit"
          ? "Le plan de paiement n'a pas pu etre mis a jour."
          : "Le plan de paiement n'a pas pu etre cree.",
        "error",
      );
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
                <h3 className="text-lg font-semibold text-slate-900">
                  {mode === "edit" ? "Modifier le plan de paiement" : "Nouveau plan de paiement"}
                </h3>
                <p className="text-sm leading-6 text-slate-500">
                  {mode === "edit"
                    ? "Reechelonne uniquement les tranches non encaissees. Les echeances deja reglees ou partiellement reglees restent verrouillees."
                    : "Definis le mode de reglement et prepare les echeances attendues pour l'eleve."}
                </p>
              </div>

              {mode === "edit" && selectedPlan ? (
                <div className="mb-5 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                  <p className="font-semibold">Reechelonnement controle</p>
                  <p className="mt-2 leading-6">
                    {lockedInstallmentCount} tranche(s) verrouillee(s) car deja encaissee(s) ou partiellement reglee(s).
                    {editableInstallmentCount > 0
                      ? ` ${editableInstallmentCount} tranche(s) restent ajustables.`
                      : " Aucune tranche restante n'est modifiable."}
                  </p>
                </div>
              ) : null}

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
                        disabled={mode === "edit"}
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
                        disabled={mode === "edit"}
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
                  name="remise_id"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="remise_id"
                      label="Remise"
                      error={fieldState.error?.message}
                      description="La remise est tracee sur le plan et synchronisee avec la facture liee si elle existe."
                    >
                      <select
                        id="remise_id"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        className={getInputClassName(Boolean(fieldState.error))}
                      >
                        <option value="">Aucune remise</option>
                        {remiseOptions.map((option) => (
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
                  <article
                    key={item.id}
                    className={`rounded-[24px] border p-4 ${
                      item.locked
                        ? "border-amber-200 bg-amber-50/70"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                          <FiCalendar />
                          Echeance {index + 1}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span
                            className={`rounded-full px-2.5 py-1 font-semibold ${
                              item.locked
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {item.locked ? "Verrouillee" : "Ajustable"}
                          </span>
                          {item.locked ? (
                            <span className="text-slate-600">
                              Regle {Number(item.paid_amount ?? 0).toLocaleString("fr-FR")} / Reste{" "}
                              {Number(item.remaining_amount ?? 0).toLocaleString("fr-FR")}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={Boolean(item.locked)}
                        onClick={() => {
                          if (item.locked) return;
                          if (fields.length === 1) {
                            form.setValue("echeances.0", { ...emptyEcheance });
                            return;
                          }
                          remove(index);
                        }}
                        className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 disabled:hover:bg-white"
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
                              disabled={Boolean(item.locked)}
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
                              disabled={Boolean(item.locked)}
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
                              disabled={Boolean(item.locked)}
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
                              disabled={Boolean(item.locked)}
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

            <div className="flex justify-end gap-3">
              {mode === "edit" ? (
                <button
                  type="button"
                  onClick={() => setRenderedComponent("detail")}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Annuler
                </button>
              ) : null}
              <button
                type="submit"
                disabled={formState.isSubmitting}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {formState.isSubmitting ? <Spin inline /> : null}
                <span>{mode === "edit" ? "Mettre a jour le plan" : "Enregistrer le plan"}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
