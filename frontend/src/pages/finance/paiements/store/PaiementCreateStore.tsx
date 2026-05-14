import { create } from "zustand";
import FactureService, { type FactureWithRelations } from "../../../../services/facture.service";

export type PaiementInstallmentOption = {
  id: string;
  ordre: number;
  libelle?: string | null;
  date_echeance: string | Date;
  montant_prevu: number;
  montant_regle: number;
  montant_restant: number;
  statut: string;
  devise?: string | null;
};

export type PaiementFactureOption = {
  value: string;
  label: string;
  remaining: number;
  devise: string;
  numero_facture: string;
  studentLabel: string;
  echeances: PaiementInstallmentOption[];
  overdueCount: number;
  suggestedAmount: number;
  nextDue: PaiementInstallmentOption | null;
};

type State = {
  loading: boolean;
  errorMessage: string;
  factureOptions: PaiementFactureOption[];
  initialData: {
    facture_id?: string;
    paye_le?: string;
    montant?: number;
    methode?: string;
    reference?: string;
    payeur_type?: string;
    payeur_nom?: string;
    payeur_reference?: string;
    justificatif_reference?: string;
    justificatif_url?: string;
    justificatif_note?: string;
    recu_par?: string;
  } | null;
  setInitialData: (value: State["initialData"]) => void;
  getOptions: (etablissement_id: string) => Promise<void>;
};

function toRoundedAmount(value: number) {
  return Math.max(0, Math.round(Number(value || 0) * 100) / 100);
}

function toIsoDate(value?: string | Date | null) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function sortInstallments(a: PaiementInstallmentOption, b: PaiementInstallmentOption) {
  const orderDiff = Number(a.ordre ?? 0) - Number(b.ordre ?? 0);
  if (orderDiff !== 0) return orderDiff;
  return toIsoDate(a.date_echeance).localeCompare(toIsoDate(b.date_echeance));
}

function buildFactureOption(facture: FactureWithRelations): PaiementFactureOption {
  const prenom = facture.eleve?.utilisateur?.profil?.prenom?.trim() ?? "";
  const nom = facture.eleve?.utilisateur?.profil?.nom?.trim() ?? "";
  const fullName = [prenom, nom].filter(Boolean).join(" ").trim();
  const activePaiements = (facture.paiements ?? []).filter(
    (payment) => (payment.statut ?? "ENREGISTRE").toUpperCase() === "ENREGISTRE",
  );
  const paidAmount = activePaiements.reduce(
    (sum, payment) => sum + Number(payment.montant ?? 0),
    0,
  );
  const total = toRoundedAmount(Number(facture.total_montant ?? 0));
  const studentLabel = fullName || facture.eleve?.code_eleve || "Eleve";
  const today = new Date().toISOString().slice(0, 10);

  const echeances = [...(facture.echeances ?? [])]
    .map((echeance) => ({
      ...echeance,
      montant_prevu: toRoundedAmount(Number(echeance.montant_prevu ?? 0)),
      montant_regle: toRoundedAmount(Number(echeance.montant_regle ?? 0)),
      montant_restant: toRoundedAmount(Number(echeance.montant_restant ?? 0)),
    }))
    .sort(sortInstallments);

  const unpaid = echeances.filter((echeance) => echeance.montant_restant > 0);
  const remaining = unpaid.length > 0
    ? toRoundedAmount(unpaid.reduce((sum, echeance) => sum + echeance.montant_restant, 0))
    : toRoundedAmount(total - paidAmount);
  const overdueCount = unpaid.filter(
    (echeance) => toIsoDate(echeance.date_echeance) && toIsoDate(echeance.date_echeance) < today,
  ).length;
  const nextDue = unpaid[0] ?? null;
  const suggestedAmount = nextDue ? nextDue.montant_restant : remaining;
  const nextDueLabel = nextDue
    ? ` - echeance ${nextDue.ordre} : ${nextDue.montant_restant.toLocaleString("fr-FR")} ${facture.devise ?? "MGA"}`
    : "";

  return {
    value: facture.id,
    label: `${facture.numero_facture} - ${studentLabel} - reste ${remaining.toLocaleString("fr-FR")} ${facture.devise ?? "MGA"}${nextDueLabel}`,
    remaining,
    devise: facture.devise ?? "MGA",
    numero_facture: facture.numero_facture,
    studentLabel,
    echeances,
    overdueCount,
    suggestedAmount,
    nextDue,
  };
}

export const usePaiementCreateStore = create<State>((set, get) => ({
  loading: false,
  errorMessage: "",
  factureOptions: [],
  initialData: null,
  setInitialData: (value) => set({ initialData: value }),
  getOptions: async (etablissement_id: string) => {
    set({ loading: true, errorMessage: "" });
    try {
      const factureService = new FactureService();
      const result = await factureService.getForEtablissement(etablissement_id, {
        take: 1000,
        includeSpec: JSON.stringify({
          eleve: { include: { utilisateur: { include: { profil: true } } } },
          paiements: true,
          echeances: { include: { affectations: true } },
          annee: true,
        }),
        orderBy: JSON.stringify([{ date_emission: "desc" }, { created_at: "desc" }]),
      });

      if (result?.status.success) {
        const rows = (result.data.data as FactureWithRelations[]) ?? [];
        const options = rows
          .map((facture) => buildFactureOption(facture))
          .filter((item) => item.remaining > 0);
        const existingInitialData = get().initialData;
        const preferredOption = options.find((item) => item.value === existingInitialData?.facture_id) ?? options[0];

        set({
          factureOptions: options,
          initialData: {
            facture_id: preferredOption?.value ?? existingInitialData?.facture_id ?? "",
            paye_le: existingInitialData?.paye_le ?? new Date().toISOString().slice(0, 10),
            montant:
              existingInitialData?.montant != null
                ? existingInitialData.montant
                : preferredOption?.suggestedAmount ?? preferredOption?.remaining ?? 0,
            methode: existingInitialData?.methode ?? "cash",
            reference: existingInitialData?.reference ?? "",
            payeur_type: existingInitialData?.payeur_type ?? "",
            payeur_nom: existingInitialData?.payeur_nom ?? "",
            payeur_reference: existingInitialData?.payeur_reference ?? "",
            justificatif_reference: existingInitialData?.justificatif_reference ?? "",
            justificatif_url: existingInitialData?.justificatif_url ?? "",
            justificatif_note: existingInitialData?.justificatif_note ?? "",
            recu_par: existingInitialData?.recu_par ?? "",
          },
        });
      }
    } catch {
      set({
        errorMessage: "Impossible de charger les factures disponibles pour les paiements.",
      });
    } finally {
      set({ loading: false });
    }
  },
}));
