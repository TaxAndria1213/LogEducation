import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FieldWrapper } from "../../../../../components/Form/fields/FieldWrapper";
import { getInputClassName } from "../../../../../components/Form/fields/inputStyles";
import Spin from "../../../../../components/anim/Spin";
import PaiementService from "../../../../../services/paiement.service";
import { useAuth } from "../../../../../auth/AuthContext";
import { useInfo } from "../../../../../hooks/useInfo";
import { usePaiementCreateStore } from "../../store/PaiementCreateStore";

type PaiementFormValues = {
  facture_id: string;
  paye_le: string;
  montant: number;
  methode: string;
  reference: string;
  recu_par: string;
};

const paiementSchema = z.object({
  facture_id: z.string().min(1, "La facture est requise."),
  paye_le: z.string().min(1, "La date du paiement est requise."),
  montant: z.coerce.number().positive("Le montant doit etre strictement positif."),
  methode: z.string().trim().optional(),
  reference: z.string().trim().optional(),
  recu_par: z.string().trim().optional(),
});

const methodOptions = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Banque" },
  { value: "mobile", label: "Mobile money" },
  { value: "virement", label: "Virement" },
];

export default function PaiementForm() {
  const { etablissement_id, user } = useAuth();
  const { info } = useInfo();
  const service = useMemo(() => new PaiementService(), []);

  const loading = usePaiementCreateStore((state) => state.loading);
  const errorMessage = usePaiementCreateStore((state) => state.errorMessage);
  const factureOptions = usePaiementCreateStore((state) => state.factureOptions);
  const initialData = usePaiementCreateStore((state) => state.initialData);
  const getOptions = usePaiementCreateStore((state) => state.getOptions);

  useEffect(() => {
    if (etablissement_id) {
      void getOptions(etablissement_id);
    }
  }, [etablissement_id, getOptions]);

  const defaultValues = useMemo<PaiementFormValues>(
    () => ({
      facture_id: initialData?.facture_id ?? "",
      paye_le: initialData?.paye_le ?? new Date().toISOString().slice(0, 10),
      montant: initialData?.montant ?? 0,
      methode: initialData?.methode ?? "cash",
      reference: initialData?.reference ?? "",
      recu_par: user?.id ?? initialData?.recu_par ?? "",
    }),
    [initialData, user?.id],
  );

  const form = useForm<PaiementFormValues>({
    resolver: zodResolver(paiementSchema),
    defaultValues,
    mode: "onSubmit",
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const { control, handleSubmit, formState, watch, setValue, reset } = form;
  const selectedFactureId = watch("facture_id");
  const selectedFacture = factureOptions.find((option) => option.value === selectedFactureId);

  const onSubmit = async (data: PaiementFormValues) => {
    try {
      await service.create({
        facture_id: data.facture_id,
        paye_le: data.paye_le,
        montant: Number(data.montant),
        methode: data.methode?.trim() || null,
        reference: data.reference?.trim() || null,
        recu_par: data.recu_par?.trim() || null,
      });
      info("Paiement enregistre avec succes !", "success");
      reset({
        facture_id: factureOptions[0]?.value ?? "",
        paye_le: new Date().toISOString().slice(0, 10),
        montant: factureOptions[0]?.remaining ?? 0,
        methode: "cash",
        reference: "",
        recu_par: user?.id ?? "",
      });
    } catch (error) {
      console.error("Erreur creation paiement", error);
      info("Le paiement n'a pas pu etre enregistre.", "error");
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
                <h3 className="text-lg font-semibold text-slate-900">Nouveau paiement</h3>
                <p className="text-sm leading-6 text-slate-500">
                  Rattache le paiement a une facture ouverte. Le statut de la facture sera recalculé automatiquement.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Controller
                  control={control}
                  name="facture_id"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="facture_id"
                      label="Facture"
                      required
                      error={fieldState.error?.message}
                    >
                      <select
                        id="facture_id"
                        value={field.value ?? ""}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          field.onChange(nextValue);
                          const option = factureOptions.find((item) => item.value === nextValue);
                          if (option) {
                            setValue("montant", option.remaining, { shouldValidate: true });
                          }
                        }}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        className={getInputClassName(Boolean(fieldState.error))}
                      >
                        <option value="">Selectionner une facture</option>
                        {factureOptions.map((option) => (
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
                  name="paye_le"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="paye_le"
                      label="Date du paiement"
                      required
                      error={fieldState.error?.message}
                    >
                      <input
                        id="paye_le"
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
                  name="montant"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="montant"
                      label="Montant"
                      required
                      error={fieldState.error?.message}
                      description={
                        selectedFacture
                          ? `Solde restant: ${selectedFacture.remaining.toLocaleString("fr-FR")} ${selectedFacture.devise}`
                          : "Selectionne d'abord une facture."
                      }
                    >
                      <input
                        id="montant"
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
                  name="methode"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="methode"
                      label="Methode"
                      error={fieldState.error?.message}
                    >
                      <select
                        id="methode"
                        value={field.value ?? "cash"}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        className={getInputClassName(Boolean(fieldState.error))}
                      >
                        {methodOptions.map((option) => (
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
                  name="reference"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="reference"
                      label="Reference"
                      error={fieldState.error?.message}
                    >
                      <input
                        id="reference"
                        type="text"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        placeholder="Ex: OM-2026-00045"
                        className={getInputClassName(Boolean(fieldState.error))}
                      />
                    </FieldWrapper>
                  )}
                />

                <Controller
                  control={control}
                  name="recu_par"
                  render={({ field, fieldState }) => (
                    <FieldWrapper
                      id="recu_par"
                      label="Recu par"
                      error={fieldState.error?.message}
                      description="Identifiant utilisateur interne du compte encaisseur."
                    >
                      <input
                        id="recu_par"
                        type="text"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                        className={getInputClassName(Boolean(fieldState.error))}
                      />
                    </FieldWrapper>
                  )}
                />
              </div>
            </section>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={formState.isSubmitting}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {formState.isSubmitting ? <Spin inline /> : null}
                <span>Enregistrer le paiement</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
