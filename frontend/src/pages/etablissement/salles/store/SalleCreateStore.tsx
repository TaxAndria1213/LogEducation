/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import type { Salle } from "../../../../generated/zod";
import SalleService from "../../../../services/salle.service";
import SiteService from "../../../../services/site.service";
import type { Site } from "../../../../types/models";

export type SalleCreateInput = Omit<Salle, "id" | "created_at" | "updated_at">;

type State = {
  loading: boolean;
  salle: SalleCreateInput | null;
  service: typeof SalleService;
  initialData: Partial<SalleCreateInput> | null;
  siteOptions: { value: string; label: string }[];
  setInitialData: (salle: Partial<SalleCreateInput>) => void;
  onCreate: (salle: SalleCreateInput) => Promise<any>;
  setLoading: (loading: boolean) => void;
  setSalle: (salle: SalleCreateInput) => void;
  getSiteOptions: (etablissement_id: string) => Promise<void>;
};

export const useSalleCreateStore = create<State>((set, get) => ({
  salle: null,
  service: SalleService,
  siteOptions: [],
  loading: false,
  initialData: null,

  setLoading: (loading: boolean) => set({ loading }),

  getSiteOptions: async (etablissement_id: string) => {
    set({ loading: true });
    const siteService = new SiteService();
    const result = await siteService.getAll({
      where: JSON.stringify({ etablissement_id: etablissement_id }),
    });
    if (result?.status.success) {
      set({
        siteOptions: result.data.data.map((e: Site) => ({
          value: e.id,
          label: e.nom,
        })),
      });
    } else {
      throw new Error("Failed to load etablissement options");
    }
    set({ loading: false });
  },
  setInitialData: (data: Partial<SalleCreateInput>) => set({ initialData: data }),

  onCreate: async (salle: SalleCreateInput): Promise<any> => {
    try {
      const result = await get().service.create(salle);
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

  setSalle: (salle: SalleCreateInput) => set({ salle: salle }),
}));
