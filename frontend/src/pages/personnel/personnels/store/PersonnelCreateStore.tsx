/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import type { Personnel } from "../../../../generated/zod";
import PersonnelService from "../../../../services/personnel.service";

export type PersonnelCreateInput = Omit<
  Personnel,
  "id" | "created_at" | "updated_at"
>;

type State = {
  loading: boolean;
  personnel: PersonnelCreateInput | null;
  service: PersonnelService;
  initialData: Partial<PersonnelCreateInput> | null;
  setInitialData: (personnel: Partial<PersonnelCreateInput>) => void;
  onCreate: (personnel: PersonnelCreateInput) => Promise<any>;
  setLoading: (loading: boolean) => void;
  setPersonnel: (personnel: PersonnelCreateInput) => void;
};

export const usePersonnelCreateStore = create<State>((set, get) => ({
  personnel: null,
  service: new PersonnelService(),
  loading: false,
  initialData: null,

  setLoading: (loading: boolean) => set({ loading }),

  setInitialData: (data: Partial<PersonnelCreateInput>) =>
    set({ initialData: data }),

  onCreate: async (personnel: PersonnelCreateInput): Promise<any> => {
    try {
      const result = await get().service.create(personnel);
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

  setPersonnel: (personnel: PersonnelCreateInput) => set({ personnel }),
}));
