import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FieldWrapper } from "../../../../../components/Form/fields/FieldWrapper";
import { getInputClassName } from "../../../../../components/Form/fields/inputStyles";
import Spin from "../../../../../components/anim/Spin";
import FlyPopup from "../../../../../components/popup/FlyPopup";
import PaiementService, {
  type PaiementWithRelations,
} from "../../../../../services/paiement.service";
import { useAuth } from "../../../../../auth/AuthContext";
import { useInfo } from "../../../../../hooks/useInfo";
import {
  buildPaiementReceiptPdf,
  downloadPdf,
  previewPdf,
} from "../../../utils/financePdf";
import {
  usePaiementCreateStore,
  type PaiementFactureOption,
  type PaiementInstallmentOption,
} from "../../store/PaiementCreateStore";

const paymentMethodValues = ["cash", "mobile_money", "virement", "cheque", "bank", "card"] as const;
type PaymentMethod = (typeof paymentMethodValues)[number];
const payerTypeValues = ["ELEVE", "PARENT_TUTEUR", "SPONSOR", "EMPLOYEUR", "AUTRE"] as const;
type PayerType = (typeof payerTypeValues)[number];

const paiementSchema = z.object({
  facture_id: z.string().min(1, "La facture est requise."),
  paye_le: z.string().min(1, "La date du paiement est requise."),
  montant: z.number().positive("Le montant doit etre strictement positif."),
  methode: z.string().trim().optional(),
  reference: z.string().trim().optional(),
  payeur_type: z.string().trim().optional(),
  payeur_nom: z.string().trim().optional(),
  payeur_reference: z.string().trim().optional(),
  justificatif_reference: z.string().trim().optional(),
  justificatif_url: z.string().trim().optional(),
  justificatif_note: z.string().trim().optional(),
  recu_par: z.string().trim().optional(),
}).superRefine((data, ctx) => {
  const methode = (data.methode ?? "").trim().toLowerCase();
  const needsReference = ["mobile_money", "mobile", "virement", "cheque", "bank", "card"].includes(methode);

  if (needsReference && !(data.reference ?? "").trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reference"],
      message: "La reference est obligatoire pour cette methode de paiement.",
    });
  }

  if ((data.payeur_type ?? "").trim() && !(data.payeur_nom ?? "").trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["payeur_nom"],
      message: "Le nom du payeur est requis quand un tiers payeur est renseigne.",
    });
  }
});

type PaiementFormValues = z.infer<typeof paiementSchema>;
type PendingConfirmation = PaiementFormValues & {
  echeance_ids: string[];
  montant_base: number;
  penalite_retard: number;
  motif_penalite: string;
};
type PaymentSplitDraft = {
  id: string;
  methode: PaymentMethod;
  montant: number;
  reference: string;
};

const methodOptions = [
  { value: "cash", label: "Comptant / caisse" },
  { value: "mobile_money", label: "Mobile money" },
  { value: "virement", label: "Virement" },
  { value: "cheque", label: "Cheque" },
  { value: "bank", label: "Banque" },
  { value: "card", label: "Carte bancaire" },
] as const satisfies ReadonlyArray<{ value: PaymentMethod; label: string }>;

const payerTypeOptions = [
  { value: "ELEVE", label: "Eleve" },
  { value: "PARENT_TUTEUR", label: "Parent / tuteur" },
  { value: "SPONSOR", label: "Sponsor" },
  { value: "EMPLOYEUR", label: "Employeur" },
  { value: "AUTRE", label: "Autre" },
] as const satisfies ReadonlyArray<{ value: PayerType; label: string }>;

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
    case "card":
      return "Saisis la reference du ticket ou de la transaction carte.";
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
    case "card":
      return "Ex: CARD-20260326-0045";
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

function toDateKey(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
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

function buildSplitDraft(
  montant: number,
  methode: PaymentMethod = "cash",
  reference = "",
): PaymentSplitDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    montant: Number(montant.toFixed(2)),
    methode,
    reference,
  };
}

function isExternalReferenceRequired(methode: PaymentMethod) {
  return ["mobile_money", "virement", "cheque", "bank", "card"].includes(methode);
}

function openGeneratedReceipt(
  paiement: PaiementWithRelations | PaiementWithRelations[],
  info: (message: string, type?: "success" | "error" | "info" | "warning") => void,
) {
  const { doc, filename } = buildPaiementReceiptPdf(paiement);
  const opened = previewPdf(doc, false);

  if (!opened) {
    downloadPdf(doc, filename);
    info("Le recu a ete telecharge juste apres l'encaissement.", "warning");
    return;
  }

  info("Le recu du paiement a ete ouvert.", "success");
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
  const [useMixedPayment, setUseMixedPayment] = useState(false);
  const [mixedDrafts, setMixedDrafts] = useState<PaymentSplitDraft[]>([]);

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
      payeur_type: initialData?.payeur_type ?? "",
      payeur_nom: initialData?.payeur_nom ?? "",
      payeur_reference: initialData?.payeur_reference ?? "",
      justificatif_reference: "",
      justificatif_url: "",
      justificatif_note: "",
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
  const pendingInstallments = useMemo(
    () =>
      pendingConfirmation?.echeance_ids?.length
        ? visibleInstallments.filter((item) => pendingConfirmation.echeance_ids.includes(item.id))
        : selectedFacture?.nextDue
          ? [selectedFacture.nextDue]
          : [],
    [pendingConfirmation?.echeance_ids, selectedFacture?.nextDue, visibleInstallments],
  );
  const hasPendingOverdueInstallments = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return pendingInstallments.some(
      (item) => toDateKey(item.date_echeance) && toDateKey(item.date_echeance) < today,
    );
  }, [pendingInstallments]);
  const mixedDraftTotal = useMemo(
    () => Number(mixedDrafts.reduce((sum, item) => sum + Number(item.montant || 0), 0).toFixed(2)),
    [mixedDrafts],
  );
  const pendingTotalAmount = useMemo(
    () =>
      Number(
        (
          Number(pendingConfirmation?.montant_base ?? pendingConfirmation?.montant ?? 0) +
          Number(pendingConfirmation?.penalite_retard ?? 0)
        ).toFixed(2),
      ),
    [pendingConfirmation?.montant, pendingConfirmation?.montant_base, pendingConfirmation?.penalite_retard],
  );
  const pendingOverpaymentAmount = useMemo(
    () => Number(Math.max(0, pendingConfirmation?.montant ?? 0 - pendingTotalAmount).toFixed(2)),
    [pendingConfirmation?.montant, pendingTotalAmount],
  );

  useEffect(() => {
    setSelectedEcheanceIds([]);
    setConfirmationOpen(false);
    setPendingConfirmation(null);
    setUseMixedPayment(false);
    setMixedDrafts([]);
  }, [selectedFactureId]);

  useEffect(() => {
    if (selectedEcheanceIds.length > 0) {
      setValue("montant", Number(selectedInstallmentsAmount.toFixed(2)), {
        shouldValidate: true,
      });
    }
  }, [selectedEcheanceIds, selectedInstallmentsAmount, setValue]);

  useEffect(() => {
    if (!useMixedPayment || mixedDrafts.length === 0) return;
    setMixedDrafts((current) => {
      const total = Number(
        current.reduce((sum, item) => sum + Number(item.montant || 0), 0).toFixed(2),
      );
      const difference = Number((pendingTotalAmount - total).toFixed(2));
      if (Math.abs(difference) <= 0.009) return current;
      const lastIndex = current.length - 1;
      return current.map((item, index) =>
        index === lastIndex
          ? {
              ...item,
              montant: Number(Math.max(0, item.montant + difference).toFixed(2)),
            }
          : item,
      );
    });
  }, [mixedDrafts.length, pendingTotalAmount, useMixedPayment]);

  const submitPayment = async (data: PendingConfirmation) => {
    try {
      const submittedFactureId = data.facture_id;
      const dueAmount = Number((data.montant_base + data.penalite_retard).toFixed(2));
      const receivedAmount = Number(data.montant.toFixed(2));
      const response = await service.create({
        facture_id: data.facture_id,
        paye_le: data.paye_le,
        montant: receivedAmount,
        methode: data.methode?.trim() || null,
        reference: data.reference?.trim() || null,
        payeur_type: data.payeur_type?.trim() || null,
        payeur_nom: data.payeur_nom?.trim() || null,
        payeur_reference: data.payeur_reference?.trim() || null,
        justificatif_reference: data.justificatif_reference?.trim() || null,
        justificatif_url: data.justificatif_url?.trim() || null,
        justificatif_note: data.justificatif_note?.trim() || null,
        recu_par: data.recu_par?.trim() || null,
        echeance_ids: data.echeance_ids,
        penalite_retard: data.penalite_retard > 0 ? Number(data.penalite_retard) : 0,
        trop_percu: Math.max(0, Number((receivedAmount - dueAmount).toFixed(2))),
        motif_trop_percu:
          receivedAmount > dueAmount ? "Trop-percu enregistre lors de l'encaissement." : null,
        motif_penalite: data.motif_penalite?.trim() || null,
      });
      openGeneratedReceipt(response.data as PaiementWithRelations, info);
      setConfirmationOpen(false);
      setPendingConfirmation(null);
      setSelectedEcheanceIds([]);
      setUseMixedPayment(false);
      setMixedDrafts([]);
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
        payeur_type: "",
        payeur_nom: "",
        payeur_reference: "",
        justificatif_reference: "",
        justificatif_url: "",
        justificatif_note: "",
        recu_par: user?.id ?? "",
      });
    } catch (error) {
      console.error("Erreur creation paiement", error);
      info("Le paiement n'a pas pu etre enregistre.", "error");
    }
  };

  const submitMixedPayment = async (data: PendingConfirmation) => {
    try {
      const submittedFactureId = data.facture_id;
      const dueAmount = Number((data.montant_base + data.penalite_retard).toFixed(2));
      const receivedAmount = Number(mixedDraftTotal.toFixed(2));
      const response = await service.createMixed({
        facture_id: data.facture_id,
        paye_le: data.paye_le,
        recu_par: data.recu_par?.trim() || null,
        payeur_type: data.payeur_type?.trim() || null,
        payeur_nom: data.payeur_nom?.trim() || null,
        payeur_reference: data.payeur_reference?.trim() || null,
        justificatif_reference: data.justificatif_reference?.trim() || null,
        justificatif_url: data.justificatif_url?.trim() || null,
        justificatif_note: data.justificatif_note?.trim() || null,
        echeance_ids: data.echeance_ids,
        montant: receivedAmount,
        penalite_retard: data.penalite_retard > 0 ? Number(data.penalite_retard) : 0,
        trop_percu: Math.max(0, Number((receivedAmount - dueAmount).toFixed(2))),
        motif_trop_percu:
          receivedAmount > dueAmount ? "Trop-percu enregistre lors de l'encaissement mixte." : null,
        motif_penalite: data.motif_penalite?.trim() || null,
        splits: mixedDrafts.map((item) => ({
          montant: Number(item.montant),
          methode: item.methode,
          reference: item.reference?.trim() || null,
        })),
      });
      openGeneratedReceipt(response.data as PaiementWithRelations[], info);
      setConfirmationOpen(false);
      setPendingConfirmation(null);
      setSelectedEcheanceIds([]);
      setUseMixedPayment(false);
      setMixedDrafts([]);
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
        payeur_type: "",
        payeur_nom: "",
        payeur_reference: "",
        justificatif_reference: "",
        justificatif_url: "",
        justificatif_note: "",
        recu_par: user?.id ?? "",
      });
    } catch (error) {
      console.error("Erreur creation paiement mixte", error);
      info("Le paiement mixte n'a pas pu etre enregistre.", "error");
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
      montant_base: Number(payload.montant.toFixed(2)),
      echeance_ids: payload.echeance_ids,
      penalite_retard: 0,
      motif_penalite: "",
    });
    setUseMixedPayment(false);
    setMixedDrafts([
      buildSplitDraft(
        Number(payload.montant.toFixed(2)),
        normalizePaymentMethod(currentValues.methode),
        currentValues.reference ?? "",
      ),
    ]);
    setConfirmationOpen(true);
  };

  const updateSplitDraft = (
    splitId: string,
    patch: Partial<Omit<PaymentSplitDraft, "id">>,
  ) => {
    setMixedDrafts((current) =>
      current.map((item) =>
        item.id === splitId
          ? {
              ...item,
              ...patch,
            }
          : item,
      ),
    );
  };

  const addSplitDraft = () => {
    setMixedDrafts((current) => [...current, buildSplitDraft(0)]);
  };

  const removeSplitDraft = (splitId: string) => {
    setMixedDrafts((current) => current.filter((item) => item.id !== splitId));
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
                    Choisis le mode de paiement ou ventile le reglement si la famille paie avec plusieurs moyens.
                  </p>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <p>
                      <span className="font-semibold text-slate-900">Montant principal:</span>{" "}
                      {formatCurrency(
                        pendingConfirmation?.montant_base ?? pendingConfirmation?.montant ?? 0,
                        selectedFacture?.devise ?? "MGA",
                      )}
                    </p>
                    {(pendingConfirmation?.penalite_retard ?? 0) > 0 ? (
                      <p>
                        <span className="font-semibold text-slate-900">Penalite de retard:</span>{" "}
                        {formatCurrency(
                          pendingConfirmation?.penalite_retard ?? 0,
                          selectedFacture?.devise ?? "MGA",
                        )}
                      </p>
                    ) : null}
                    <p>
                      <span className="font-semibold text-slate-900">Total a encaisser:</span>{" "}
                      {formatCurrency(pendingTotalAmount, selectedFacture?.devise ?? "MGA")}
                    </p>
                    {(pendingOverpaymentAmount ?? 0) > 0 ? (
                      <p>
                        <span className="font-semibold text-slate-900">Trop-percu enregistre:</span>{" "}
                        {formatCurrency(pendingOverpaymentAmount, selectedFacture?.devise ?? "MGA")}
                      </p>
                    ) : null}
                    <p>
                      <span className="font-semibold text-slate-900">Facture:</span>{" "}
                      {selectedFacture?.numero_facture ?? "Non renseignee"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <label className="inline-flex items-center gap-3 text-sm font-medium text-slate-800">
                      <input
                        type="checkbox"
                        checked={useMixedPayment}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setUseMixedPayment(checked);
                          if (checked && mixedDrafts.length < 2) {
                            const total = pendingTotalAmount > 0 ? pendingTotalAmount : 0;
                            const firstAmount = Number((total / 2).toFixed(2));
                            const secondAmount = Number((total - firstAmount).toFixed(2));
                            setMixedDrafts([
                              buildSplitDraft(firstAmount, normalizePaymentMethod(pendingConfirmation?.methode), pendingConfirmation?.reference ?? ""),
                              buildSplitDraft(secondAmount),
                            ]);
                          }
                        }}
                      />
                      <span>Encaissement mixte</span>
                    </label>
                    <p className="mt-2 text-xs text-slate-500">
                      Active cette option si le parent paie cette meme facture avec plusieurs moyens.
                    </p>
                  </div>

                  {!useMixedPayment ? (
                    <>
                  <FieldWrapper
                    id="popup_montant_recu"
                    label="Montant recu"
                    description="Tu peux saisir un montant superieur pour enregistrer un trop-percu reutilisable plus tard."
                  >
                    <input
                      id="popup_montant_recu"
                      type="number"
                      min="0"
                      step="0.01"
                      value={pendingConfirmation?.montant ?? 0}
                      onChange={(event) => {
                        const montant = Number(event.target.value || 0);
                        setPendingConfirmation((current) =>
                          current
                            ? {
                                ...current,
                                montant,
                              }
                            : current,
                        );
                      }}
                      className={getInputClassName(false)}
                    />
                  </FieldWrapper>

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
                    </>
                  ) : (
                    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Lignes de paiement</p>
                          <p className="text-xs text-slate-500">
                            Le total des lignes doit correspondre au total a encaisser.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={addSplitDraft}
                          className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
                        >
                          Ajouter une ligne
                        </button>
                      </div>

                      <div className="space-y-3">
                        {mixedDrafts.map((draft, index) => (
                          <div key={draft.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <p className="text-sm font-semibold text-slate-900">Ligne {index + 1}</p>
                              {mixedDrafts.length > 2 ? (
                                <button
                                  type="button"
                                  onClick={() => removeSplitDraft(draft.id)}
                                  className="text-xs font-semibold text-rose-600 transition hover:text-rose-700"
                                >
                                  Supprimer
                                </button>
                              ) : null}
                            </div>
                            <div className="grid gap-3 md:grid-cols-3">
                              <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Mode
                                </label>
                                <select
                                  value={draft.methode}
                                  onChange={(event) =>
                                    updateSplitDraft(draft.id, {
                                      methode: normalizePaymentMethod(event.target.value),
                                    })
                                  }
                                  className={getInputClassName(false)}
                                >
                                  {methodOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Montant
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={draft.montant}
                                  onChange={(event) =>
                                    updateSplitDraft(draft.id, {
                                      montant: Number(event.target.value || 0),
                                    })
                                  }
                                  className={getInputClassName(false)}
                                />
                              </div>
                              <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  Reference
                                </label>
                                <input
                                  type="text"
                                  value={draft.reference}
                                  onChange={(event) =>
                                    updateSplitDraft(draft.id, {
                                      reference: event.target.value,
                                    })
                                  }
                                  placeholder={getReferencePlaceholder(draft.methode)}
                                  className={getInputClassName(false)}
                                />
                              </div>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                              {getReferenceHint(draft.methode)}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-700">
                        Total des lignes:{" "}
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(mixedDraftTotal, selectedFacture?.devise ?? "MGA")}
                        </span>
                      </div>
                    </div>
                  )}

                  <FieldWrapper
                    id="popup_payeur_type"
                    label="Qui paie ?"
                    description="Renseigne le type de payeur pour renforcer la tracabilite."
                  >
                    <select
                      id="popup_payeur_type"
                      value={pendingConfirmation?.payeur_type ?? ""}
                      onChange={(event) => {
                        const payeur_type = event.target.value;
                        setPendingConfirmation((current) =>
                          current ? { ...current, payeur_type } : current,
                        );
                        setValue("payeur_type", payeur_type, { shouldValidate: true });
                      }}
                      className={getInputClassName(false)}
                    >
                      <option value="">Payeur non precise</option>
                      {payerTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </FieldWrapper>

                  <FieldWrapper
                    id="popup_payeur_nom"
                    label="Nom du payeur"
                    error={formState.errors.payeur_nom?.message}
                    description="Utile si le paiement vient d'un parent, sponsor, employeur ou autre tiers."
                  >
                    <input
                      id="popup_payeur_nom"
                      type="text"
                      value={pendingConfirmation?.payeur_nom ?? ""}
                      onChange={(event) => {
                        const payeur_nom = event.target.value;
                        setPendingConfirmation((current) =>
                          current ? { ...current, payeur_nom } : current,
                        );
                        setValue("payeur_nom", payeur_nom, { shouldValidate: true });
                      }}
                      placeholder="Ex: Rakoto Rachelle"
                      className={getInputClassName(false)}
                    />
                  </FieldWrapper>

                  <FieldWrapper
                    id="popup_payeur_reference"
                    label="Reference payeur"
                    description="Ex: matricule employeur, code sponsor, numero dossier."
                  >
                    <input
                      id="popup_payeur_reference"
                      type="text"
                      value={pendingConfirmation?.payeur_reference ?? ""}
                      onChange={(event) => {
                        const payeur_reference = event.target.value;
                        setPendingConfirmation((current) =>
                          current ? { ...current, payeur_reference } : current,
                        );
                        setValue("payeur_reference", payeur_reference, { shouldValidate: true });
                      }}
                      placeholder="Ex: SPONSOR-2026-014"
                      className={getInputClassName(false)}
                    />
                  </FieldWrapper>

                  <FieldWrapper
                    id="popup_justificatif_reference"
                    label="Reference justificatif"
                    description="Ex: numero de bordereau, ticket, bordereau banque ou code archive."
                  >
                    <input
                      id="popup_justificatif_reference"
                      type="text"
                      value={pendingConfirmation?.justificatif_reference ?? ""}
                      onChange={(event) => {
                        const justificatif_reference = event.target.value;
                        setPendingConfirmation((current) =>
                          current ? { ...current, justificatif_reference } : current,
                        );
                        setValue("justificatif_reference", justificatif_reference, { shouldValidate: true });
                      }}
                      placeholder="Ex: BORD-2026-0092"
                      className={getInputClassName(false)}
                    />
                  </FieldWrapper>

                  <FieldWrapper
                    id="popup_justificatif_url"
                    label="URL / chemin justificatif"
                    description="Tu peux conserver ici l'emplacement du document numerise."
                  >
                    <input
                      id="popup_justificatif_url"
                      type="text"
                      value={pendingConfirmation?.justificatif_url ?? ""}
                      onChange={(event) => {
                        const justificatif_url = event.target.value;
                        setPendingConfirmation((current) =>
                          current ? { ...current, justificatif_url } : current,
                        );
                        setValue("justificatif_url", justificatif_url, { shouldValidate: true });
                      }}
                      placeholder="Ex: /documents/encaissements/recu-014.pdf"
                      className={getInputClassName(false)}
                    />
                  </FieldWrapper>

                  <FieldWrapper
                    id="popup_justificatif_note"
                    label="Note justificatif"
                  >
                    <input
                      id="popup_justificatif_note"
                      type="text"
                      value={pendingConfirmation?.justificatif_note ?? ""}
                      onChange={(event) => {
                        const justificatif_note = event.target.value;
                        setPendingConfirmation((current) =>
                          current ? { ...current, justificatif_note } : current,
                        );
                        setValue("justificatif_note", justificatif_note, { shouldValidate: true });
                      }}
                      placeholder="Ex: capture Mobile Money verifiee"
                      className={getInputClassName(false)}
                    />
                  </FieldWrapper>

                  {hasPendingOverdueInstallments ? (
                    <>
                      <FieldWrapper
                        id="popup_penalite_retard"
                        label="Penalite de retard"
                        description="Ajoute une penalite exceptionnelle a regler immediatement avec ce paiement."
                      >
                        <input
                          id="popup_penalite_retard"
                          type="number"
                          min="0"
                          step="0.01"
                          value={pendingConfirmation?.penalite_retard ?? 0}
                          onChange={(event) =>
                            setPendingConfirmation((current) =>
                              current
                                ? {
                                    ...current,
                                    penalite_retard: Number(event.target.value || 0),
                                  }
                                : current,
                            )
                          }
                          className={getInputClassName(false)}
                        />
                      </FieldWrapper>

                      <FieldWrapper
                        id="popup_motif_penalite"
                        label="Motif de la penalite"
                      >
                        <input
                          id="popup_motif_penalite"
                          type="text"
                          value={pendingConfirmation?.motif_penalite ?? ""}
                          onChange={(event) =>
                            setPendingConfirmation((current) =>
                              current
                                ? {
                                    ...current,
                                    motif_penalite: event.target.value,
                                  }
                                : current,
                            )
                          }
                          placeholder="Ex: retard au-dela du delai accorde"
                          className={getInputClassName(false)}
                        />
                      </FieldWrapper>
                    </>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-900">
                    Echeances concernees
                  </p>
                  <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
                    {pendingInstallments.map((echeance) => (
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
                    const valid = await trigger(
                      useMixedPayment ? ["payeur_nom"] : ["methode", "reference", "payeur_nom"],
                    );
                    if (!valid || !pendingConfirmation) {
                      return;
                    }

                    if (useMixedPayment) {
                      if (mixedDrafts.length < 2) {
                        info("Ajoute au moins deux lignes pour un paiement mixte.", "error");
                        return;
                      }
                      const invalidSplit = mixedDrafts.find(
                        (item) =>
                          Number(item.montant) <= 0 ||
                          (isExternalReferenceRequired(item.methode) && !item.reference.trim()),
                      );
                      if (invalidSplit) {
                        info("Chaque ligne mixte doit avoir un montant positif et sa reference si elle est obligatoire.", "error");
                        return;
                      }
                      if (mixedDraftTotal <= 0) {
                        info("Le total des lignes mixtes doit etre strictement positif.", "error");
                        return;
                      }
                      await submitMixedPayment(pendingConfirmation);
                      return;
                    }
                    await submitPayment(pendingConfirmation);
                  }}
                  className="rounded-2xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {formState.isSubmitting
                    ? "Enregistrement..."
                    : useMixedPayment
                      ? "Confirmer le paiement mixte"
                      : "Confirmer le paiement"}
                </button>
              </div>
            </div>
          </FlyPopup>
        </div>
      )}
    </div>
  );
}
