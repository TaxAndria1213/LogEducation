/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import type { Etablissement, Utilisateur } from "../../../../generated/zod";
import UtilisateurService from "../../../../services/utilisateur.service";
import EtablissementService from "../../../../services/etablissement.service";

export type UtilisateurCreateInput = Omit<Utilisateur, "id" | "created_at" | "updated_at">;

type State = {
  loading: boolean;
  utilisateur: UtilisateurCreateInput | null;
  initialValues: Partial<UtilisateurCreateInput> | null;
  service: UtilisateurService;
  etablissementOptions: { value: string; label: string }[];
  onCreate: (utilisateur: UtilisateurCreateInput) => Promise<any>;
  setLoading: (loading: boolean) => void;
  setUtilisateur: (utilisateur: UtilisateurCreateInput) => void;
  getEtablissementOptions: () => Promise<void>;
  setInitialValues: (utilisateur: Partial<Utilisateur>) => void;
};

export const useUtilisateurCreateStore = create<State>((set, get) => ({
  utilisateur: null,
  service: new UtilisateurService(),
  etablissementOptions: [],
  loading: false,
  initialValues: null,

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

  setInitialValues: (utilisateur: Partial<Utilisateur>) => set({ initialValues: utilisateur }),

  onCreate: async (utilisateur: UtilisateurCreateInput): Promise<any> => {
    try {
      const result = await get().service.create(utilisateur);
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

  setUtilisateur: (utilisateur: UtilisateurCreateInput) => set({ utilisateur: utilisateur }),
}));
