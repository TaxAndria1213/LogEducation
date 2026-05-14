import { create } from "zustand";
import type {
  GradingScale,
  Matiere,
  NiveauScolaire,
} from "../../../../types/models";
import anneeScolaireService from "../../../../services/anneeScolaire.service";
import NiveauScolaireService from "../../../../services/niveau.service";
import GradingScaleService, {
  getGradingScaleDisplayLabel,
  type GradingScaleWithRelations,
} from "../../../../services/gradingScale.service";
import MatiereService, {
  getMatiereDisplayLabel,
  type MatiereWithRelations,
} from "../../../../services/matiere.service";
import type {
  ProgrammeImpactSummary,
  ProgrammeLine,
  ProgrammeWithRelations,
} from "../../../../services/programme.service";

export type ProgrammeEditorLineInput = Omit<ProgrammeLine, "matiere" | "gradingScale"> & {
  heures_semaine: number | null;
  coefficient: number | null;
};

export type ProgrammeCreateInput = Partial<Omit<ProgrammeWithRelations, "matieres">> & {
  id?: string;
  impact?: ProgrammeImpactSummary | null;
  matieres?: ProgrammeEditorLineInput[];
};

type Option = { value: string; label: string };

type State = {
  loading: boolean;
  errorMessage: string;
  setLoading: (loading: boolean) => void;
  initialData: ProgrammeCreateInput | null;
  setInitialData: (value: ProgrammeCreateInput | null) => void;
  clearInitialData: () => void;
  anneeScolaireOptions: Option[];
  niveauOptions: Option[];
  matiereOptions: Option[];
  gradingScaleOptions: Option[];
  getOptions: (etablissement_id: string) => Promise<void>;
};

export const useProgrammeCreateStore = create<State>((set, get) => ({
  loading: false,
  errorMessage: "",
  initialData: null,
  anneeScolaireOptions: [],
  niveauOptions: [],
  matiereOptions: [],
  gradingScaleOptions: [],

  setLoading: (loading: boolean) => set({ loading }),
  setInitialData: (value) => set({ initialData: value }),
  clearInitialData: () => set({ initialData: null }),
  getOptions: async (etablissement_id: string) => {
    set({
      loading: true,
      errorMessage: "",
    });

    try {
      const result = await anneeScolaireService.getCurrent(etablissement_id);
      const existingInitialData = get().initialData;
      const defaultInitialData = existingInitialData ?? {
        etablissement_id,
        annee_scolaire_id: result?.id ?? "",
        matieres: [
          {
            matiere_id: "",
            heures_semaine: null,
            coefficient: null,
          },
        ],
      };

      if (result) {
        set({
          initialData: {
            ...defaultInitialData,
            etablissement_id:
              defaultInitialData.etablissement_id ?? etablissement_id,
            annee_scolaire_id:
              defaultInitialData.annee_scolaire_id ?? result.id,
          },
          anneeScolaireOptions: [
            {
              value: result.id,
              label: result.nom,
            },
          ],
        });
      } else {
        set({
          initialData: {
            ...defaultInitialData,
            etablissement_id:
              defaultInitialData.etablissement_id ?? etablissement_id,
          },
        });
      }

      const niveauService = new NiveauScolaireService();
      const matiereService = new MatiereService();
      const gradingScaleService = new GradingScaleService();

      const [resultNiveau, resultMatiere, resultGradingScale] = await Promise.all([
        niveauService.getAll({
          take: 1000,
          where: JSON.stringify({ etablissement_id }),
          orderBy: JSON.stringify([{ ordre: "asc" }, { nom: "asc" }]),
        }),
        matiereService.getForEtablissement(etablissement_id, {
          take: 100,
          includeSpec: JSON.stringify({
            departement: true,
          }),
          orderBy: JSON.stringify([{ nom: "asc" }]),
        }),
        gradingScaleService.getForEtablissement(etablissement_id, {
          take: 1000,
          orderBy: JSON.stringify([
            { is_default: "desc" },
            { nom: "asc" },
          ]),
        }),
      ]);

      if (resultNiveau?.status.success) {
        set({
          niveauOptions: resultNiveau.data.data.map((d: NiveauScolaire) => ({
            value: d.id,
            label: d.nom,
          })),
        });
      }

      if (resultMatiere?.status.success) {
        set({
          matiereOptions: resultMatiere.data.data.map((d: MatiereWithRelations | Matiere) => ({
            value: d.id,
            label: getMatiereDisplayLabel(d),
          })),
        });
      }

      if (resultGradingScale?.status.success) {
        set({
          gradingScaleOptions: resultGradingScale.data.data.map(
            (d: GradingScaleWithRelations | GradingScale) => ({
              value: d.id,
              label: getGradingScaleDisplayLabel(d),
            }),
          ),
        });
      }
    } catch {
      set({
        errorMessage:
          "Impossible de charger toutes les ressources du module Programmes.",
      });
    } finally {
      set({ loading: false });
    }
  },
}));
