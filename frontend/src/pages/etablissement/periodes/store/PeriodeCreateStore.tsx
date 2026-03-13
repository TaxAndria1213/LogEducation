/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import type { Periode } from "../../../../generated/zod";
import PeriodeService from "../../../../services/periode.service";
import AnneeScolaireService from "../../../../services/anneeScolaire.service";
import type { AnneeScolaire } from "../../../../types/models";

export type PeriodeCreateInput = Omit<Periode, "id" | "created_at" | "updated_at">;

type State = {
  loading: boolean;
  periode: PeriodeCreateInput | null;
  service: typeof PeriodeService;
  initialData: Partial<PeriodeCreateInput> | null;
  anneeScolaireOptions: { value: string; label: string }[];
  setInitialData: (periode: Partial<PeriodeCreateInput>) => void;
  onCreate: (periode: PeriodeCreateInput) => Promise<any>;
  setLoading: (loading: boolean) => void;
  setPeriode: (periode: PeriodeCreateInput) => void;
  getAnneeScolaireOptions: (etablissement_id: string) => Promise<void>;
};

export const usePeriodeCreateStore = create<State>((set, get) => ({
  periode: null,
  service: PeriodeService,
  anneeScolaireOptions: [],
  loading: false,
  initialData: null,

  setLoading: (loading: boolean) => set({ loading }),

  getAnneeScolaireOptions: async (etablissement_id: string) => {
    set({ loading: true });
    const service = AnneeScolaireService;
    const result = await service.getAll({
      take: 100,
      where: JSON.stringify({etablissement_id: etablissement_id}),
    });
    if (result?.status.success) {
      set({
        anneeScolaireOptions: result.data.data.map((e: AnneeScolaire) => ({
          value: e.id,
          label: e.nom,
        })),
      });
    } else {
      throw new Error("Failed to load etablissement options");
    }
    set({ loading: false });
  },
  setInitialData: (data: Partial<PeriodeCreateInput>) => set({ initialData: data }),

  onCreate: async (periode: PeriodeCreateInput): Promise<any> => {
    try {
      const result = await get().service.create(periode);
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

  setPeriode: (periode: PeriodeCreateInput) => set({ periode: periode }),
}));
