/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import type { Etablissement, IdentifiantEleve } from "../../../../generated/zod";
import IdentifiantEleveService from "../../../../services/identifiantEleve.service";
import EtablissementService from "../../../../services/etablissement.service";

export type IdentifiantEleveCreateInput = Omit<IdentifiantEleve, "id" | "created_at" | "updated_at">;

type State = {
  loading: boolean;
  identifiantEleve: IdentifiantEleveCreateInput | null;
  initialData: Partial<IdentifiantEleveCreateInput> | null;
  service: IdentifiantEleveService;
  etablissementOptions: { value: string; label: string }[];
  onCreate: (identifiantEleve: IdentifiantEleveCreateInput) => Promise<any>;
  setLoading: (loading: boolean) => void;
  setIdentifiantEleve: (identifiantEleve: IdentifiantEleveCreateInput) => void;
  getEtablissementOptions: () => Promise<void>;
  setInitialData: (identifiantEleve: Partial<IdentifiantEleve>) => void;
};

export const useIdentifiantEleveCreateStore = create<State>((set, get) => ({
  identifiantEleve: null,
  service: new IdentifiantEleveService(),
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

  setInitialData: (identifiantEleve: Partial<IdentifiantEleve>) => set({ initialData: identifiantEleve }),

  onCreate: async (identifiantEleve: IdentifiantEleveCreateInput): Promise<any> => {
    try {
      const result = await get().service.create(identifiantEleve);
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

  setIdentifiantEleve: (identifiantEleve: IdentifiantEleveCreateInput) => set({ identifiantEleve: identifiantEleve }),
}));
