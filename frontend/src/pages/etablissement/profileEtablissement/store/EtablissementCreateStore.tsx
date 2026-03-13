/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import EtablissementService from "../../../../services/etablissement.service";

export type EtablissementCreateInput = {
  nom: string;
  code: string | null;
  fuseau_horaire: string | null;
  parametres_json: any | null;
};

type State = {
  etablissement: EtablissementCreateInput | null;
  service: EtablissementService;

  onCreate: (etablissement: EtablissementCreateInput) => Promise<any>;
};

export const useEtablissementCreateStore = create<State>((set, get) => ({
  etablissement: null,
  service: new EtablissementService(),

  onCreate: async (etablissement: EtablissementCreateInput): Promise<any> => {
    try {
      const result = await get().service.create(etablissement);
      if (result?.status.success) {
        return result;
      } else {
        throw new Error;
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

    set({ etablissement });
  },
}));
