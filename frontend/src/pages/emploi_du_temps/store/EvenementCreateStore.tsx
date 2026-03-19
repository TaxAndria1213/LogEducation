import { create } from "zustand";
import type { Site } from "../../../types/models";
import SiteService from "../../../services/site.service";
import type { EventFormInput, SelectOption } from "../types";

type State = {
  loading: boolean;
  mode: "create" | "edit";
  editingEventId: string | null;
  initialValues: Partial<EventFormInput> | null;
  siteOptions: SelectOption[];
  setLoading: (loading: boolean) => void;
  setInitialValues: (values: Partial<EventFormInput>) => void;
  resetEditor: (etablissement_id?: string | null) => void;
  startEdit: (event: Partial<EventFormInput> & { id?: string | null }) => void;
  startDuplicate: (event: Partial<EventFormInput>) => void;
  getOptions: (etablissement_id: string) => Promise<void>;
};

function getDefaultInitialValues(etablissement_id?: string | null): Partial<EventFormInput> {
  const start = new Date();
  start.setMinutes(0, 0, 0);

  const end = new Date(start);
  end.setHours(end.getHours() + 1);

  return {
    etablissement_id: etablissement_id ?? undefined,
    type: "Activite",
    debut: start,
    fin: end,
  };
}

export const useEvenementCreateStore = create<State>((set) => ({
  loading: false,
  mode: "create",
  editingEventId: null,
  initialValues: null,
  siteOptions: [],

  setLoading: (loading: boolean) => set({ loading }),
  setInitialValues: (values: Partial<EventFormInput>) =>
    set((state) => ({
      initialValues: {
        ...(state.initialValues ?? {}),
        ...values,
      },
    })),

  resetEditor: (etablissement_id?: string | null) =>
    set({
      mode: "create",
      editingEventId: null,
      initialValues: getDefaultInitialValues(etablissement_id),
    }),

  startEdit: (event) =>
    set({
      mode: "edit",
      editingEventId: event.id ?? null,
      initialValues: {
        etablissement_id: event.etablissement_id,
        site_id: event.site_id ?? null,
        titre: event.titre ?? "",
        debut: event.debut ? new Date(event.debut) : undefined,
        fin: event.fin ? new Date(event.fin) : undefined,
        type: event.type ?? null,
        description: event.description ?? null,
      },
    }),

  startDuplicate: (event) =>
    set({
      mode: "create",
      editingEventId: null,
      initialValues: {
        etablissement_id: event.etablissement_id,
        site_id: event.site_id ?? null,
        titre: event.titre ? `${event.titre} - copie` : "",
        debut: event.debut ? new Date(event.debut) : undefined,
        fin: event.fin ? new Date(event.fin) : undefined,
        type: event.type ?? null,
        description: event.description ?? null,
      },
    }),

  getOptions: async (etablissement_id: string) => {
    set({ loading: true });

    const siteService = new SiteService();
    const result = await siteService.getAll({
      take: 5000,
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
