import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FieldWrapper } from "../../../../../components/Form/fields/FieldWrapper";
import { getInputClassName } from "../../../../../components/Form/fields/inputStyles";
import Spin from "../../../../../components/anim/Spin";
import FlyPopup from "../../../../../components/popup/FlyPopup";
import PaiementService from "../../../../../services/paiement.service";
import { useAuth } from "../../../../../auth/AuthContext";
import { useInfo } from "../../../../../hooks/useInfo";
import {
  usePaiementCreateStore,
  type PaiementFactureOption,
  type PaiementInstallmentOption,
} from "../../store/PaiementCreateStore";

const paymentMethodValues = ["cash", "mobile_money", "virement", "cheque", "bank"] as const;
type PaymentMethod = (typeof paymentMethodValues)[number];

const paiementSchema = z.object({
  facture_id: z.string().min(1, "La facture est requise."),
  paye_le: z.string().min(1, "La date du paiement est requise."),
  montant: z.number().positive("Le montant doit etre strictement positif."),
  methode: z.string().trim().optional(),
  reference: z.string().trim().optional(),
  recu_par: z.string().trim().optional(),
}).superRefine((data, ctx) => {
  const methode = (data.methode ?? "").trim().toLowerCase();
  const needsReference = ["mobile_money", "mobile", "virement", "cheque", "bank"].includes(methode);

  if (needsReference && !(data.reference ?? "").trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reference"],
      message: "La reference est obligatoire pour cette methode de paiement.",
    });
  }
});

type PaiementFormValues = z.infer<typeof paiementSchema>;
type PendingConfirmation = PaiementFormValues & {
  echeance_ids: string[];
};

const methodOptions = [
  { value: "cash", label: "Comptant / caisse" },
  { value: "mobile_money", label: "Mobile money" },
  { value: "virement", label: "Virement" },
  { value: "cheque", label: "Cheque" },
  { value: "bank", label: "Banque" },
] as const satisfies ReadonlyArray<{ value: PaymentMethod; label: string }>;

function normalizePaymentMethod(value?: string | null): PaymentMethod {
  const normalized = (value ?? "").trim().toLowerCase();
  return paymentMethodValues.includes(normalized as PaymentMethod)
    ? (normalized as PaymentMethod)
    : "cash";
}

function getReferenceHint(methode?: string | null) {
  switch (normalizePaymentMethod(methode)) {
    case "mobile_money":
      return "Saisis la reference de transaction Mobile Money.";
    case "virement":
      return "Saisis la reference du virement ou du bordereau bancaire.";
    case "cheque":
      return "Saisis le numero du cheque.";
    case "bank":
      return "Saisis la reference bancaire utile au rapprochement.";
    case "cash":
    default:
      return "Laisse vide pour generation automatique d'une reference caisse.";
  }
}

function getReferencePlaceholder(methode?: string | null) {
  switch (normalizePaymentMethod(methode)) {
    case "mobile_money":
      return "Ex: MVOLA-20260326-45821";
    case "virement":
      return "Ex: VIR-BNI-20260326-018";
    case "cheque":
      return "Ex: CHQ-001284";
    case "bank":
      return "Ex: BANK-20260326-0045";
    case "cash":
    default:
      return "Ex: CAISSE-20260326-0001";
  }
}

function formatCurrency(amount: number, devise: string) {
  return `${Number(amount ?? 0).toLocaleString("fr-FR")} ${devise}`;
}

function formatDate(value?: string | Date | null) {
  if (!value) return "Date non definie";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Date non definie";
  return date.toLocaleDateString("fr-FR");
}

function getStatusClasses(statut?: string | null) {
  switch ((statut ?? "").toUpperCase()) {
    case "PAYEE":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "PARTIELLE":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "EN_RETARD":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

function getStatusLabel(statut?: string | null) {
  switch ((statut ?? "").toUpperCase()) {
    case "PAYEE":
      return "Payee";
    case "PARTIELLE":
      return "Partielle";
    case "EN_RETARD":
      return "En retard";
    case "A_VENIR":
      return "A venir";
    case "EMISE":
      return "Emise";
    default:
      return statut ?? "Statut";
  }
}

function getQuickAmount(mode: "next" | "full", option?: PaiementFactureOption | null) {
  if (!option) return 0;
  if (mode === "full") return option.remaining;
  return option.nextDue?.montant_restant ?? option.suggestedAmount ?? option.remaining;
}

function InstallmentRow({
  echeance,
  devise,
  isNextDue,
  selected,
  onToggle,
  onPrioritize,
}: {
  echeance: PaiementInstallmentOption;
  devise: string;
  isNextDue: boolean;
  selected: boolean;
  onToggle: () => void;
  onPrioritize: () => void;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        selected
          ? "border-cyan-300 bg-cyan-50/80"
          : isNextDue
            ? "border-slate-900 bg-slate-50"
            : "border-slate-200 bg-slate-50/70"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={selected} onChange={onToggle} />
              <span>Selectionner</span>
            </label>
            <span className="text-sm font-semibold text-slate-900">
              Echeance {echeance.ordre}
            </span>
            {echeance.libelle ? (
              <span className="text-sm text-slate-500">{echeance.libelle}</span>
            ) : null}
            {isNextDue ? (
              <span className="rounded-full border border-slate-900 bg-slate-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                A regler
              </span>
            ) : null}
          </div>
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Echeance du {formatDate(echeance.date_echeance)}
          </p>
        </div>

        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${getStatusClasses(
            echeance.statut,
          )}`}
        >
          {getStatusLabel(echeance.statut)}
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Prevu
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {formatCurrency(echeance.montant_prevu, devise)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Regle
          </p>
          <p className="mt-1 text-sm font-semibold text-emerald-700">
            {formatCurrency(echeance.montant_regle, devise)}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Restant
          </p>
          <p className="mt-1 text-sm font-semibold text-rose-600">
            {formatCurrency(echeance.montant_restant, devise)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onPrioritize}
          className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
        >
          Regler cette echeance
        </button>
      </div>
    </div>
  );
}

export default function PaiementForm() {
  const { etablissement_id, user } = useAuth();
  const { info } = useInfo();
  const service = useMemo(() => new PaiementService(), []);

  const loading = usePaiementCreateStore((state) => state.loading);
  const errorMessage = usePaiementCreateStore((state) => state.errorMessage);
  const factureOptions = usePaiementCreateStore((state) => state.factureOptions);
  const initialData = usePaiementCreateStore((state) => state.initialData);
  const getOptions = usePaiementCreateStore((state) => state.getOptions);
  const [selectedEcheanceIds, setSelectedEcheanceIds] = useState<string[]>([]);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);

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
      methode: normalizePaymentMethod(initialData?.methode),
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

  const { control, formState, watch, setValue, reset, trigger } = form;
  const selectedFactureId = watch("facture_id");
  const selectedFacture = factureOptions.find((option) => option.value === selectedFactureId);
  const visibleInstallments = selectedFacture?.echeances.filter((echeance) => echeance.montant_restant > 0) ?? [];
  const selectedInstallments = useMemo(
    () => visibleInstallments.filter((item) => selectedEcheanceIds.includes(item.id)),
    [selectedEcheanceIds, visibleInstallments],
  );
  const selectedInstallmentsAmount = useMemo(
    () =>
      selectedInstallments.reduce(
        (sum, echeance) => sum + Number(echeance.montant_restant ?? 0),
        0,
      ),
    [selectedInstallments],
  );

  useEffect(() => {
    setSelectedEcheanceIds([]);
    setConfirmationOpen(false);
    setPendingConfirmation(null);
  }, [selectedFactureId]);

  useEffect(() => {
    if (selectedEcheanceIds.length > 0) {
      setValue("montant", Number(selectedInstallmentsAmount.toFixed(2)), {
        shouldValidate: true,
      });
    }
  }, [selectedEcheanceIds, selectedInstallmentsAmount, setValue]);

  const submitPayment = async (data: PendingConfirmation) => {
    try {
      const submittedFactureId = data.facture_id;
      await service.create({
        facture_id: data.facture_id,
        paye_le: data.paye_le,
        montant: Number(data.montant),
        methode: data.methode?.trim() || null,
        reference: data.reference?.trim() || null,
        recu_par: data.recu_par?.trim() || null,
        echeance_ids: data.echeance_ids,
      });
      info("Paiement enregistre avec succes !", "success");
      setConfirmationOpen(false);
      setPendingConfirmation(null);
      setSelectedEcheanceIds([]);
      if (etablissement_id) {
        await getOptions(etablissement_id);
      }
      const refreshedOptions = usePaiementCreateStore.getState().factureOptions;
      const refreshedCurrentFacture =
        refreshedOptions.find((option) => option.value === submittedFactureId) ??
        refreshedOptions[0];
      reset({
        facture_id: refreshedCurrentFacture?.value ?? "",
        paye_le: new Date().toISOString().slice(0, 10),
        montant:
          refreshedCurrentFacture?.suggestedAmount ??
          refreshedCurrentFacture?.remaining ??
          0,
        methode: "cash",
        reference: "",
        recu_par: user?.id ?? "",
      });
    } catch (error) {
      console.error("Erreur creation paiement", error);
      info("Le paiement n'a pas pu etre enregistre.", "error");
    }
  };

  const openConfirmation = async (payload: {
    echeance_ids: string[];
    montant: number;
    syncSelection?: boolean;
  }) => {
    const baseValid = await trigger(["facture_id", "paye_le"]);
    if (!baseValid) return;

    const currentValues = form.getValues();
    if (payload.syncSelection) {
      setSelectedEcheanceIds(payload.echeance_ids);
    }
    setValue("montant", Number(payload.montant.toFixed(2)), {
      shouldValidate: false,
    });
    setPendingConfirmation({
      ...currentValues,
      montant: Number(payload.montant.toFixed(2)),
      echeance_ids: payload.echeance_ids,
    });
    setConfirmationOpen(true);
  };

  const toggleEcheanceSelection = (echeanceId: string) => {
    setSelectedEcheanceIds((current) =>
      current.includes(echeanceId)
        ? current.filter((id) => id !== echeanceId)
        : [...current, echeanceId],
    );
  };

  const openPriorityPopup = (echeance: PaiementInstallmentOption) => {
    void openConfirmation({
      echeance_ids: [echeance.id],
      montant: Number(echeance.montant_restant.toFixed(2)),
      syncSelection: true,
    });
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

          <div className="space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 space-y-2">
                <h3 className="text-lg font-semibold text-slate-900">Nouveau paiement</h3>
                <p className="text-sm leading-6 text-slate-500">
                  Le paiement est automatiquement affecte aux echeances ouvertes de la facture, en commencant par les tranches les plus anciennes.
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
                            setValue("montant", option.suggestedAmount ?? option.remaining, {
                              shouldValidate: true,
                            });
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
              </div>

              {selectedFacture ? (
                <div className="mt-5 space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                      Facture selectionnee
                    </p>
                    <h4 className="text-base font-semibold text-slate-900">
                      {selectedFacture.numero_facture} - {selectedFacture.studentLabel}
                    </h4>
                    <p className="text-sm text-slate-500">
                      {selectedFacture.nextDue
                        ? `Prochaine echeance le ${formatDate(selectedFacture.nextDue.date_echeance)}`
                        : "Aucune echeance ouverte restante."}
                    </p>
                  </div>

                  <div className="sticky top-12 z-20 rounded-3xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/85">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={selectedInstallments.length === 0}
                        onClick={() =>
                          void openConfirmation({
                            echeance_ids: selectedEcheanceIds,
                            montant: Number(selectedInstallmentsAmount.toFixed(2)),
                          })
                        }
                        className="rounded-2xl border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-800 transition hover:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Valider la selection
                      </button>
                      <button
                        type="button"
                        disabled={!selectedFacture.nextDue}
                        onClick={() =>
                          selectedFacture.nextDue
                            ? void openConfirmation({
                                echeance_ids: [selectedFacture.nextDue.id],
                                montant: getQuickAmount("next", selectedFacture),
                                syncSelection: true,
                              })
                            : undefined
                        }
                        className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Prochaine echeance
                      </button>
                      <button
                        type="button"
                        disabled={visibleInstallments.length === 0}
                        onClick={() =>
                          visibleInstallments.length > 0
                            ? void openConfirmation({
                                echeance_ids: visibleInstallments.map((echeance) => echeance.id),
                                montant: getQuickAmount("full", selectedFacture),
                                syncSelection: true,
                              })
                            : undefined
                        }
                        className="rounded-2xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Tout solder
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Solde restant
                      </p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {formatCurrency(selectedFacture.remaining, selectedFacture.devise)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Montant conseille
                      </p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {formatCurrency(
                          selectedFacture.suggestedAmount,
                          selectedFacture.devise,
                        )}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Echeances en retard
                      </p>
                      <p className="mt-2 text-lg font-semibold text-rose-600">
                        {selectedFacture.overdueCount}
                      </p>
                    </div>
                  </div>

                  {visibleInstallments.length > 0 ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h5 className="text-sm font-semibold text-slate-900">Echeancier a regler</h5>
                          <p className="text-sm text-slate-500">
                            Le paiement sera ventile automatiquement sur ces tranches.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {visibleInstallments.map((echeance) => (
                          <InstallmentRow
                            key={echeance.id}
                            echeance={echeance}
                            devise={selectedFacture.devise}
                            isNextDue={selectedFacture.nextDue?.id === echeance.id}
                            selected={selectedEcheanceIds.includes(echeance.id)}
                            onToggle={() => toggleEcheanceSelection(echeance.id)}
                            onPrioritize={() => openPriorityPopup(echeance)}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

            </section>
          </div>

          <FlyPopup
            isOpen={confirmationOpen}
            setIsOpen={setConfirmationOpen}
            title="Confirmation du paiement"
          >
            <div className="flex max-h-[72vh] flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                <div className="space-y-2">
                  <p className="text-sm text-slate-600">
                    Choisis le mode de paiement et complete la reference si elle existe.
                  </p>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <p>
                      <span className="font-semibold text-slate-900">Montant:</span>{" "}
                      {formatCurrency(
                        pendingConfirmation?.montant ?? 0,
                        selectedFacture?.devise ?? "MGA",
                      )}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-900">Facture:</span>{" "}
                      {selectedFacture?.numero_facture ?? "Non renseignee"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4">
                  <FieldWrapper
                    id="popup_methode"
                    label="Mode de paiement"
                    error={formState.errors.methode?.message}
                    description="Le mode choisi determine si une reference externe est attendue."
                  >
                    <select
                    id="popup_methode"
                    value={normalizePaymentMethod(pendingConfirmation?.methode)}
                    onChange={(event) => {
                      const methode = normalizePaymentMethod(event.target.value);
                      setPendingConfirmation((current) =>
                        current
                          ? {
                                ...current,
                                methode,
                              }
                            : current,
                        );
                        setValue("methode", methode, { shouldValidate: true });
                      }}
                      className={getInputClassName(false)}
                    >
                      {methodOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FieldWrapper>

                  <FieldWrapper
                    id="popup_reference"
                    label="Reference"
                    error={formState.errors.reference?.message}
                    description={getReferenceHint(pendingConfirmation?.methode)}
                  >
                    <input
                      id="popup_reference"
                      type="text"
                      value={pendingConfirmation?.reference ?? ""}
                      onChange={(event) => {
                        const reference = event.target.value;
                        setPendingConfirmation((current) =>
                          current
                            ? {
                                ...current,
                                reference,
                              }
                            : current,
                        );
                        setValue("reference", reference, { shouldValidate: true });
                      }}
                      placeholder={getReferencePlaceholder(pendingConfirmation?.methode)}
                      className={getInputClassName(false)}
                    />
                  </FieldWrapper>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900">
                    Echeances concernees
                  </p>
                  <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
                    {(pendingConfirmation?.echeance_ids?.length
                      ? visibleInstallments.filter((item) =>
                          pendingConfirmation.echeance_ids.includes(item.id),
                        )
                      : selectedFacture?.nextDue
                        ? [selectedFacture.nextDue]
                        : []
                    ).map((echeance) => (
                      <div
                        key={echeance.id}
                        className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-slate-900">
                            {echeance.libelle || `Echeance ${echeance.ordre}`}
                          </span>
                          <span>{formatCurrency(echeance.montant_restant, selectedFacture?.devise ?? "MGA")}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Echeance du {formatDate(echeance.date_echeance)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-3 border-t border-slate-200 bg-white pt-4">
                <button
                  type="button"
                  onClick={() => setConfirmationOpen(false)}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
                >
                  Retour
                </button>
                <button
                  type="button"
                  disabled={!pendingConfirmation || formState.isSubmitting}
                  onClick={async () => {
                    const valid = await trigger(["methode", "reference"]);
                    if (valid && pendingConfirmation) {
                      await submitPayment(pendingConfirmation);
                    }
                  }}
                  className="rounded-2xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {formState.isSubmitting ? "Enregistrement..." : "Confirmer le paiement"}
                </button>
              </div>
            </div>
          </FlyPopup>
        </div>
      )}
    </div>
  );
}
