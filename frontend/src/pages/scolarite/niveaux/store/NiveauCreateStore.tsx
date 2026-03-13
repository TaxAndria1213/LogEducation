/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import type { Etablissement, NiveauScolaire } from "../../../../generated/zod";
import NiveauService from "../../../../services/niveau.service";
import EtablissementService from "../../../../services/etablissement.service";

export type NiveauCreateInput = Omit<NiveauScolaire, "id" | "created_at" | "updated_at">;

type State = {
  loading: boolean;
  niveau: NiveauCreateInput | null;
  initialData: Partial<NiveauCreateInput> | null;
  service: NiveauService;
  etablissementOptions: { value: string; label: string }[];
  onCreate: (niveau: NiveauCreateInput) => Promise<any>;
  setLoading: (loading: boolean) => void;
  setNiveau: (niveau: NiveauCreateInput) => void;
  getEtablissementOptions: () => Promise<void>;
  setInitialData: (niveau: Partial<NiveauScolaire>) => void;
};

export const useNiveauCreateStore = create<State>((set, get) => ({
  niveau: null,
  service: new NiveauService(),
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

  setInitialData: (niveau: Partial<NiveauScolaire>) => set({ initialData: niveau }),

  onCreate: async (niveau: NiveauCreateInput): Promise<any> => {
    try {
      const result = await get().service.create(niveau);
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

  setNiveau: (niveau: NiveauCreateInput) => set({ niveau: niveau }),
}));
