/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import type { Etablissement, ParentTuteur } from "../../../../generated/zod";
import ParentTuteurService from "../../../../services/parentTuteur.service";
import EtablissementService from "../../../../services/etablissement.service";

export type ParentTuteurCreateInput = Omit<ParentTuteur, "id" | "created_at" | "updated_at">;

type State = {
  loading: boolean;
  parentTuteur: ParentTuteurCreateInput | null;
  initialData: Partial<ParentTuteurCreateInput> | null;
  service: ParentTuteurService;
  etablissementOptions: { value: string; label: string }[];
  onCreate: (parentTuteur: ParentTuteurCreateInput) => Promise<any>;
  setLoading: (loading: boolean) => void;
  setParentTuteur: (parentTuteur: ParentTuteurCreateInput) => void;
  getEtablissementOptions: () => Promise<void>;
  setInitialData: (parentTuteur: Partial<ParentTuteur>) => void;
};

export const useParentTuteurCreateStore = create<State>((set, get) => ({
  parentTuteur: null,
  service: new ParentTuteurService(),
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

  setInitialData: (parentTuteur: Partial<ParentTuteur>) => set({ initialData: parentTuteur }),

  onCreate: async (parentTuteur: ParentTuteurCreateInput): Promise<any> => {
    try {
      const result = await get().service.create(parentTuteur);
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

  setParentTuteur: (parentTuteur: ParentTuteurCreateInput) => set({ parentTuteur: parentTuteur }),
}));
