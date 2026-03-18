import { create } from "zustand";
import type {
  Classe,
  Cours,
  CreneauHoraire,
  Enseignant,
  Matiere,
  Salle,
} from "../../../types/models";
import ClasseService from "../../../services/classe.service";
import CoursService from "../../../services/cours.service";
import CreneauHoraireService from "../../../services/creneauHoraire.service";
import EnseignantService from "../../../services/enseignant.service";
import MatiereService from "../../../services/matiere.service";
import salleService from "../../../services/salle.service";
import type { ScheduleFormInput, SelectOption } from "../types";

type State = {
  loading: boolean;
  classeOptions: SelectOption[];
  coursOptions: SelectOption[];
  matiereOptions: SelectOption[];
  enseignantOptions: SelectOption[];
  salleOptions: SelectOption[];
  creneauOptions: SelectOption[];
  setLoading: (loading: boolean) => void;
  getOptions: (etablissement_id: string) => Promise<void>;
};

export const useEmploiDuTempsCreateStore = create<State>((set) => ({
  loading: false,
  classeOptions: [],
  coursOptions: [],
  matiereOptions: [],
  enseignantOptions: [],
  salleOptions: [],
  creneauOptions: [],

  setLoading: (loading: boolean) => set({ loading }),

  getOptions: async (etablissement_id: string) => {
    set({ loading: true });

    const classeService = new ClasseService();
    const coursService = new CoursService();
    const matiereService = new MatiereService();
    const enseignantService = new EnseignantService();
    const creneauHoraireService = new CreneauHoraireService();

    const [
      classeResult,
      coursResult,
      matiereResult,
      enseignantResult,
      salleResult,
      creneauResult,
    ] = await Promise.all([
      classeService.getAll({
        take: 1000,
        where: JSON.stringify({ etablissement_id }),
      }),
      coursService.getAll({
        take: 1000,
        where: JSON.stringify({ etablissement_id }),
        includeSpec: JSON.stringify({
          classe: true,
          matiere: true,
        }),
      }),
      matiereService.getAll({
        take: 1000,
        where: JSON.stringify({ etablissement_id }),
      }),
      enseignantService.getAll({
        take: 1000,
        where: JSON.stringify({
          personnel: {
            etablissement_id,
          },
        }),
        includeSpec: JSON.stringify({
          personnel: true,
        }),
      }),
      salleService.getAll({
        take: 1000,
        where: JSON.stringify({
          site: {
            etablissement_id,
          },
        }),
        includeSpec: JSON.stringify({
          site: true,
        }),
      }),
      creneauHoraireService.getAll({
        take: 1000,
        where: JSON.stringify({ etablissement_id }),
        orderBy: JSON.stringify({ ordre: "asc" }),
      }),
    ]);

    set({
      classeOptions: classeResult?.status.success
        ? classeResult.data.data.map((item: Classe) => ({
            value: item.id,
            label: item.nom,
          }))
        : [],
      coursOptions: coursResult?.status.success
        ? coursResult.data.data.map((item: Cours) => ({
            value: item.id,
            label: `${item.matiere?.nom ?? item.matiere_id} - ${item.classe?.nom ?? item.classe_id}`,
          }))
        : [],
      matiereOptions: matiereResult?.status.success
        ? matiereResult.data.data.map((item: Matiere) => ({
            value: item.id,
            label: item.nom,
          }))
        : [],
      enseignantOptions: enseignantResult?.status.success
        ? enseignantResult.data.data.map((item: Enseignant) => ({
            value: item.id,
            label:
              item.personnel?.code_personnel ??
              item.personnel?.poste ??
              item.id,
          }))
        : [],
      salleOptions: salleResult?.status.success
        ? salleResult.data.data.map((item: Salle) => ({
            value: item.id,
            label: item.site?.nom ? `${item.nom} - ${item.site.nom}` : item.nom,
          }))
        : [],
      creneauOptions: creneauResult?.status.success
        ? creneauResult.data.data.map((item: CreneauHoraire) => ({
            value: item.id,
            label: `${item.nom} (${item.heure_debut} - ${item.heure_fin})`,
          }))
        : [],
      loading: false,
    });
  },
}));

export type EmploiDuTempsCreateInput = ScheduleFormInput;
