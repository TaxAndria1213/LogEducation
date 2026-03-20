/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import type { Salle } from "../../../../generated/zod";
import salleService from "../../../../services/salle.service";
import SiteService from "../../../../services/site.service";
import type { Site } from "../../../../types/models";

export type SalleCreateInput = Omit<Salle, "id" | "created_at" | "updated_at">;

type State = {
  loading: boolean;
  salle: SalleCreateInput | null;
  initialData: Partial<SalleCreateInput> | null;
  siteOptions: { value: string; label: string }[];
  setInitialData: (salle: Partial<SalleCreateInput>) => void;
  onCreate: (salle: SalleCreateInput) => Promise<any>;
  setLoading: (loading: boolean) => void;
  setSalle: (salle: SalleCreateInput) => void;
  getSiteOptions: (etablissementId?: string | null) => Promise<void>;
};

export const useSalleCreateStore = create<State>((set) => ({
  salle: null,
  siteOptions: [],
  loading: false,
  initialData: null,

  setLoading: (loading: boolean) => set({ loading }),

  getSiteOptions: async (etablissementId?: string | null) => {
    set({ loading: true });

    try {
      const siteService = new SiteService();
      const params = etablissementId
        ? {
            where: { etablissement_id: etablissementId },
          }
        : {};

      const result = await siteService.getAll(params);

      if (result?.status.success) {
        set({
          siteOptions: result.data.data.map((site: Site) => ({
            value: site.id,
            label: site.nom,
          })),
        });
        return;
      }

      throw new Error("Failed to load site options");
    } finally {
      set({ loading: false });
    }
  },

  setInitialData: (data: Partial<SalleCreateInput>) => set({ initialData: data }),

  onCreate: async (salle: SalleCreateInput): Promise<any> => {
    try {
      const result = await salleService.create(salle);
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

  setSalle: (salle: SalleCreateInput) => set({ salle }),
}));
