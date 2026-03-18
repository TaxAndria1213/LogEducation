import { create } from "zustand";
import anneeScolaireService from "../../../services/anneeScolaire.service";
import ClasseService from "../../../services/classe.service";
import CoursService from "../../../services/cours.service";
import CreneauHoraireService from "../../../services/creneauHoraire.service";
import EmploiDuTempsService from "../../../services/emploiDuTemps.service";
import salleService from "../../../services/salle.service";
import type {
  AnneeScolaire,
  Classe,
  Cours,
  CreneauHoraire,
  EmploiDuTemps,
  Enseignant,
  Matiere,
  Personnel,
  Salle,
  Site,
} from "../../../types/models";
import {
  getPlannerCellKey,
  getTeacherDisplayLabel,
  type PlannerCellDraft,
  type ScheduleRow,
} from "../types";

type CourseRecord = Cours & {
  classe?: Classe | null;
  matiere?: Matiere | null;
  enseignant?: (Enseignant & {
    personnel?: (Personnel & {
      utilisateur?: {
        profil?: {
          prenom?: string | null;
          nom?: string | null;
        } | null;
      } | null;
    }) | null;
  }) | null;
};

type RoomRecord = Salle & {
  site?: Site | null;
};

type SavePlanningResult = {
  success: boolean;
  message: string;
  count: number;
};

type State = {
  etablissementId: string | null;
  loading: boolean;
  loadingPlanning: boolean;
  saving: boolean;
  error: string | null;
  currentYear: AnneeScolaire | null;
  classes: Classe[];
  courses: CourseRecord[];
  creneaux: CreneauHoraire[];
  salles: RoomRecord[];
  existingEntries: ScheduleRow[];
  planner: Record<string, PlannerCellDraft>;
  selectedClasseId: string;
  initialize: (etablissementId: string) => Promise<void>;
  selectClasse: (classeId: string) => Promise<void>;
  updatePlannerCell: (
    day: number,
    creneauId: string,
    patch: Partial<PlannerCellDraft>,
  ) => void;
  clearPlanner: () => void;
  resetFromExisting: () => void;
  savePlanning: () => Promise<SavePlanningResult>;
};

function mapRowsToPlanner(rows: ScheduleRow[]): Record<string, PlannerCellDraft> {
  return rows.reduce<Record<string, PlannerCellDraft>>((acc, row) => {
    acc[getPlannerCellKey(row.jour_semaine, row.creneau_horaire_id)] = {
      cours_id: row.cours_id ?? undefined,
      salle_id: row.salle_id ?? undefined,
      sourceId: row.id,
    };
    return acc;
  }, {});
}

function isCellConfigured(cell?: PlannerCellDraft) {
  return Boolean(cell?.cours_id);
}

export const useEmploiDuTempsDashboardStore = create<State>((set, get) => ({
  etablissementId: null,
  loading: false,
  loadingPlanning: false,
  saving: false,
  error: null,
  currentYear: null,
  classes: [],
  courses: [],
  creneaux: [],
  salles: [],
  existingEntries: [],
  planner: {},
  selectedClasseId: "",

  initialize: async (etablissementId: string) => {
    set({
      etablissementId,
      loading: true,
      error: null,
    });

    try {
      const classeService = new ClasseService();
      const creneauHoraireService = new CreneauHoraireService();

      const currentYear = await anneeScolaireService.getCurrent(etablissementId);

      if (!currentYear) {
        set({
          currentYear: null,
          classes: [],
          courses: [],
          existingEntries: [],
          planner: {},
          creneaux: [],
          salles: [],
          selectedClasseId: "",
          error:
            "Aucune annee scolaire active n'a ete trouvee pour cet etablissement.",
        });
        return;
      }

      const [classesResult, creneauxResult, sallesResult] = await Promise.all([
        classeService.getAll({
          take: 1000,
          where: JSON.stringify({
            etablissement_id: etablissementId,
            annee_scolaire_id: currentYear.id,
          }),
          includeSpec: JSON.stringify({
            niveau: true,
            site: true,
          }),
          orderBy: JSON.stringify([{ nom: "asc" }]),
        }),
        creneauHoraireService.getAll({
          take: 1000,
          where: JSON.stringify({ etablissement_id: etablissementId }),
          orderBy: JSON.stringify([{ ordre: "asc" }, { heure_debut: "asc" }]),
        }),
        salleService.getAll({
          take: 1000,
          where: JSON.stringify({
            site: {
              etablissement_id: etablissementId,
            },
          }),
          includeSpec: JSON.stringify({
            site: true,
          }),
          orderBy: JSON.stringify([{ nom: "asc" }]),
        }),
      ]);

      const classes = classesResult?.status.success ? classesResult.data.data : [];
      const creneaux = creneauxResult?.status.success
        ? creneauxResult.data.data
        : [];
      const salles = sallesResult?.status.success ? sallesResult.data.data : [];

      const selectedClasseId =
        classes.find((item: Classe) => item.id === get().selectedClasseId)?.id ??
        classes[0]?.id ??
        "";

      set({
        currentYear,
        classes,
        creneaux,
        salles,
        selectedClasseId,
        error: classes.length
          ? null
          : "Aucune classe n'est disponible sur l'annee scolaire en cours.",
      });

      if (selectedClasseId) {
        await get().selectClasse(selectedClasseId);
      } else {
        set({
          courses: [],
          existingEntries: [],
          planner: {},
        });
      }
    } catch (error) {
      console.log(error);
      set({
        error:
          "Impossible de charger le tableau de bord de l'emploi du temps pour le moment.",
      });
    } finally {
      set({ loading: false });
    }
  },

  selectClasse: async (classeId: string) => {
    const { currentYear, etablissementId } = get();

    set({
      selectedClasseId: classeId,
      loadingPlanning: true,
      error: currentYear
        ? null
        : "Aucune annee scolaire active n'est definie pour ce planning.",
    });

    if (!currentYear || !etablissementId || !classeId) {
      set({
        courses: [],
        existingEntries: [],
        planner: {},
        loadingPlanning: false,
      });
      return;
    }

    try {
      const coursService = new CoursService();
      const emploiDuTempsService = new EmploiDuTempsService();

      const [coursesResult, planningResult] = await Promise.all([
        coursService.getAll({
          take: 1000,
          where: JSON.stringify({
            etablissement_id: etablissementId,
            annee_scolaire_id: currentYear.id,
            classe_id: classeId,
          }),
          includeSpec: JSON.stringify({
            classe: true,
            matiere: true,
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
        emploiDuTempsService.getClassePlanning(classeId),
      ]);

      const courses = coursesResult?.status.success
        ? [...coursesResult.data.data].sort((a: CourseRecord, b: CourseRecord) =>
            `${a.matiere?.nom ?? ""} ${getTeacherDisplayLabel(a.enseignant)}`
              .localeCompare(
                `${b.matiere?.nom ?? ""} ${getTeacherDisplayLabel(b.enseignant)}`,
              ),
          )
        : [];
      const existingEntries = planningResult?.status.success
        ? planningResult.data.data
        : [];

      set({
        courses,
        existingEntries,
        planner: mapRowsToPlanner(existingEntries),
        error: null,
      });
    } catch (error) {
      console.log(error);
      set({
        courses: [],
        existingEntries: [],
        planner: {},
        error:
          "Impossible de charger le planning global de cette classe pour le moment.",
      });
    } finally {
      set({ loadingPlanning: false });
    }
  },

  updatePlannerCell: (day: number, creneauId: string, patch: Partial<PlannerCellDraft>) =>
    set((state) => {
      const key = getPlannerCellKey(day, creneauId);
      const nextValue = {
        ...state.planner[key],
        ...patch,
      };

      if (!isCellConfigured(nextValue)) {
        const nextPlanner = { ...state.planner };
        delete nextPlanner[key];
        return { planner: nextPlanner };
      }

      return {
        planner: {
          ...state.planner,
          [key]: nextValue,
        },
      };
    }),

  clearPlanner: () => set({ planner: {} }),

  resetFromExisting: () =>
    set((state) => ({
      planner: mapRowsToPlanner(state.existingEntries),
    })),

  savePlanning: async () => {
    const {
      currentYear,
      selectedClasseId,
      planner,
      courses,
      existingEntries,
    } = get();

    if (!currentYear) {
      return {
        success: false,
        message: "Aucune annee scolaire active n'est disponible.",
        count: 0,
      };
    }

    if (!selectedClasseId) {
      return {
        success: false,
        message: "Selectionne d'abord une classe a planifier.",
        count: 0,
      };
    }

    const emploiDuTempsService = new EmploiDuTempsService();
    const entries = Object.entries(planner).flatMap(([key, cell]) => {
      if (!cell?.cours_id) return [];

      const [dayPart, creneauId] = key.split("::");
      const day = Number.parseInt(dayPart, 10);
      const course = courses.find((item) => item.id === cell.cours_id);

      return [
        {
          classe_id: selectedClasseId,
          cours_id: cell.cours_id,
          matiere_id: course?.matiere_id ?? null,
          enseignant_id: course?.enseignant_id ?? null,
          salle_id: cell.salle_id ?? null,
          jour_semaine: day,
          creneau_horaire_id: creneauId,
          effectif_du: currentYear.date_debut,
          effectif_au: currentYear.date_fin,
        } satisfies Omit<EmploiDuTemps, "id" | "created_at" | "updated_at">,
      ];
    });

    set({ saving: true });

    try {
      const result = await emploiDuTempsService.replaceClassePlanning(
        selectedClasseId,
        entries,
      );

      if (!result?.status.success) {
        return {
          success: false,
          message: "Le planning global n'a pas pu etre enregistre.",
          count: 0,
        };
      }

      const refreshed = await emploiDuTempsService.getClassePlanning(selectedClasseId);
      const refreshedEntries = refreshed?.status.success ? refreshed.data.data : [];

      set({
        existingEntries: refreshedEntries,
        planner: mapRowsToPlanner(refreshedEntries),
      });

      const createdCount = entries.length;
      const updatedCount = existingEntries.length;

      return {
        success: true,
        message:
          updatedCount > 0
            ? `Le planning global a ete remplace avec ${createdCount} creneau(x) recurrent(s).`
            : `Le planning annuel a ete cree avec ${createdCount} creneau(x) recurrent(s).`,
        count: createdCount,
      };
    } catch (error) {
      console.log(error);
      return {
        success: false,
        message:
          "Une erreur est survenue pendant l'enregistrement global de l'emploi du temps.",
        count: 0,
      };
    } finally {
      set({ saving: false });
    }
  },
}));
