import { create } from "zustand";
import type { Evaluation, Periode } from "../../../../types/models";
import anneeScolaireService from "../../../../services/anneeScolaire.service";
import CoursService, {
  getCoursDisplayLabel,
  type CoursWithRelations,
} from "../../../../services/cours.service";
import PeriodeService from "../../../../services/periode.service";

export type EvaluationCreateInput = Omit<
  Evaluation,
  "id" | "created_at" | "updated_at" | "type_evaluation_id" | "cree_par_enseignant_id"
> & {
  type_evaluation_id?: string | null;
  cree_par_enseignant_id?: string | null;
};

type SelectOption = {
  value: string;
  label: string;
};

type State = {
  loading: boolean;
  errorMessage: string;
  initialData: Partial<EvaluationCreateInput> | null;
  coursOptions: SelectOption[];
  periodeOptions: SelectOption[];
  cours: CoursWithRelations[];
  periodes: Periode[];
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

  return "Impossible de charger les ressources du module Evaluations.";
}

export const useEvaluationCreateStore = create<State>((set) => ({
  loading: false,
  errorMessage: "",
  initialData: null,
  coursOptions: [],
  periodeOptions: [],
  cours: [],
  periodes: [],

  setLoading: (loading: boolean) => set({ loading }),

  getOptions: async (etablissement_id: string) => {
    set({ loading: true, errorMessage: "" });

    try {
      const currentYear = await anneeScolaireService.getCurrent(etablissement_id);

      if (!currentYear) {
        set({
          loading: false,
          coursOptions: [],
          periodeOptions: [],
          cours: [],
          periodes: [],
          initialData: {
            date: new Date(),
            note_max: 20,
            est_publiee: false,
            type: "AUTRE",
          },
          errorMessage:
            "Aucune annee scolaire active n'a ete trouvee pour preparer une evaluation.",
        });
        return;
      }

      const coursService = new CoursService();
      const [coursResult, periodeResult] = await Promise.all([
        coursService.getForEtablissement(etablissement_id, {
          take: 1000,
          where: {
            annee_scolaire_id: currentYear.id,
          },
          includeSpec: JSON.stringify({
            annee: true,
            classe: {
              include: {
                niveau: true,
                site: true,
              },
            },
            matiere: {
              include: {
                departement: true,
              },
            },
            enseignant: {
              include: {
                departement: true,
                personnel: {
                  include: {
                    utilisateur: {
                      include: {
                        profil: true,
                      },
                    },
                  },
                },
              },
            },
          }),
        }),
        PeriodeService.getAll({
          take: 200,
          where: JSON.stringify({
            annee_scolaire_id: currentYear.id,
            annee: {
              etablissement_id,
            },
          }),
          orderBy: JSON.stringify([{ ordre: "asc" }, { date_debut: "asc" }]),
        }),
      ]);

      const cours = coursResult?.status.success
        ? ((coursResult.data.data as CoursWithRelations[]) ?? [])
        : [];
      const periodes = periodeResult?.status.success
        ? ((periodeResult.data.data as Periode[]) ?? [])
        : [];

      set({
        loading: false,
        errorMessage: "",
        initialData: {
          date: new Date(),
          note_max: 20,
          est_publiee: false,
          type: "AUTRE",
        },
        coursOptions: cours.map((item) => ({
          value: item.id,
          label: getCoursDisplayLabel(item),
        })),
        periodeOptions: periodes.map((item) => ({
          value: item.id,
          label: item.nom,
        })),
        cours,
        periodes,
      });
    } catch (error: unknown) {
      set({
        loading: false,
        errorMessage: getErrorMessage(error),
        coursOptions: [],
        periodeOptions: [],
        cours: [],
        periodes: [],
      });
    }
  },
}));
