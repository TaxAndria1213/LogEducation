import { create } from "zustand";
import type { Eleve, Evaluation, Note } from "../../../../types/models";
import EvaluationService from "../../../../services/evaluation.service";
import EleveService from "../../../../services/eleve.service";

export type NoteCreateInput = Omit<
  Note,
  "id" | "created_at" | "updated_at"
>;

type State = {
  loading: boolean;
  initialData: Partial<NoteCreateInput> | null;
  evaluationOptions: { value: string; label: string }[];
  eleveOptions: { value: string; label: string }[];
  setLoading: (loading: boolean) => void;
  getOptions: (etablissement_id: string) => Promise<void>;
};

export const useNoteCreateStore = create<State>((set) => ({
  loading: false,
  evaluationOptions: [],
  eleveOptions: [],
  initialData: null,

  setLoading: (loading: boolean) => set({ loading }),

  getOptions: async (etablissement_id: string) => {
    set({ loading: true });

    set({
      initialData: {
        note_le: new Date(),
        }
    })
    // récupération des options d'évaluation :
    const evaluationService = new EvaluationService();
    const evaluationResult = await evaluationService.getAll({
      take: 1000,
      where: JSON.stringify({
        cours: {
          etablissement_id: etablissement_id,
        },
      }),
    });

    if (evaluationResult?.status.success) {
      set({
        evaluationOptions: evaluationResult.data.data.map((d: Evaluation) => ({
          value: d.id,
          label: d.titre || "-",
        })),
      });
    }
    // récupération des options d'élèves :
    const eleveService = new EleveService();
    const eleveResult = await eleveService.getAll({
      take: 1000,
      where: JSON.stringify({
        etablissement_id: etablissement_id,
      }),
      includeSpec: JSON.stringify({
        utilisateur: {
          include: {
            profil: true,
          },
        },
      }),
    });

    if (eleveResult?.status.success) {
      set({
        eleveOptions: eleveResult.data.data.map((d: Eleve) => ({
          value: d.id,
          label:
            d.code_eleve +
              " - " +
              d.utilisateur?.profil?.nom +
              " " +
              d.utilisateur?.profil?.prenom || "-",
        })),
      });
    }
    console.log("🚀 ~ eleveResult:", eleveResult);

    set({ loading: false });
  },
}));
