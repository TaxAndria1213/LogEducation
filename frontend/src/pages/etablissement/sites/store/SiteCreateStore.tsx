/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import type { Etablissement, Site } from "../../../../generated/zod";
import EtablissementService from "../../../../services/etablissement.service";
import SiteService from "../../../../services/site.service";

export type SiteCreateInput = Omit<Site, "id" | "created_at" | "updated_at">;

type State = {
  loading: boolean;
  site: SiteCreateInput | null;
  service: SiteService;
  initialData: Partial<SiteCreateInput> | null;
  etablissementOptions: { value: string; label: string }[];
  setInitialData: (site: Partial<SiteCreateInput>) => void;
  onCreate: (site: SiteCreateInput) => Promise<any>;
  setLoading: (loading: boolean) => void;
  setSite: (site: SiteCreateInput) => void;
  getEtablissementOptions: () => Promise<void>;
};

export const useSiteCreateStore = create<State>((set, get) => ({
  site: null,
  service: new SiteService(),
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

  setInitialData: (data: Partial<SiteCreateInput>) => set({ initialData: data }),

  onCreate: async (site: SiteCreateInput): Promise<any> => {
    try {
      const result = await get().service.create(site);
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

  setSite: (site: SiteCreateInput) => set({ site }),
}));
