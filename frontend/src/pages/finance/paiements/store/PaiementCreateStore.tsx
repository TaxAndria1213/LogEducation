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
    recu_par?: string;
  } | null;
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
  const paidAmount = (facture.paiements ?? []).reduce(
    (sum, payment) => sum + Number(payment.montant ?? 0),
    0,
  );
  const total = toRoundedAmount(Number(facture.total_montant ?? 0));
  const remaining = toRoundedAmount(total - paidAmount);
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

export const usePaiementCreateStore = create<State>((set) => ({
  loading: false,
  errorMessage: "",
  factureOptions: [],
  initialData: null,
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

        set({
          factureOptions: options,
          initialData: {
            facture_id: options[0]?.value ?? "",
            paye_le: new Date().toISOString().slice(0, 10),
            montant: options[0]?.suggestedAmount ?? options[0]?.remaining ?? 0,
            methode: "cash",
            reference: "",
            recu_par: "",
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
