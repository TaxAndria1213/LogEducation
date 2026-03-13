/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import type {
  Etablissement,
  Classe,
  AnneeScolaire,
} from "../../../../generated/zod";
import ClasseService from "../../../../services/classe.service";
import EtablissementService from "../../../../services/etablissement.service";
import AnneeScolaireService from "../../../../services/anneeScolaire.service";
import NiveauScolaireService from "../../../../services/niveau.service";
import SiteService from "../../../../services/site.service";

export type ClasseCreateInput = Omit<
  Classe,
  "id" | "created_at" | "updated_at"
>;

type State = {
  loading: boolean;
  classe: ClasseCreateInput | null;
  initialData: Partial<ClasseCreateInput> | null;
  service: ClasseService;
  etablissementOptions: { value: string; label: string }[];
  anneeScolaireOptions: { value: string; label: string }[];
  siteOptions: { value: string; label: string }[];
  niveauOptions: { value: string; label: string }[];
  currentAnneeScolaire: AnneeScolaire | null;
  onCreate: (classe: ClasseCreateInput) => Promise<any>;
  setLoading: (loading: boolean) => void;
  setClasse: (classe: ClasseCreateInput) => void;
  getEtablissementOptions: () => Promise<void>;
  getAnneeScolaire: () => Promise<void>;
  getSiteOptions: () => Promise<void>;
  setInitialData: (classe: Partial<Classe>) => void;
  setNiveauOptions: () => Promise<void>;
};

export const useClasseCreateStore = create<State>((set, get) => ({
  classe: null,
  service: new ClasseService(),
  etablissementOptions: [],
  loading: false,
  initialData: null,
  currentAnneeScolaire: null,
  anneeScolaireOptions: [],
  niveauOptions: [],
  siteOptions: [],

  getSiteOptions: async () => {
    try {
      const siteService = new SiteService();
      const result = await siteService.getAll({
        take: 1000,
        where: JSON.stringify({ etablissement_id: get().initialData?.etablissement_id }),
      });
      if (result?.status.success) {
        set({
          siteOptions: result.data.data.map((s: any) => ({
            value: s.id,
            label: s.nom,
          })),
        });
      }
    } catch (error) {
      console.log(error);
    }
  },

  setNiveauOptions: async () => {
    try {
      const niveauService = new NiveauScolaireService();
      const result = await niveauService.getAll({
        take: 1000,
        where: JSON.stringify({ etablissement_id: get().initialData?.etablissement_id }),
      })
      if (result?.status.success) {
        set({
          niveauOptions: result.data.data.map((n: any) => ({
            value: n.id,
            label: n.nom,
          })),
        });
      }
    } catch (error) {
      console.log(error);
    }
  },

  setLoading: (loading: boolean) => set({ loading }),

  getEtablissementOptions: async () => {
    set({ loading: true });
    const etablissementService = new EtablissementService();
    const result = await etablissementService.getAll({
      take: 1000,
    });
    if (result?.status.success) {
      set({
        etablissementOptions: result.data.data.map((e: Etablissement) => ({
          value: e.id,
          label: e.nom,
        })),
      });
      await get().getAnneeScolaire();
      await get().setNiveauOptions();
      await get().getSiteOptions();
    } else {
      throw new Error("Failed to load etablissement options");
    }
    set({ loading: false });
  },

  getAnneeScolaire: async () => {
    const anneeScolaireService = AnneeScolaireService;
    try {
      const result = await anneeScolaireService.getLast({
        etablissement_id: get().initialData?.etablissement_id,
      } as Partial<AnneeScolaire>);
      if (result?.status.success) {
        console.log(result);
        set({
          initialData: {
            ...get().initialData,
            annee_scolaire_id: result.data.id,
          },
        });
        set({
          anneeScolaireOptions: [
            {
              value: result.data.id,
              label: result.data.nom,
            },
          ],
        });
        set({
          currentAnneeScolaire: result.data,
        });
      }
    } catch (error) {
      console.log(error);
    }
  },

  setInitialData: (classe: Partial<Classe>) => set({ initialData: classe }),

  onCreate: async (classe: ClasseCreateInput): Promise<any> => {
    try {
      const result = await get().service.create(classe);
      if (result?.status.success) {
        return result;
      } else {
        throw new Error();
      }
    } catch (error) {
      console.log("🚀 ~ error:", error);
      //   throw error;
      return {
        status: {
          success: false,
        },
      };
    }
  },

  setClasse: (classe: ClasseCreateInput) => set({ classe: classe }),
}));
