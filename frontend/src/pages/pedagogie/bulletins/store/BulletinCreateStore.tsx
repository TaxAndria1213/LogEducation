import { create } from "zustand";
import type { Bulletin, Inscription, Periode } from "../../../../types/models";
import periodeService from "../../../../services/periode.service";
import anneeScolaireService from "../../../../services/anneeScolaire.service";
import InscriptionService from "../../../../services/inscription.service";
import BulletinService from "../../../../services/bulletin.service";

export type MatiereCreateInput = Omit<
  Bulletin,
  "id" | "created_at" | "updated_at"
>;

type State = {
  loading: boolean;
  initialData: Partial<MatiereCreateInput> | null;
  eleveOptions: { value: string; label: string }[];
  periodeOptions: { value: string; label: string }[];
  setLoading: (loading: boolean) => void;
  getOptions: (etablissement_id: string) => Promise<void>;
  onCreate: (data: MatiereCreateInput) => Promise<void>;
};

export const useBulletinCreateStore = create<State>((set) => ({
  loading: false,
  initialData: null,
  eleveOptions: [],
  periodeOptions: [],

  setLoading: (loading: boolean) => set({ loading }),

  getOptions: async (etablissement_id: string) => {
    console.log("🚀 ~ etablissement_id:", etablissement_id);
    set({ loading: true });
    set({
      initialData: {
        publie_le: new Date(),
      },
    });
    // récupération de l'année actuelle :
    const anneeScolaire =
      await anneeScolaireService.getCurrent(etablissement_id);

    // récupération des élèves :
    if (anneeScolaire) {
      const inscriptionService = new InscriptionService();
      const eleveResult = await inscriptionService.getAll({
        take: 1000,
        where: JSON.stringify({
          annee_scolaire_id: anneeScolaire?.id,
        } as Partial<Inscription>),
        includeSpec: JSON.stringify({
          eleve: {
            include: { utilisateur: { include: { profil: true } } },
          },
        }),
      });
      console.log("🚀 ~ eleveResult:", eleveResult);

      if (eleveResult?.status.success) {
        set({
          eleveOptions: eleveResult.data.data.map((d: Inscription) => ({
            value: d.id,
            label:
              d.eleve?.code_eleve +
              " - " +
              d.eleve?.utilisateur?.profil?.prenom +
              " " +
              d.eleve?.utilisateur?.profil?.nom,
          })),
        });
      }

      // Récupération des périodes
      const periodeResult = await periodeService.getAll({
        take: 1000,
        where: JSON.stringify({
          annee_scolaire_id: anneeScolaire?.id,
        }),
      });

      if (periodeResult?.status.success) {
        set({
          periodeOptions: periodeResult.data.data.map((d: Periode) => ({
            value: d.id,
            label: d.nom,
          })),
        });
      }
    }

    set({ loading: false });
  },

  onCreate: async (data: MatiereCreateInput) => {
    const service = new BulletinService();
    const result = await service.create(data);
    console.log("🚀 ~ result:", result);
  },
}));
