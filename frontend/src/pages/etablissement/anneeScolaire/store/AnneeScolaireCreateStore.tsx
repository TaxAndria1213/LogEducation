/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import type { Etablissement, AnneeScolaire } from "../../../../generated/zod";
import AnneeScolaireService from "../../../../services/anneeScolaire.service";
import EtablissementService from "../../../../services/etablissement.service";

export type AnneeScolaireCreateInput = Omit<AnneeScolaire, "id" | "created_at" | "updated_at">;

type State = {
  loading: boolean;
  anneeScolaire: AnneeScolaireCreateInput | null;
  service: typeof AnneeScolaireService;
  initialData: Partial<AnneeScolaireCreateInput> | null;
  etablissementOptions: { value: string; label: string }[];
  setInitialData: (anneeScolaire: Partial<AnneeScolaireCreateInput>) => void;
  onCreate: (anneeScolaire: AnneeScolaireCreateInput) => Promise<any>;
  setLoading: (loading: boolean) => void;
  setAnneeScolaire: (anneeScolaire: AnneeScolaireCreateInput) => void;
  getEtablissementOptions: () => Promise<void>;
};

export const useAnneeScolaireCreateStore = create<State>((set, get) => ({
  anneeScolaire: null,
  service: AnneeScolaireService,
  etablissementOptions: [],
  loading: false,
  initialData: null,

  setLoading: (loading: boolean) => set({ loading }),

  getEtablissementOptions: async () => {
    set({ loading: true });
    const etablissementService = new EtablissementService();
    const result = await etablissementService.getAll({});
    if (result?.status.success) {
      set({
        etablissementOptions: result.data.data.map((e: Etablissement) => ({
          value: e.id,
          label: e.nom,
        })),
      });
    } else {
      throw new Error("Failed to load etablissement options");
    }
    set({ loading: false });
  },
  setInitialData: (data: Partial<AnneeScolaireCreateInput>) => set({ initialData: data }),

  onCreate: async (anneeScolaire: AnneeScolaireCreateInput): Promise<any> => {
    try {
      const result = await get().service.create(anneeScolaire);
      if (result?.status.success) {
        return result;
      } else {
        throw new Error();
      }
    } catch (error) {
      console.log("🚀 ~ error:", error);
      //   throw error;
      return {
        status: {
          success: false,
        },
      };
    }
  },

  setAnneeScolaire: (anneeScolaire: AnneeScolaireCreateInput) => set({ anneeScolaire: anneeScolaire }),
}));
