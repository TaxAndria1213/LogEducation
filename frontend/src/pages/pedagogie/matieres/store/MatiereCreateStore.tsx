import { create } from "zustand";
import type { Departement, Matiere } from "../../../../types/models";
import DepartementService from "../../../../services/departement.service";

export type MatiereCreateInput = Omit<
  Matiere,
  "id" | "created_at" | "updated_at"
>;

type State = {
  loading: boolean;
  initialData: Partial<MatiereCreateInput> | null;
  errorMessage: string;
  setLoading: (loading: boolean) => void;
  setInitialData: (data: Partial<MatiereCreateInput>) => void;
  departementOptions: { value: string; label: string }[];
  getOptions: (etablissement_id: string) => Promise<void>;
};

export const useMatiereCreateStore = create<State>((set) => ({
  loading: false,
  initialData: null,
  errorMessage: "",
  departementOptions: [],

  setLoading: (loading: boolean) => set({ loading }),
  setInitialData: (data: Partial<MatiereCreateInput>) => set({ initialData: data }),

  getOptions: async (etablissement_id: string) => {
    set({
      loading: true,
      errorMessage: "",
      initialData: { etablissement_id, departement_id: null, code: null },
    });

    try {
      const departementService = new DepartementService();
      const result = await departementService.getAll({
        take: 1000,
        where: JSON.stringify({
          etablissement_id,
        }),
        orderBy: JSON.stringify([{ nom: "asc" }]),
      });

      if (result?.status.success) {
        set({
          departementOptions: result.data.data.map((d: Departement) => ({
            value: d.id,
            label: d.nom,
          })),
        });
        return;
      }

      set({
        departementOptions: [],
        errorMessage: "Impossible de charger les departements.",
      });
    } catch {
      set({
        departementOptions: [],
        errorMessage: "Impossible de charger les departements.",
      });
    } finally {
      set({ loading: false });
    }
  },
}));
