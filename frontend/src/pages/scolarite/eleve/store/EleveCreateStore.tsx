/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import type { Etablissement, Eleve } from "../../../../generated/zod";
import EleveService from "../../../../services/eleve.service";
import EtablissementService from "../../../../services/etablissement.service";

export type EleveCreateInput = Omit<Eleve, "id" | "created_at" | "updated_at">;

type State = {
  loading: boolean;
  eleve: EleveCreateInput | null;
  initialData: Partial<EleveCreateInput> | null;
  service: EleveService;
  etablissementOptions: { value: string; label: string }[];
  onCreate: (eleve: EleveCreateInput) => Promise<any>;
  setLoading: (loading: boolean) => void;
  setEleve: (eleve: EleveCreateInput) => void;
  getEtablissementOptions: () => Promise<void>;
  setInitialData: (eleve: Partial<Eleve>) => void;
};

export const useEleveCreateStore = create<State>((set, get) => ({
  eleve: null,
  service: new EleveService(),
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

  setInitialData: (eleve: Partial<Eleve>) => set({ initialData: eleve }),

  onCreate: async (eleve: EleveCreateInput): Promise<any> => {
    try {
      const result = await get().service.create(eleve);
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

  setEleve: (eleve: EleveCreateInput) => set({ eleve: eleve }),
}));
