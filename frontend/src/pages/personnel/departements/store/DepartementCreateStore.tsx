/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import type { Departement } from "../../../../generated/zod";
import DepartementService from "../../../../services/departement.service";

export type DepartementCreateInput = Omit<
  Departement,
  "id" | "created_at" | "updated_at"
>;

type State = {
  loading: boolean;
  departement: DepartementCreateInput | null;
  service: DepartementService;
  initialData: Partial<DepartementCreateInput> | null;
  setInitialData: (departement: Partial<DepartementCreateInput>) => void;
  onCreate: (departement: DepartementCreateInput) => Promise<any>;
  setLoading: (loading: boolean) => void;
  setDepartement: (departement: DepartementCreateInput) => void;
};

export const useDepartementCreateStore = create<State>((set, get) => ({
  departement: null,
  service: new DepartementService(),
  loading: false,
  initialData: null,

  setLoading: (loading: boolean) => set({ loading }),

  setInitialData: (data: Partial<DepartementCreateInput>) =>
    set({ initialData: data }),

  onCreate: async (departement: DepartementCreateInput): Promise<any> => {
    try {
      const result = await get().service.create(departement);
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

  setDepartement: (departement: DepartementCreateInput) =>
    set({ departement }),
}));
