import { create } from "zustand";
import type { NiveauScolaire, Programme } from "../../../../types/models";
import anneeScolaireService from "../../../../services/anneeScolaire.service";
import NiveauScolaireService from "../../../../services/niveau.service";

export type ProgrammeCreateInput = Omit<
  Programme,
  "id" | "created_at" | "updated_at"
>;

type State = {
  loading: boolean;
  setLoading: (loading: boolean) => void;
  initialData: Partial<ProgrammeCreateInput> | null;
  anneeScolaireOptions: { value: string; label: string }[];
  niveauOptions: { value: string; label: string }[];
  getOptions: (etablissement_id: string) => Promise<void>;
};

export const useProgrammeCreateStore = create<State>((set) => ({
  loading: false,
  initialData: null,
  anneeScolaireOptions: [],
  niveauOptions: [],

  setLoading: (loading: boolean) => set({ loading }),
  getOptions: async (etablissement_id: string) => {
    set({ loading: true });
    // récupération de l'année scolaire :
    const result = await anneeScolaireService.getCurrent(etablissement_id as string);
    if (result) {
      set({
        initialData: {
            etablissement_id: etablissement_id,
            annee_scolaire_id: result.id
        },
        anneeScolaireOptions: [
          {
            value: result.id,
            label: result.nom,
          }
        ]
      });
    }

    //récupération des options niveaux :
    const niveauService = new NiveauScolaireService();
    const resultNiveau = await niveauService.getAll({
        take: 1000,
        where: JSON.stringify({ etablissement_id: etablissement_id }),
    })

    if (resultNiveau?.status.success) {
        set({
            niveauOptions: resultNiveau.data.data.map((d: NiveauScolaire) => ({
                value: d.id,
                label: d.nom,
            })),
        });
    }

    set({ loading: false });
  },
}));
