import { create } from "zustand";
import type { Cours, Evaluation, Periode } from "../../../../types/models";
import CoursService from "../../../../services/cours.service";
import anneeScolaireService from "../../../../services/anneeScolaire.service";
import periodeService from "../../../../services/periode.service";

export type MatiereCreateInput = Omit<
  Evaluation,
  "id" | "created_at" | "updated_at"
>;

type State = {
  loading: boolean;
  coursOptions: { value: string; label: string }[];
  periodeOptions: { value: string; label: string }[];
  setLoading: (loading: boolean) => void;
  getOptions: (etablissement_id: string) => Promise<void>;
};

export const useEvaluationCreateStore = create<State>((set) => ({
  loading: false,
  coursOptions: [],
  periodeOptions: [],

  setLoading: (loading: boolean) => set({ loading }),

  getOptions: async (etablissement_id: string) => {
    set({ loading: true });
    // récupération des cours :
    const anneeScolaire =
      await anneeScolaireService.getCurrent(etablissement_id);
    const coursService = new CoursService();
    const coursResult = await coursService.getAll({
      take: 1000,
      where: JSON.stringify({
        etablissement_id: etablissement_id,
        annee_scolaire_id: anneeScolaire?.id,
      } as Partial<Cours>),
      includeSpec: JSON.stringify({ matiere: true, classe: true }),
    });
    console.log("🚀 ~ coursResult:", coursResult);

    if (coursResult?.status.success) {
      set({
        coursOptions: coursResult.data.data.map((d: Cours) => ({
          value: d.id,
          label: d.matiere?.nom + " - " + d.classe?.nom,
        })),
      });
    }

    //récupération des options de périodes
    const periodeResult = await periodeService.getAll({
      take: 100,
      where: JSON.stringify({
        annee_scolaire_id: anneeScolaire?.id,
        annee: {
          etablissement_id: etablissement_id,
        },
      } as Partial<Periode>),
    });

    if (periodeResult?.status.success) {
      set({
        periodeOptions: periodeResult.data.data.map((d: Periode) => ({
          value: d.id,
          label: d.nom,
        })),
      });
    }

    set({ loading: false });
  },
}));
