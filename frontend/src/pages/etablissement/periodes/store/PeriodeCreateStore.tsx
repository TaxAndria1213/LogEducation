/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import type { Periode } from "../../../../generated/zod";
import AnneeScolaireService from "../../../../services/anneeScolaire.service";
import PeriodeService from "../../../../services/periode.service";
import type { AnneeScolaire } from "../../../../types/models";

export type PeriodeCreateInput = Omit<Periode, "id" | "created_at" | "updated_at">;

type State = {
  loading: boolean;
  periode: PeriodeCreateInput | null;
  initialData: Partial<PeriodeCreateInput> | null;
  anneeScolaireOptions: { value: string; label: string }[];
  setInitialData: (periode: Partial<PeriodeCreateInput>) => void;
  onCreate: (periode: PeriodeCreateInput) => Promise<any>;
  setLoading: (loading: boolean) => void;
  setPeriode: (periode: PeriodeCreateInput) => void;
  getAnneeScolaireOptions: (etablissementId?: string | null) => Promise<void>;
};

export const usePeriodeCreateStore = create<State>((set) => ({
  periode: null,
  anneeScolaireOptions: [],
  loading: false,
  initialData: null,

  setLoading: (loading: boolean) => set({ loading }),

  getAnneeScolaireOptions: async (etablissementId?: string | null) => {
    set({ loading: true });

    try {
      if (!etablissementId) {
        set({ anneeScolaireOptions: [], initialData: null });
        return;
      }

      const [yearsResult, currentYear] = await Promise.all([
        AnneeScolaireService.getAll({
          take: 100,
          where: { etablissement_id: etablissementId },
          orderBy: [{ date_debut: "desc" }],
        }),
        AnneeScolaireService.getCurrent(etablissementId),
      ]);

      const options = yearsResult?.status.success
        ? yearsResult.data.data.map((annee: AnneeScolaire) => ({
            value: annee.id,
            label: annee.nom,
          }))
        : [];

      set({
        anneeScolaireOptions: options,
        initialData: currentYear ? { annee_scolaire_id: currentYear.id } : null,
      });
    } finally {
      set({ loading: false });
    }
  },

  setInitialData: (data: Partial<PeriodeCreateInput>) => set({ initialData: data }),

  onCreate: async (periode: PeriodeCreateInput): Promise<any> => {
    try {
      const result = await PeriodeService.create(periode);
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

  setPeriode: (periode: PeriodeCreateInput) => set({ periode }),
}));
