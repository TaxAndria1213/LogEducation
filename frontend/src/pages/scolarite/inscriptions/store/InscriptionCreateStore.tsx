/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import type { Inscription } from "../../../../generated/zod";
import InscriptionService from "../../../../services/inscription.service";
import AnneeScolaireService from "../../../../services/anneeScolaire.service";
import { formatDateWithLocalTimezone } from "../../../../app/utils/functions";
import type { AnneeScolaire, Classe } from "../../../../types/models";
import type { InscriptionScolarite } from "../../../../types/form";
import ClasseService from "../../../../services/classe.service";

export type InscriptionCreateInput = Partial<
  Inscription>;

type State = {
  loading: boolean;
  inscription: InscriptionCreateInput | null;
  initialData: Partial<InscriptionCreateInput> | null;
  service: InscriptionService;
  
  // option pour la scolarité
  scolariteInitialData: Partial<InscriptionScolarite> | null;
  classeOptions: { value: string; label: string }[];
  anneeScolaireId: string | null;

  onCreate: (inscription: InscriptionCreateInput) => Promise<any>;
  onCreateFull: (payload: any) => Promise<any>;
  setLoading: (loading: boolean) => void;
  setInscription: (inscription: InscriptionCreateInput) => void;
  getInscriptionOptions: (etablissement_id: string) => Promise<void>;
  setInitialData: (inscription: Partial<Inscription>) => void;
};

export const useInscriptionCreateStore = create<State>((set, get) => ({
  inscription: null,
  service: new InscriptionService(),
  loading: false,
  initialData: null,
  scolariteInitialData: null,
  classeOptions: [],
  anneeScolaireId: null,

  setLoading: (loading: boolean) => set({ loading }),

  getInscriptionOptions: async (etablissement_id: string) => {
    set({ loading: true });
    // Récupération des données pour le code élève
    //// récupération de l'année actuelle
    const anneeScolaireService = AnneeScolaireService;
    const anneeScolaire: AnneeScolaire =
      await anneeScolaireService.getCurrent(etablissement_id);
    //// récupération du nombre d'élève inscrit dans l'annee actuelle
    const inscriptionService = new InscriptionService();
    const registeredNumber =
      await inscriptionService.getStudentRegisteredNumberThisYear(
        anneeScolaire.id,
      );
    set({ anneeScolaireId: anneeScolaire.id });

    //// mise en forme des données de code
    if (anneeScolaire) {
      console.log("🚀 ~ anneeScolaire:", anneeScolaire);
      const { annee } = formatDateWithLocalTimezone(
        anneeScolaire.date_debut.toString(),
      );
      const code =
        "E" + annee + (registeredNumber + 1).toString().padStart(4, "0");
      console.log("🚀 ~ code:", code)
      set({scolariteInitialData: {...get().scolariteInitialData, code_eleve: code}})
    } else {
      throw new Error("Failed to load etablissement options");
    }
    //Récupération de la liste des classes
    const classeService = new ClasseService();
    const classes = await classeService.getAll({
      take: 1000,
      where: JSON.stringify({ etablissement_id: etablissement_id, annee_scolaire_id: anneeScolaire.id }),
    })

    if (classes?.status.success) {
      const options = classes.data.data.map((classe: Classe) => ({
        value: classe.id,
        label: classe.nom,
      }));
      set({ classeOptions: options });
    }

    // définir la date d'entrée et la date d'inscription par la date d'aujourd'hui
    const today = new Date().toISOString();
    set({scolariteInitialData: {...get().scolariteInitialData, date_entree: today, date_inscription: today, statut_inscription: "INSCRIT"}})

    set({ loading: false });
  },

  setInitialData: (inscription: Partial<Inscription>) =>
    set({ initialData: inscription }),

  onCreate: async (inscription: InscriptionCreateInput): Promise<any> => {
    try {
      const result = await get().service.create(inscription);
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

  setInscription: (inscription: InscriptionCreateInput) =>
    set({ inscription: inscription }),

  onCreateFull: async (payload: any): Promise<any> => {
    try {
      const result = await get().service.createFull(payload);
      if (result?.status?.success) {
        return result;
      }
      throw new Error();
    } catch (error) {
      console.log("🚀 ~ error:", error);
      return { status: { success: false } };
    }
  },
}));
