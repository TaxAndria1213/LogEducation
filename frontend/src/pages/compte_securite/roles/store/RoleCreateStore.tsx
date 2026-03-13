/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import type { Etablissement, Role } from "../../../../generated/zod";
import RoleService from "../../../../services/role.service";
import EtablissementService from "../../../../services/etablissement.service";

export type RoleCreateInput = Omit<Role, "id" | "created_at" | "updated_at">;

type State = {
  loading: boolean;
  role: RoleCreateInput | null;
  initialData: Partial<RoleCreateInput> | null;
  service: RoleService;
  etablissementOptions: { value: string; label: string }[];
  onCreate: (role: RoleCreateInput) => Promise<any>;
  setLoading: (loading: boolean) => void;
  setRole: (role: RoleCreateInput) => void;
  getEtablissementOptions: () => Promise<void>;
  setInitialData: (role: Partial<Role>) => void;
};

export const useRoleCreateStore = create<State>((set, get) => ({
  role: null,
  service: new RoleService(),
  etablissementOptions: [],
  loading: false,
  initialData: null,

  setLoading: (loading: boolean) => set({ loading }),

  getEtablissementOptions: async () => {
    set({ loading: true });
    const etablissementService = new EtablissementService();
    const result = await etablissementService.getAll({});
    if (result?.status.success) {
      set({
        etablissementOptions: result.data.data.map((e: Etablissement) => ({
          value: e.id,
          label: e.nom,
        })),
      });
    } else {
      throw new Error("Failed to load etablissement options");
    }
    set({ loading: false });
  },

  setInitialData: (role: Partial<Role>) => set({ initialData: role }),

  onCreate: async (role: RoleCreateInput): Promise<any> => {
    try {
      const result = await get().service.create(role);
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

  setRole: (role: RoleCreateInput) => set({ role: role }),
}));
