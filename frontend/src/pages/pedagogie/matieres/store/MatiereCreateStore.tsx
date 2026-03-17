import { create } from "zustand";
import type { Departement, Matiere } from "../../../../types/models";
import DepartementService from "../../../../services/departement.service";

export type MatiereCreateInput = Omit<
  Matiere,
  "id" | "created_at" | "updated_at"
>;

type State = {
  loading: boolean;
  setLoading: (loading: boolean) => void;
  departementOptions: { value: string; label: string }[];
  getOptions: (etablissement_id: string) => Promise<void>;
};

export const useMatiereCreateStore = create<State>((set) => ({
  loading: false,

  departementOptions: [],

  setLoading: (loading: boolean) => set({ loading }),

  getOptions: async (etablissement_id: string) => {
    set({ loading: true });
    // récupération des départements :
    const departementService = new DepartementService();
    const result = await departementService.getAll({
      take: 1000,
      where: JSON.stringify({
        etablissement_id: etablissement_id,
      }),
    });

    if (result?.status.success) {
      set({
        departementOptions: result.data.data.map((d: Departement) => ({
          value: d.id,
          label: d.nom,
        })),
      });
    }

    set({ loading: false });
  },
}));
