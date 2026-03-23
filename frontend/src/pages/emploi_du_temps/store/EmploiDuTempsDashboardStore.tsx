/* eslint-disable @typescript-eslint/no-explicit-any */
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
  isPauseCourseValue,
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

export type PlanningMode = "recurrent" | "specific_week";

type PlanningWindow = {
  start: Date;
  end: Date;
};

const VIRTUAL_CRENEAU_PREFIX = "__virtual_creneau__";

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
  persistedCreneaux: CreneauHoraire[];
  salles: RoomRecord[];
  allEntries: ScheduleRow[];
  relatedEntries: ScheduleRow[];
  existingEntries: ScheduleRow[];
  planner: Record<string, PlannerCellDraft>;
  selectedClasseId: string;
  planningMode: PlanningMode;
  specificWeekStart: string;
  initialize: (etablissementId: string) => Promise<void>;
  selectClasse: (classeId: string) => Promise<void>;
  setPlanningMode: (mode: PlanningMode) => Promise<void>;
  setSpecificWeekStart: (value: string) => Promise<void>;
  updatePlannerCell: (
    day: number,
    creneauId: string,
    patch: Partial<PlannerCellDraft>,
  ) => void;
  clearPlanner: () => void;
  resetFromExisting: () => void;
  savePlanning: () => Promise<SavePlanningResult>;
};

function toDateInputValue(value?: Date | string | null): string {
  if (!value) return "";
  const date = parseDateValue(value);
  if (!date) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateValue(value?: Date | string | null): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return new Date(value.getTime());
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);

    if (dateOnlyMatch) {
      const [, year, month, day] = dateOnlyMatch;
      return new Date(Number(year), Number(month) - 1, Number(day));
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function startOfDay(value: Date | string): Date {
  const date = parseDateValue(value) ?? new Date(Number.NaN);
  if (Number.isNaN(date.getTime())) return date;
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value: Date | string): Date {
  const date = parseDateValue(value) ?? new Date(Number.NaN);
  if (Number.isNaN(date.getTime())) return date;
  date.setHours(23, 59, 59, 999);
  return date;
}

function addDays(value: Date | string, days: number): Date {
  const date = startOfDay(value);
  date.setDate(date.getDate() + days);
  return date;
}

function formatTime(totalMinutes: number): string {
  const hours = `${Math.floor(totalMinutes / 60)}`.padStart(2, "0");
  const minutes = `${totalMinutes % 60}`.padStart(2, "0");
  return `${hours}:${minutes}`;
}

function toMinutes(value?: string | null): number | null {
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  return Number.parseInt(match[1], 10) * 60 + Number.parseInt(match[2], 10);
}

function buildDefaultCreneaux(etablissementId: string): CreneauHoraire[] {
  const createdAt = new Date();
  const creneaux: CreneauHoraire[] = [];

  for (let minutes = 6 * 60, order = 1; minutes < 18 * 60; minutes += 30, order += 1) {
    const heureDebut = formatTime(minutes);
    const heureFin = formatTime(minutes + 30);
    creneaux.push({
      id: `${VIRTUAL_CRENEAU_PREFIX}${heureDebut.replace(":", "")}-${heureFin.replace(":", "")}`,
      etablissement_id: etablissementId,
      nom: `${heureDebut} - ${heureFin}`,
      heure_debut: heureDebut,
      heure_fin: heureFin,
      ordre: order,
      created_at: createdAt,
      updated_at: createdAt,
    });
  }

  return creneaux;
}

function sortRowsByDayAndTime(left: ScheduleRow, right: ScheduleRow) {
  if (left.jour_semaine !== right.jour_semaine) {
    return left.jour_semaine - right.jour_semaine;
  }

  const leftStart = toMinutes(left.heure_debut ?? left.creneau?.heure_debut) ?? Number.MAX_SAFE_INTEGER;
  const rightStart = toMinutes(right.heure_debut ?? right.creneau?.heure_debut) ?? Number.MAX_SAFE_INTEGER;

  if (leftStart !== rightStart) {
    return leftStart - rightStart;
  }

  const leftEnd = toMinutes(left.heure_fin ?? left.creneau?.heure_fin) ?? Number.MAX_SAFE_INTEGER;
  const rightEnd = toMinutes(right.heure_fin ?? right.creneau?.heure_fin) ?? Number.MAX_SAFE_INTEGER;

  if (leftEnd !== rightEnd) {
    return leftEnd - rightEnd;
  }

  return String(left.created_at).localeCompare(String(right.created_at));
}

function normalizeToWeekMonday(value?: Date | string | null): string {
  if (!value) return "";
  const date = startOfDay(value);
  if (Number.isNaN(date.getTime())) return "";

  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diffToMonday);

  return toDateInputValue(date);
}

function isSameDay(left?: Date | string | null, right?: Date | string | null) {
  if (!left || !right) return false;
  const leftDate = startOfDay(left);
  const rightDate = startOfDay(right);
  return leftDate.getTime() === rightDate.getTime();
}

function getRangeDurationInDays(row: Pick<ScheduleRow, "effectif_du" | "effectif_au">) {
  const start = startOfDay(row.effectif_du as Date);
  const end = endOfDay(row.effectif_au as Date);
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
}

function getCoveredVirtualCreneauIds(
  row: ScheduleRow,
  virtualCreneaux: CreneauHoraire[],
): string[] {
  const rowStart = toMinutes(row.heure_debut ?? row.creneau?.heure_debut);
  const rowEnd = toMinutes(row.heure_fin ?? row.creneau?.heure_fin);

  if (rowStart == null || rowEnd == null) {
    return virtualCreneaux.some((item) => item.id === row.creneau_horaire_id)
      ? [row.creneau_horaire_id]
      : [];
  }

  return virtualCreneaux
    .filter((creneau) => {
      const start = toMinutes(creneau.heure_debut);
      const end = toMinutes(creneau.heure_fin);

      if (start == null || end == null) return false;
      return start < rowEnd && end > rowStart;
    })
    .map((creneau) => creneau.id);
}

function getSpecificWeekWindow(specificWeekStart: string): PlanningWindow | null {
  if (!specificWeekStart) return null;

  const start = startOfDay(specificWeekStart);
  if (Number.isNaN(start.getTime())) return null;

  return {
    start,
    end: endOfDay(addDays(start, 6)),
  };
}

function getSchoolYearWindow(currentYear?: AnneeScolaire | null): PlanningWindow | null {
  if (!currentYear?.date_debut || !currentYear?.date_fin) return null;

  return {
    start: startOfDay(currentYear.date_debut),
    end: endOfDay(currentYear.date_fin),
  };
}

function clampWindowToSchoolYear(
  window: PlanningWindow | null,
  currentYear?: AnneeScolaire | null,
): PlanningWindow | null {
  const yearWindow = getSchoolYearWindow(currentYear);
  if (!window || !yearWindow) return null;

  if (window.end < yearWindow.start || window.start > yearWindow.end) {
    return null;
  }

  return {
    start: window.start > yearWindow.start ? window.start : yearWindow.start,
    end: window.end < yearWindow.end ? window.end : yearWindow.end,
  };
}

function getPlanningWindow(
  mode: PlanningMode,
  currentYear?: AnneeScolaire | null,
  specificWeekStart?: string,
): PlanningWindow | null {
  if (mode === "specific_week") {
    return clampWindowToSchoolYear(
      getSpecificWeekWindow(specificWeekStart ?? ""),
      currentYear,
    );
  }

  return getSchoolYearWindow(currentYear);
}

function getRequestErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response &&
    "data" in error.response
  ) {
    const responseData = error.response.data as {
      status?: { message?: string };
      message?: string;
    };

    return responseData?.status?.message ?? responseData?.message ?? fallback;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function overlapsWindow(row: ScheduleRow, window: PlanningWindow) {
  const start = startOfDay(row.effectif_du as Date);
  const end = endOfDay(row.effectif_au as Date);
  return start <= window.end && end >= window.start;
}

function matchesExactWindow(row: ScheduleRow, window: PlanningWindow) {
  return isSameDay(row.effectif_du, window.start) && isSameDay(row.effectif_au, window.end);
}

function mapRowsToPlanner(
  rows: ScheduleRow[],
  virtualCreneaux: CreneauHoraire[],
): Record<string, PlannerCellDraft> {
  const planner: Record<string, PlannerCellDraft> = {};

  [...rows]
    .sort(sortRowsByDayAndTime)
    .forEach((row) => {
      getCoveredVirtualCreneauIds(row, virtualCreneaux).forEach((creneauId) => {
        const key = getPlannerCellKey(row.jour_semaine, creneauId);

        if (!planner[key]) {
          planner[key] = {
            cours_id: row.cours_id ?? undefined,
            salle_id: row.salle_id ?? undefined,
            sourceId: row.id,
            isPause: !row.cours_id,
          };
        }
      });
    });

  return planner;
}

function filterPlanningEntries(
  rows: ScheduleRow[],
  currentYear: AnneeScolaire | null,
  mode: PlanningMode,
  specificWeekStart: string,
): ScheduleRow[] {
  if (!rows.length) return [];

  if (mode === "recurrent") {
    if (!currentYear?.date_debut || !currentYear?.date_fin) return [];

    return rows
      .filter(
        (row) =>
          isSameDay(row.effectif_du, currentYear.date_debut) &&
          isSameDay(row.effectif_au, currentYear.date_fin),
      )
      .sort(sortRowsByDayAndTime);
  }

  const selectedWindow = getSpecificWeekWindow(specificWeekStart);
  const effectiveWindow = getPlanningWindow("specific_week", currentYear, specificWeekStart);
  if (!selectedWindow || !effectiveWindow) return [];

  return rows
    .filter((row) => overlapsWindow(row, selectedWindow))
    .sort((left, right) => {
      if (left.jour_semaine !== right.jour_semaine) {
        return left.jour_semaine - right.jour_semaine;
      }

      const leftExact = matchesExactWindow(left, effectiveWindow) ? 1 : 0;
      const rightExact = matchesExactWindow(right, effectiveWindow) ? 1 : 0;
      if (leftExact !== rightExact) return rightExact - leftExact;

      const durationDelta = getRangeDurationInDays(left) - getRangeDurationInDays(right);
      if (durationDelta !== 0) return durationDelta;

      return sortRowsByDayAndTime(left, right);
    });
}

function getInheritedSpecificWeekEntries(
  rows: ScheduleRow[],
  currentYear: AnneeScolaire | null,
  specificWeekStart: string,
): ScheduleRow[] {
  const selectedWindow = getSpecificWeekWindow(specificWeekStart);
  const effectiveWindow = getPlanningWindow("specific_week", currentYear, specificWeekStart);
  if (!selectedWindow || !effectiveWindow || !rows.length) return [];

  return rows
    .filter(
      (row) =>
        overlapsWindow(row, selectedWindow) && !matchesExactWindow(row, effectiveWindow),
    )
    .sort((left, right) => {
      if (left.jour_semaine !== right.jour_semaine) {
        return left.jour_semaine - right.jour_semaine;
      }

      const durationDelta = getRangeDurationInDays(left) - getRangeDurationInDays(right);
      if (durationDelta !== 0) return durationDelta;

      return sortRowsByDayAndTime(left, right);
    });
}

function getEntriesToDelete(
  rows: ScheduleRow[],
  mode: PlanningMode,
  currentYear: AnneeScolaire | null,
  specificWeekStart: string,
): ScheduleRow[] {
  if (mode === "recurrent") {
    return filterPlanningEntries(rows, currentYear, "recurrent", specificWeekStart);
  }

  const window = getPlanningWindow("specific_week", currentYear, specificWeekStart);
  if (!window) return [];

  return rows.filter((row) => matchesExactWindow(row, window));
}

function isCellConfigured(cell?: PlannerCellDraft) {
  return Boolean(cell?.cours_id || cell?.isPause);
}

function getPlannerCellSignature(cell?: PlannerCellDraft) {
  if (!cell?.cours_id && !cell?.isPause) return "";
  if (cell?.isPause) return "pause";
  return `${cell.cours_id ?? ""}::${cell.salle_id ?? ""}`;
}

function getScheduleRowSignature(row: ScheduleRow) {
  return getPlannerCellSignature({
    cours_id: row.cours_id ?? undefined,
    salle_id: row.salle_id ?? undefined,
    isPause: !row.cours_id,
  });
}

function buildPlannerBlocks(
  planner: Record<string, PlannerCellDraft>,
  creneaux: CreneauHoraire[],
) {
  const blocks: Array<{
    day: number;
    cell: PlannerCellDraft;
    start: string;
    end: string;
    order: number;
  }> = [];

  for (let day = 1; day <= 7; day += 1) {
    let index = 0;

    while (index < creneaux.length) {
      const startCreneau = creneaux[index];
      const startKey = getPlannerCellKey(day, startCreneau.id);
      const cell = planner[startKey];
      const signature = getPlannerCellSignature(cell);

      if (!signature) {
        index += 1;
        continue;
      }

      let endIndex = index;

      while (endIndex + 1 < creneaux.length) {
        const nextCreneau = creneaux[endIndex + 1];
        const nextKey = getPlannerCellKey(day, nextCreneau.id);

        if (getPlannerCellSignature(planner[nextKey]) !== signature) {
          break;
        }

        endIndex += 1;
      }

      blocks.push({
        day,
        cell: cell as PlannerCellDraft,
        start: startCreneau.heure_debut,
        end: creneaux[endIndex]?.heure_fin ?? startCreneau.heure_fin,
        order: startCreneau.ordre ?? index + 1,
      });

      index = endIndex + 1;
    }
  }

  return blocks;
}

async function ensurePersistedCreneaux(
  etablissementId: string,
  persistedCreneaux: CreneauHoraire[],
  intervals: Array<{
    start: string;
    end: string;
    order: number;
  }>,
) {
  const creneauService = new CreneauHoraireService();
  const nextCreneaux = [...persistedCreneaux];
  const idMap: Record<string, string> = {};
  const existingByWindow = new Map(
    nextCreneaux.map((creneau) => [`${creneau.heure_debut}-${creneau.heure_fin}`, creneau]),
  );

  for (const interval of Array.from(
    new Map(intervals.map((item) => [`${item.start}-${item.end}`, item])).values(),
  )) {
    const windowKey = `${interval.start}-${interval.end}`;
    const existing = existingByWindow.get(windowKey);

    if (existing) {
      idMap[windowKey] = existing.id;
      continue;
    }

    const result = await creneauService.create({
      etablissement_id: etablissementId,
      nom: `${interval.start} - ${interval.end}`,
      heure_debut: interval.start,
      heure_fin: interval.end,
      ordre: interval.order,
    });

    if (!result?.status?.success || !result.data) {
      return {
        success: false,
        message: "Impossible d'enregistrer les creneaux utilises dans la base.",
        persistedCreneaux: nextCreneaux,
        idMap,
      };
    }

    const persistedCreneau = result.data as CreneauHoraire;
    idMap[windowKey] = persistedCreneau.id;
    existingByWindow.set(windowKey, persistedCreneau);
    nextCreneaux.push(persistedCreneau);
  }

  return {
    success: true,
    message: "",
    persistedCreneaux: nextCreneaux,
    idMap,
  };
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
  persistedCreneaux: [],
  salles: [],
  allEntries: [],
  relatedEntries: [],
  existingEntries: [],
  planner: {},
  selectedClasseId: "",
  planningMode: "recurrent",
  specificWeekStart: "",

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
          allEntries: [],
          relatedEntries: [],
          existingEntries: [],
          planner: {},
          creneaux: [],
          persistedCreneaux: [],
          salles: [],
          selectedClasseId: "",
          error:
            "Aucune annee scolaire active n'a ete trouvee pour cet etablissement.",
        });
        return;
      }

      const [classesResult, creneauxResult, sallesResult] = await Promise.all([
        classeService.getAll({
          take: 5000,
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
          take: 5000,
          where: JSON.stringify({ etablissement_id: etablissementId }),
          orderBy: JSON.stringify([{ ordre: "asc" }, { heure_debut: "asc" }]),
        }),
        salleService.getAll({
          take: 5000,
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
      const persistedCreneaux = creneauxResult?.status.success
        ? creneauxResult.data.data
        : [];
      const creneaux = buildDefaultCreneaux(etablissementId);
      const salles = sallesResult?.status.success ? sallesResult.data.data : [];

      const selectedClasseId =
        classes.find((item: Classe) => item.id === get().selectedClasseId)?.id ??
        classes[0]?.id ??
        "";

      set({
        currentYear,
        classes,
        creneaux,
        persistedCreneaux,
        salles,
        selectedClasseId,
        specificWeekStart:
          normalizeToWeekMonday(get().specificWeekStart || currentYear.date_debut),
        error: classes.length
          ? null
          : "Aucune classe n'est disponible sur l'annee scolaire en cours.",
      });

      if (selectedClasseId) {
        await get().selectClasse(selectedClasseId);
      } else {
        set({
          courses: [],
          allEntries: [],
          relatedEntries: [],
          existingEntries: [],
          planner: {},
        });
      }
    } catch {
      set({
        error:
          "Impossible de charger le tableau de bord de l'emploi du temps pour le moment.",
      });
    } finally {
      set({ loading: false });
    }
  },

  selectClasse: async (classeId: string) => {
    const { currentYear, etablissementId, planningMode, specificWeekStart } = get();

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
        allEntries: [],
        relatedEntries: [],
        existingEntries: [],
        planner: {},
        loadingPlanning: false,
      });
      return;
    }

    try {
      const coursService = new CoursService();
      const emploiDuTempsService = new EmploiDuTempsService();

      const [coursesResult, planningResult, relatedEntriesResult] = await Promise.all([
        coursService.getAll({
          take: 5000,
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
        emploiDuTempsService.getAll({
          take: 5000,
          where: JSON.stringify({
            classe: {
              etablissement_id: etablissementId,
            },
          }),
          includeSpec: JSON.stringify({
            classe: true,
            cours: {
              include: {
                classe: true,
                matiere: true,
              },
            },
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
            salle: {
              include: {
                site: true,
              },
            },
            creneau: true,
          }),
        }),
      ]);

      const courses = coursesResult?.status.success
        ? [...coursesResult.data.data].sort((a: CourseRecord, b: CourseRecord) =>
            `${a.matiere?.nom ?? ""} ${getTeacherDisplayLabel(a.enseignant)}`.localeCompare(
              `${b.matiere?.nom ?? ""} ${getTeacherDisplayLabel(b.enseignant)}`,
            ),
          )
        : [];
      const allEntries = planningResult?.status.success ? planningResult.data.data : [];
      const relatedEntries = relatedEntriesResult?.status.success
        ? relatedEntriesResult.data.data
        : [];
      const existingEntries = filterPlanningEntries(
        allEntries,
        currentYear,
        planningMode,
        specificWeekStart,
      );
      const virtualCreneaux = get().creneaux;

      set({
        courses,
        allEntries,
        relatedEntries,
        existingEntries,
        planner: mapRowsToPlanner(existingEntries, virtualCreneaux),
        error: null,
      });
    } catch {
      set({
        courses: [],
        allEntries: [],
        relatedEntries: [],
        existingEntries: [],
        planner: {},
        error:
          "Impossible de charger le planning global de cette classe pour le moment.",
      });
    } finally {
      set({ loadingPlanning: false });
    }
  },

  setPlanningMode: async (mode: PlanningMode) => {
    const { selectedClasseId } = get();
    set({ planningMode: mode });

    if (selectedClasseId) {
      await get().selectClasse(selectedClasseId);
    }
  },

  setSpecificWeekStart: async (value: string) => {
    set({ specificWeekStart: normalizeToWeekMonday(value) });

    if (get().planningMode === "specific_week" && get().selectedClasseId) {
      await get().selectClasse(get().selectedClasseId);
    }
  },

  updatePlannerCell: (day: number, creneauId: string, patch: Partial<PlannerCellDraft>) =>
    set((state) => {
      const key = getPlannerCellKey(day, creneauId);
      const normalizedPatch = { ...patch };

      if (typeof normalizedPatch.cours_id === "string") {
        if (isPauseCourseValue(normalizedPatch.cours_id)) {
          normalizedPatch.cours_id = undefined;
          normalizedPatch.salle_id = undefined;
          normalizedPatch.isPause = true;
        } else {
          normalizedPatch.isPause = false;
        }
      } else if (Object.prototype.hasOwnProperty.call(normalizedPatch, "cours_id")) {
        normalizedPatch.isPause = false;
      }

      const nextValue = {
        ...state.planner[key],
        ...normalizedPatch,
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
      planner: mapRowsToPlanner(state.existingEntries, state.creneaux),
    })),

  savePlanning: async () => {
    const {
      currentYear,
      etablissementId,
      selectedClasseId,
      planner,
      courses,
      planningMode,
      specificWeekStart,
      allEntries,
      creneaux,
      persistedCreneaux,
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

    const window = getPlanningWindow(planningMode, currentYear, specificWeekStart);
    if (!window) {
      return {
        success: false,
        message:
          planningMode === "specific_week"
            ? specificWeekStart
              ? "La semaine choisie ne contient aucun jour dans l'annee scolaire active."
              : "Selectionne la date de debut de la semaine a planifier."
            : "Impossible de determiner l'intervalle actif du planning.",
        count: 0,
      };
    }

    const emploiDuTempsService = new EmploiDuTempsService();
    const usedPlannerEntries = Object.entries(planner).filter(
      ([, cell]) => cell?.cours_id || cell?.isPause,
    );

    if (!etablissementId) {
      return {
        success: false,
        message: "Aucun etablissement actif n'est disponible pour enregistrer les creneaux.",
        count: 0,
      };
    }

    set({ saving: true });

    try {
      const inheritedSpecificWeekPlanner =
        planningMode === "specific_week"
          ? mapRowsToPlanner(
              getInheritedSpecificWeekEntries(allEntries, currentYear, specificWeekStart),
              creneaux,
            )
          : {};

      const plannerToPersist = usedPlannerEntries.reduce<Record<string, PlannerCellDraft>>(
        (acc, [key, cell]) => {
          if (!cell?.cours_id && !cell?.isPause) return acc;

          if (planningMode === "specific_week") {
            const inheritedCell = inheritedSpecificWeekPlanner[key];
            const nextSignature = getPlannerCellSignature(cell);
            const inheritedSignature = getPlannerCellSignature(inheritedCell);

            if (nextSignature === inheritedSignature) {
              return acc;
            }
          }

          acc[key] = cell;
          return acc;
        },
        {},
      );

      const plannerBlocks = buildPlannerBlocks(plannerToPersist, creneaux);

      const persistedCreneauxResult = await ensurePersistedCreneaux(
        etablissementId,
        persistedCreneaux,
        plannerBlocks.map((block) => ({
          start: block.start,
          end: block.end,
          order: block.order,
        })),
      );

      if (!persistedCreneauxResult.success) {
        return {
          success: false,
          message: persistedCreneauxResult.message,
          count: 0,
        };
      }

      const entries = plannerBlocks.map((block) => {
        const course = block.cell?.cours_id
          ? courses.find((item) => item.id === block.cell.cours_id)
          : undefined;
        const intervalKey = `${block.start}-${block.end}`;

        return {
          classe_id: selectedClasseId,
          cours_id: block.cell.isPause ? null : block.cell.cours_id ?? null,
          matiere_id: course?.matiere_id ?? null,
          enseignant_id: course?.enseignant_id ?? null,
          salle_id: block.cell.isPause ? null : block.cell.salle_id ?? null,
          jour_semaine: block.day,
          heure_debut: block.start,
          heure_fin: block.end,
          creneau_horaire_id: persistedCreneauxResult.idMap[intervalKey],
          effectif_du: window.start,
          effectif_au: window.end,
        } satisfies Omit<EmploiDuTemps, "id" | "created_at" | "updated_at">;
      });

      const entriesToDelete = getEntriesToDelete(
        allEntries,
        planningMode,
        currentYear,
        specificWeekStart,
      );

      const result = await emploiDuTempsService.replaceClassePlanning(
        selectedClasseId,
        entries,
        { existingEntries: entriesToDelete },
      );

      if (!result?.status.success) {
        return {
          success: false,
          message:
            planningMode === "specific_week"
              ? "Le planning de la semaine precise n'a pas pu etre enregistre."
              : "Le planning global n'a pas pu etre enregistre.",
          count: 0,
        };
      }

      const refreshed = await emploiDuTempsService.getClassePlanning(selectedClasseId);
      let refreshedEntries = refreshed?.status.success ? refreshed.data.data : [];

      if (planningMode === "recurrent") {
        const recurrentEntries = filterPlanningEntries(
          refreshedEntries,
          currentYear,
          "recurrent",
          specificWeekStart,
        );
        const recurrentPlanner = mapRowsToPlanner(recurrentEntries, creneaux);
        const redundantSpecificEntries = refreshedEntries.filter((row: any) => {
          if (
            matchesExactWindow(row, {
              start: startOfDay(currentYear.date_debut),
              end: endOfDay(currentYear.date_fin),
            })
          ) {
            return false;
          }

          const coveredKeys = getCoveredVirtualCreneauIds(row, creneaux);

          if (coveredKeys.length === 0) return false;

          return coveredKeys.every((creneauId) => {
            const annualSignature =
              recurrentPlanner[getPlannerCellKey(row.jour_semaine, creneauId)];

            if (!annualSignature) return false;

            return getPlannerCellSignature(annualSignature) === getScheduleRowSignature(row);
          });
        });

        if (redundantSpecificEntries.length > 0) {
          await Promise.all(
            redundantSpecificEntries.map((row: any) => emploiDuTempsService.delete(row.id)),
          );

          const cleaned = await emploiDuTempsService.getClassePlanning(selectedClasseId);
          refreshedEntries = cleaned?.status.success ? cleaned.data.data : refreshedEntries;
        }
      }

      const refreshedRelatedEntries = await emploiDuTempsService.getAll({
        take: 5000,
        where: JSON.stringify({
          classe: {
            etablissement_id: etablissementId,
          },
        }),
        includeSpec: JSON.stringify({
          classe: true,
          cours: {
            include: {
              classe: true,
              matiere: true,
            },
          },
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
          salle: {
            include: {
              site: true,
            },
          },
          creneau: true,
        }),
      });
      const nextRelatedEntries = refreshedRelatedEntries?.status.success
        ? refreshedRelatedEntries.data.data
        : [];
      const filteredEntries = filterPlanningEntries(
        refreshedEntries,
        currentYear,
        planningMode,
        specificWeekStart,
      );

      set({
        persistedCreneaux: persistedCreneauxResult.persistedCreneaux,
        allEntries: refreshedEntries,
        relatedEntries: nextRelatedEntries,
        existingEntries: filteredEntries,
        planner: mapRowsToPlanner(filteredEntries, creneaux),
      });

      const createdCount = entries.length;
      const updatedCount = entriesToDelete.length;

      return {
        success: true,
        message:
          planningMode === "specific_week"
            ? updatedCount > 0
              ? `La semaine precise a ete remplacee avec ${createdCount} creneau(x).`
              : `La semaine precise a ete creee avec ${createdCount} creneau(x).`
            : updatedCount > 0
              ? `Le planning global a ete remplace avec ${createdCount} creneau(x) recurrent(s).`
              : `Le planning annuel a ete cree avec ${createdCount} creneau(x) recurrent(s).`,
        count: createdCount,
      };
    } catch (error) {
      return {
        success: false,
        message: getRequestErrorMessage(
          error,
          planningMode === "specific_week"
            ? "Une erreur est survenue pendant l'enregistrement de la semaine precise."
            : "Une erreur est survenue pendant l'enregistrement global de l'emploi du temps.",
        ),
        count: 0,
      };
    } finally {
      set({ saving: false });
    }
  },
}));
