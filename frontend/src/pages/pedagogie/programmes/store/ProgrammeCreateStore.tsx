import { create } from "zustand";
import type { Matiere, NiveauScolaire, Programme } from "../../../../types/models";
import anneeScolaireService from "../../../../services/anneeScolaire.service";
import NiveauScolaireService from "../../../../services/niveau.service";
import MatiereService, {
  getMatiereDisplayLabel,
  type MatiereWithRelations,
} from "../../../../services/matiere.service";

export type ProgrammeCreateInput = Omit<
  Programme,
  "id" | "created_at" | "updated_at"
> & {
  matieres?: Array<{
    matiere_id: string;
    heures_semaine: number | null;
    coefficient: number | null;
  }>;
};

type Option = { value: string; label: string };

type State = {
  loading: boolean;
  errorMessage: string;
  setLoading: (loading: boolean) => void;
  initialData: Partial<ProgrammeCreateInput> | null;
  anneeScolaireOptions: Option[];
  niveauOptions: Option[];
  matiereOptions: Option[];
  getOptions: (etablissement_id: string) => Promise<void>;
};

export const useProgrammeCreateStore = create<State>((set) => ({
  loading: false,
  errorMessage: "",
  initialData: null,
  anneeScolaireOptions: [],
  niveauOptions: [],
  matiereOptions: [],

  setLoading: (loading: boolean) => set({ loading }),
  getOptions: async (etablissement_id: string) => {
    set({
      loading: true,
      errorMessage: "",
    });

    try {
      const result = await anneeScolaireService.getCurrent(etablissement_id);
      if (result) {
        set({
          initialData: {
            etablissement_id,
            annee_scolaire_id: result.id,
            matieres: [
              {
                matiere_id: "",
                heures_semaine: null,
                coefficient: null,
              },
            ],
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
            etablissement_id,
            matieres: [
              {
                matiere_id: "",
                heures_semaine: null,
                coefficient: null,
              },
            ],
          },
        });
      }

      const niveauService = new NiveauScolaireService();
      const matiereService = new MatiereService();

      const [resultNiveau, resultMatiere] = await Promise.all([
        niveauService.getAll({
          take: 1000,
          where: JSON.stringify({ etablissement_id }),
          orderBy: JSON.stringify([{ ordre: "asc" }, { nom: "asc" }]),
        }),
        matiereService.getForEtablissement(etablissement_id, {
          take: 1000,
          includeSpec: JSON.stringify({
            departement: true,
          }),
          orderBy: JSON.stringify([{ nom: "asc" }]),
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
