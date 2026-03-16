/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import type { Departement, Enseignant, Personnel } from "../../../../generated/zod";
import EnseignantService from "../../../../services/enseignant.service";
import PersonnelService from "../../../../services/personnel.service";
import DepartementService from "../../../../services/departement.service";

export type EnseignantCreateInput = Omit<
  Enseignant,
  "id" | "created_at" | "updated_at"
>;

type State = {
  loading: boolean;
  enseignant: EnseignantCreateInput | null;
  service: EnseignantService;
  initialData: Partial<EnseignantCreateInput> | null;
  personnelOptions: { value: string; label: string }[];
  departementOptions: { value: string; label: string }[];
  setInitialData: (enseignant: Partial<EnseignantCreateInput>) => void;
  onCreate: (enseignant: EnseignantCreateInput) => Promise<any>;
  setLoading: (loading: boolean) => void;
  setEnseignant: (enseignant: EnseignantCreateInput) => void;
  getPersonnelOptions: (etablissementId?: string) => Promise<void>;
  getDepartementOptions: (etablissementId?: string) => Promise<void>;
};

export const useEnseignantCreateStore = create<State>((set, get) => ({
  enseignant: null,
  service: new EnseignantService(),
  personnelOptions: [],
  departementOptions: [],
  loading: false,
  initialData: null,

  setLoading: (loading: boolean) => set({ loading }),

  setInitialData: (data: Partial<EnseignantCreateInput>) =>
    set({ initialData: data }),

  getPersonnelOptions: async (etablissementId?: string) => {
    set({ loading: true });
    const service = new PersonnelService();
    const result = await service.getAll({
      where: etablissementId
        ? { etablissement_id: etablissementId }
        : undefined,
    });
    if (result?.status.success) {
      set({
        personnelOptions: result.data.data.map((p: Personnel) => ({
          value: p.id,
          label: p.code_personnel ?? p.id,
        })),
      });
    }
    set({ loading: false });
  },

  getDepartementOptions: async (etablissementId?: string) => {
    set({ loading: true });
    const service = new DepartementService();
    const result = await service.getAll({
      where: etablissementId
        ? { etablissement_id: etablissementId }
        : undefined,
    });
    if (result?.status.success) {
      set({
        departementOptions: result.data.data.map((d: Departement) => ({
          value: d.id,
          label: d.nom,
        })),
      });
    }
    set({ loading: false });
  },

  onCreate: async (enseignant: EnseignantCreateInput): Promise<any> => {
    try {
      const result = await get().service.create(enseignant);
      if (result?.status.success) {
        return result;
      } else {
        throw new Error();
      }
    } catch (error) {
      console.log("🚀 ~ error:", error);
      return {
        status: {
          success: false,
        },
      };
    }
  },

  setEnseignant: (enseignant: EnseignantCreateInput) => set({ enseignant }),
}));
