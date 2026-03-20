import { create } from "zustand";
import type { Note } from "../../../../types/models";
import EleveService from "../../../../services/eleve.service";
import EvaluationService, {
  getEvaluationDisplayLabel,
  type EvaluationWithRelations,
} from "../../../../services/evaluation.service";
import {
  getEleveDisplayLabel,
  type EleveWithRelations,
} from "../../../../services/note.service";

export type NoteCreateInput = Omit<
  Note,
  "id" | "created_at" | "updated_at" | "note_par"
> & {
  note_par?: string | null;
};

type SelectOption = {
  value: string;
  label: string;
};

type State = {
  loading: boolean;
  errorMessage: string;
  initialData: Partial<NoteCreateInput> | null;
  evaluationOptions: SelectOption[];
  eleveOptions: SelectOption[];
  evaluations: EvaluationWithRelations[];
  eleves: EleveWithRelations[];
  setLoading: (loading: boolean) => void;
  getOptions: (etablissement_id: string) => Promise<void>;
};

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "message" in error.response.data &&
    typeof error.response.data.message === "string"
  ) {
    return error.response.data.message;
  }

  return "Impossible de charger les ressources du module Notes.";
}

export const useNoteCreateStore = create<State>((set) => ({
  loading: false,
  errorMessage: "",
  evaluationOptions: [],
  eleveOptions: [],
  evaluations: [],
  eleves: [],
  initialData: null,

  setLoading: (loading: boolean) => set({ loading }),

  getOptions: async (etablissement_id: string) => {
    set({ loading: true, errorMessage: "" });

    try {
      set({
        initialData: {
          note_le: new Date(),
        },
      });

      const evaluationService = new EvaluationService();
      const eleveService = new EleveService();

      const [evaluationResult, eleveResult] = await Promise.all([
        evaluationService.getForEtablissement(etablissement_id, {
          take: 1000,
          includeSpec: JSON.stringify({
            periode: true,
            cours: {
              include: {
                annee: true,
                classe: true,
                matiere: true,
              },
            },
          }),
        }),
        eleveService.getAll({
          take: 1000,
          where: JSON.stringify({
            etablissement_id,
          }),
          includeSpec: JSON.stringify({
            utilisateur: {
              include: {
                profil: true,
              },
            },
            inscriptions: {
              include: {
                classe: true,
              },
            },
          }),
          orderBy: JSON.stringify([{ code_eleve: "asc" }, { created_at: "desc" }]),
        }),
      ]);

      const evaluations = evaluationResult?.status.success
        ? ((evaluationResult.data.data as EvaluationWithRelations[]) ?? [])
        : [];
      const eleves = eleveResult?.status.success
        ? ((eleveResult.data.data as EleveWithRelations[]) ?? [])
        : [];

      set({
        loading: false,
        errorMessage: "",
        evaluationOptions: evaluations.map((item) => ({
          value: item.id,
          label: getEvaluationDisplayLabel(item),
        })),
        eleveOptions: eleves.map((item) => ({
          value: item.id,
          label: getEleveDisplayLabel(item),
        })),
        evaluations,
        eleves,
      });
    } catch (error: unknown) {
      set({
        loading: false,
        errorMessage: getErrorMessage(error),
        evaluationOptions: [],
        eleveOptions: [],
        evaluations: [],
        eleves: [],
      });
    }
  },
}));
