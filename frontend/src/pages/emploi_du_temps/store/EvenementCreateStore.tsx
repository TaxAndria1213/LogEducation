import { create } from "zustand";
import type { Site } from "../../../types/models";
import SiteService from "../../../services/site.service";
import type { EventFormInput, SelectOption } from "../types";

type State = {
  loading: boolean;
  initialValues: Partial<EventFormInput> | null;
  siteOptions: SelectOption[];
  setLoading: (loading: boolean) => void;
  setInitialValues: (values: Partial<EventFormInput>) => void;
  getOptions: (etablissement_id: string) => Promise<void>;
};

export const useEvenementCreateStore = create<State>((set) => ({
  loading: false,
  initialValues: null,
  siteOptions: [],

  setLoading: (loading: boolean) => set({ loading }),
  setInitialValues: (values: Partial<EventFormInput>) =>
    set({ initialValues: values }),

  getOptions: async (etablissement_id: string) => {
    set({ loading: true });

    const siteService = new SiteService();
    const result = await siteService.getAll({
      take: 1000,
      where: JSON.stringify({ etablissement_id }),
      orderBy: JSON.stringify({ nom: "asc" }),
    });

    set({
      siteOptions: result?.status.success
        ? result.data.data.map((item: Site) => ({
            value: item.id,
            label: item.nom,
          }))
        : [],
      loading: false,
    });
  },
}));
