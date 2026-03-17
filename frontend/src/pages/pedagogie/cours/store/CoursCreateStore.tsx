import { create } from "zustand";
import type { Classe, Cours, Enseignant } from "../../../../types/models";
import anneeScolaireService from "../../../../services/anneeScolaire.service";
import ClasseService from "../../../../services/classe.service";
import MatiereService from "../../../../services/matiere.service";
import EnseignantService from "../../../../services/enseignant.service";

export type CoursCreateInput = Omit<Cours, "id" | "created_at" | "updated_at">;

type State = {
  loading: boolean;
  initialData: Partial<CoursCreateInput> | null;
  anneeScolaireOtpions: { value: string; label: string }[];
  classeOptions: { value: string; label: string }[];
  matiereOptions: { value: string; label: string }[];
  enseignantOptions: { value: string; label: string }[];
  setLoading: (loading: boolean) => void;
  getOptions: (etablissement_id: string) => Promise<void>;
};

export const useCoursCreateStore = create<State>((set) => ({
  loading: false,
  initialData: null,
  anneeScolaireOtpions: [],
  classeOptions: [],
  matiereOptions: [],
  enseignantOptions: [],

  setLoading: (loading: boolean) => set({ loading }),

  getOptions: async (etablissement_id: string) => {
    set({ loading: true });
    //recuperation de l'annee scolaire :
    const anneeScolaireResult =
      await anneeScolaireService.getCurrent(etablissement_id);

    if (anneeScolaireResult) {
      set({
        initialData: { etablissement_id: etablissement_id, annee_scolaire_id: anneeScolaireResult.id },
        anneeScolaireOtpions: [
          {
            value: anneeScolaireResult.id,
            label: anneeScolaireResult.nom,
          },
        ],
      });
    }

    //récupération des options de classes
    const classeService = new ClasseService();
    const classesResult = await classeService.getAll({
        take: 1000,
        where: JSON.stringify({ etablissement_id: etablissement_id, annee_scolaire_id: anneeScolaireResult?.id }),
    });

    if (classesResult?.status.success) {
        set({
            classeOptions: classesResult.data.data.map((d: Classe) => ({
                value: d.id,
                label: d.nom,
            })),
        });
    }

    //récupération des options de matieres
    const matiereService = new MatiereService();
    const matieresResult = await matiereService.getAll({
        take: 1000,
        where: JSON.stringify({ etablissement_id: etablissement_id }),
    })

    if (matieresResult?.status.success) {
        set({
            matiereOptions: matieresResult.data.data.map((d: Classe) => ({
                value: d.id,
                label: d.nom,
            })),
        });
    }

    //récupération des options des enseignants
    const enseignantService = new EnseignantService();
    const enseignantsResult = await enseignantService.getAll({
        take: 1000,
        where: JSON.stringify({ personnel: {etablissement_id: etablissement_id} }),
        includeSpec: JSON.stringify({ personnel: {
            include: {
                utilisateur: {
                    include: {
                        profil: true
                    }
                }
            }
        } }),
    })
    if (enseignantsResult?.status.success) {
        set({
            enseignantOptions: enseignantsResult.data.data.map((d: Enseignant) => ({
                value: d.id,
                label: d.personnel?.utilisateur?.profil?.nom + ' ' + d.personnel?.utilisateur?.profil?.prenom,
            })),
        });
    }

    set({ loading: false });
  },
}));
