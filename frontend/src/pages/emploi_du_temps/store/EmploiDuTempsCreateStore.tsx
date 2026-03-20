import { create } from "zustand";
import type {
  Classe,
  CreneauHoraire,
  Enseignant,
  Salle,
} from "../../../types/models";
import ClasseService from "../../../services/classe.service";
import CoursService, {
  getCoursDisplayLabel,
  type CoursWithRelations,
} from "../../../services/cours.service";
import CreneauHoraireService from "../../../services/creneauHoraire.service";
import EnseignantService from "../../../services/enseignant.service";
import MatiereService, {
  getMatiereDisplayLabel,
  type MatiereWithRelations,
} from "../../../services/matiere.service";
import salleService from "../../../services/salle.service";
import {
  PAUSE_COURSE_ID,
  getTeacherDisplayLabel,
  type ScheduleFormInput,
  type SelectOption,
} from "../types";

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
        take: 5000,
        where: JSON.stringify({ etablissement_id }),
        orderBy: JSON.stringify([{ nom: "asc" }]),
      }),
      coursService.getForEtablissement(etablissement_id, {
        take: 5000,
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
      matiereService.getForEtablissement(etablissement_id, {
        take: 5000,
        includeSpec: JSON.stringify({
          departement: true,
        }),
        orderBy: JSON.stringify([{ nom: "asc" }]),
      }),
      enseignantService.getAll({
        take: 5000,
        where: JSON.stringify({
          personnel: {
            etablissement_id,
          },
        }),
        includeSpec: JSON.stringify({
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
      }),
      salleService.getAll({
        take: 5000,
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
        take: 5000,
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
        ? [
            {
              value: PAUSE_COURSE_ID,
              label: "Pause",
            },
            ...coursResult.data.data.map((item: CoursWithRelations) => ({
              value: item.id,
              label: getCoursDisplayLabel(item),
            })),
          ]
        : [],
      matiereOptions: matiereResult?.status.success
        ? matiereResult.data.data.map((item: MatiereWithRelations) => ({
            value: item.id,
            label: getMatiereDisplayLabel(item),
          }))
        : [],
      enseignantOptions: enseignantResult?.status.success
        ? enseignantResult.data.data.map((item: Enseignant) => ({
            value: item.id,
            label: getTeacherDisplayLabel(item),
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
