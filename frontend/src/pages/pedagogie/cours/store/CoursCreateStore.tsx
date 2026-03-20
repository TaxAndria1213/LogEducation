import { create } from "zustand";
import type { Cours } from "../../../../types/models";
import anneeScolaireService from "../../../../services/anneeScolaire.service";
import ClasseService from "../../../../services/classe.service";
import {
  getTeacherDisplayLabel,
  type ClasseWithRelations,
  type EnseignantWithRelations,
} from "../../../../services/cours.service";
import EnseignantService from "../../../../services/enseignant.service";
import MatiereService, {
  getMatiereDisplayLabel,
  type MatiereWithRelations,
} from "../../../../services/matiere.service";
import ProgrammeService, {
  type ProgrammeWithRelations,
} from "../../../../services/programme.service";

type SelectOption = {
  value: string;
  label: string;
};

export type CoursCreateInput = Omit<Cours, "id" | "created_at" | "updated_at">;

type State = {
  loading: boolean;
  errorMessage: string;
  initialData: Partial<CoursCreateInput> | null;
  anneeScolaireOptions: SelectOption[];
  classeOptions: SelectOption[];
  matiereOptions: SelectOption[];
  enseignantOptions: SelectOption[];
  classes: ClasseWithRelations[];
  matieres: MatiereWithRelations[];
  enseignants: EnseignantWithRelations[];
  programmes: ProgrammeWithRelations[];
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

  return "Impossible de charger les ressources du module Cours.";
}

export const useCoursCreateStore = create<State>((set) => ({
  loading: false,
  errorMessage: "",
  initialData: null,
  anneeScolaireOptions: [],
  classeOptions: [],
  matiereOptions: [],
  enseignantOptions: [],
  classes: [],
  matieres: [],
  enseignants: [],
  programmes: [],

  setLoading: (loading: boolean) => set({ loading }),

  getOptions: async (etablissement_id: string) => {
    set({ loading: true, errorMessage: "" });

    try {
      const currentYear = await anneeScolaireService.getCurrent(etablissement_id);

      if (!currentYear) {
        set({
          loading: false,
          initialData: {
            etablissement_id,
          },
          anneeScolaireOptions: [],
          classeOptions: [],
          matiereOptions: [],
          enseignantOptions: [],
          classes: [],
          matieres: [],
          enseignants: [],
          programmes: [],
          errorMessage:
            "Aucune annee scolaire active n'a ete trouvee pour preparer la creation d'un cours.",
        });
        return;
      }

      const classeService = new ClasseService();
      const matiereService = new MatiereService();
      const enseignantService = new EnseignantService();
      const programmeService = new ProgrammeService();

      const [classesResult, matieresResult, enseignantsResult, programmesResult] =
        await Promise.all([
          classeService.getAll({
            take: 1000,
            where: JSON.stringify({
              etablissement_id,
              annee_scolaire_id: currentYear.id,
            }),
            includeSpec: JSON.stringify({
              niveau: true,
              site: true,
            }),
            orderBy: JSON.stringify([{ nom: "asc" }]),
          }),
          matiereService.getForEtablissement(etablissement_id, {
            take: 1000,
            includeSpec: JSON.stringify({
              departement: true,
            }),
            orderBy: JSON.stringify([{ nom: "asc" }]),
          }),
          enseignantService.getAll({
            take: 1000,
            where: JSON.stringify({
              personnel: {
                etablissement_id,
              },
            }),
            includeSpec: JSON.stringify({
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
            }),
            orderBy: JSON.stringify([{ created_at: "desc" }]),
          }),
          programmeService.getForEtablissement(etablissement_id, {
            take: 1000,
            where: {
              annee_scolaire_id: currentYear.id,
            },
            includeSpec: JSON.stringify({
              niveau: true,
              matieres: {
                include: {
                  matiere: {
                    include: {
                      departement: true,
                    },
                  },
                },
              },
            }),
            orderBy: JSON.stringify([{ created_at: "desc" }]),
          }),
        ]);

      const classes = classesResult?.status.success
        ? ((classesResult.data.data as ClasseWithRelations[]) ?? [])
        : [];
      const matieres = matieresResult?.status.success
        ? ((matieresResult.data.data as MatiereWithRelations[]) ?? [])
        : [];
      const enseignants = enseignantsResult?.status.success
        ? ((enseignantsResult.data.data as EnseignantWithRelations[]) ?? [])
        : [];
      const programmes = programmesResult?.status.success
        ? ((programmesResult.data.data as ProgrammeWithRelations[]) ?? [])
        : [];

      set({
        loading: false,
        errorMessage: "",
        initialData: {
          etablissement_id,
          annee_scolaire_id: currentYear.id,
          coefficient_override: null,
        },
        anneeScolaireOptions: [
          {
            value: currentYear.id,
            label: currentYear.nom,
          },
        ],
        classeOptions: classes.map((item) => ({
          value: item.id,
          label: item.nom,
        })),
        matiereOptions: matieres.map((item) => ({
          value: item.id,
          label: getMatiereDisplayLabel(item),
        })),
        enseignantOptions: enseignants.map((item) => ({
          value: item.id,
          label: getTeacherDisplayLabel(item),
        })),
        classes,
        matieres,
        enseignants,
        programmes,
      });
    } catch (error: unknown) {
      set({
        loading: false,
        errorMessage: getErrorMessage(error),
        classes: [],
        matieres: [],
        enseignants: [],
        programmes: [],
      });
    }
  },
}));
