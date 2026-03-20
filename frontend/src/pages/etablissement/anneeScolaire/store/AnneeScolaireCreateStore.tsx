/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import type { AnneeScolaire, Etablissement } from "../../../../generated/zod";
import AnneeScolaireService from "../../../../services/anneeScolaire.service";
import EtablissementService from "../../../../services/etablissement.service";

export type AnneeScolaireCreateInput = Omit<
  AnneeScolaire,
  "id" | "created_at" | "updated_at"
>;

type State = {
  loading: boolean;
  anneeScolaire: AnneeScolaireCreateInput | null;
  initialData: Partial<AnneeScolaireCreateInput> | null;
  etablissementOptions: { value: string; label: string }[];
  setInitialData: (anneeScolaire: Partial<AnneeScolaireCreateInput>) => void;
  onCreate: (anneeScolaire: AnneeScolaireCreateInput) => Promise<any>;
  setLoading: (loading: boolean) => void;
  setAnneeScolaire: (anneeScolaire: AnneeScolaireCreateInput) => void;
  getEtablissementOptions: () => Promise<void>;
};

export const useAnneeScolaireCreateStore = create<State>((set) => ({
  anneeScolaire: null,
  etablissementOptions: [],
  loading: false,
  initialData: null,

  setLoading: (loading: boolean) => set({ loading }),

  getEtablissementOptions: async () => {
    set({ loading: true });
    try {
      const etablissementService = new EtablissementService();
      const result = await etablissementService.getAll({});

      if (result?.status.success) {
        set({
          etablissementOptions: result.data.data.map((e: Etablissement) => ({
            value: e.id,
            label: e.nom,
          })),
        });
        return;
      }

      throw new Error("Failed to load etablissement options");
    } finally {
      set({ loading: false });
    }
  },

  setInitialData: (data: Partial<AnneeScolaireCreateInput>) => set({ initialData: data }),

  onCreate: async (anneeScolaire: AnneeScolaireCreateInput): Promise<any> => {
    try {
      const result = await AnneeScolaireService.create(anneeScolaire);
      if (result?.status.success) {
        return result;
      }

      throw new Error();
    } catch (error) {
      console.log("error:", error);
      return {
        status: {
          success: false,
        },
      };
    }
  },

  setAnneeScolaire: (anneeScolaire: AnneeScolaireCreateInput) =>
    set({ anneeScolaire }),
}));
