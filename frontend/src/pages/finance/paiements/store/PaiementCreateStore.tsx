import { create } from "zustand";
import FactureService, { type FactureWithRelations } from "../../../../services/facture.service";

type Option = {
  value: string;
  label: string;
  remaining: number;
  devise: string;
};

type State = {
  loading: boolean;
  errorMessage: string;
  factureOptions: Option[];
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

function buildFactureLabel(facture: FactureWithRelations) {
  const prenom = facture.eleve?.utilisateur?.profil?.prenom?.trim() ?? "";
  const nom = facture.eleve?.utilisateur?.profil?.nom?.trim() ?? "";
  const fullName = [prenom, nom].filter(Boolean).join(" ").trim();
  const paidAmount = (facture.paiements ?? []).reduce(
    (sum, payment) => sum + Number(payment.montant ?? 0),
    0,
  );
  const total = Number(facture.total_montant ?? 0);
  const remaining = Math.max(0, Math.round((total - paidAmount) * 100) / 100);
  const studentLabel = fullName || facture.eleve?.code_eleve || "Eleve";
  return {
    label: `${facture.numero_facture} - ${studentLabel} - reste ${remaining.toLocaleString("fr-FR")} ${facture.devise ?? "MGA"}`,
    remaining,
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
          annee: true,
        }),
        orderBy: JSON.stringify([{ date_emission: "desc" }, { created_at: "desc" }]),
      });

      if (result?.status.success) {
        const rows = (result.data.data as FactureWithRelations[]) ?? [];
        const options = rows
          .map((facture) => {
            const item = buildFactureLabel(facture);
            return {
              value: facture.id,
              label: item.label,
              remaining: item.remaining,
              devise: facture.devise ?? "MGA",
            };
          })
          .filter((item) => item.remaining > 0);

        set({
          factureOptions: options,
          initialData: {
            facture_id: options[0]?.value ?? "",
            paye_le: new Date().toISOString().slice(0, 10),
            montant: options[0]?.remaining ?? 0,
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
