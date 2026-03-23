import {
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import {
  FiBookOpen,
  FiCheck,
  FiCheckCircle,
  FiClock,
  FiDownload,
  FiInfo,
  FiMapPin,
  FiLayers,
  FiRefreshCw,
  FiRotateCcw,
  FiSave,
  FiTrash2,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { useAuth } from "../../../../auth/AuthContext";
import Spin from "../../../../components/anim/Spin";
import { useInfo } from "../../../../hooks/useInfo";
import {
  useEmploiDuTempsDashboardStore,
  type PlanningMode,
} from "../../store/EmploiDuTempsDashboardStore";
import {
  PAUSE_COURSE_ID,
  WEEKDAY_OPTIONS,
  getPlannerCellKey,
  getTeacherDisplayLabel,
  getTeacherSecondaryLabel,
} from "../../types";
import { downloadSchedulePdf } from "../../utils/schedulePdf";

function parseDateValue(value?: Date | string | null) {
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

function formatShortDate(value?: Date | string | null) {
  if (!value) return "-";
  const date = parseDateValue(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function toDateInputValue(value?: Date | string | null) {
  if (!value) return "";
  const date = parseDateValue(value);
  if (!date) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(value: Date | string, days: number) {
  const date = parseDateValue(value) ?? new Date(Number.NaN);
  if (Number.isNaN(date.getTime())) return date;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

function toDayStart(value?: Date | string | null) {
  if (!value) return null;
  const date = parseDateValue(value);
  if (!date) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function toDayEnd(value?: Date | string | null) {
  if (!value) return null;
  const date = parseDateValue(value);
  if (!date) return null;
  date.setHours(23, 59, 59, 999);
  return date;
}

function normalizeToWeekMonday(value?: string | null) {
  if (!value) return "";
  const date = parseDateValue(value);
  if (!date) return "";
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diffToMonday);
  return toDateInputValue(date);
}

function getCourseLabel(course: {
  matiere?: { nom?: string | null } | null;
  enseignant?: {
    personnel?: {
      code_personnel?: string | null;
      poste?: string | null;
      utilisateur?: {
        profil?: {
          prenom?: string | null;
          nom?: string | null;
        } | null;
      } | null;
    } | null;
  } | null;
}) {
  const matiere = course.matiere?.nom ?? "Matiere";
  return `${matiere} - ${getTeacherDisplayLabel(course.enseignant)}`;
}

function getRoomLabel(room: { nom: string; site?: { nom?: string | null } | null }) {
  return room.site?.nom ? `${room.nom} - ${room.site.nom}` : room.nom;
}

function getUniformValue<T>(values: T[]): T | null {
  if (values.length === 0) return null;
  return values.every((value) => value === values[0]) ? values[0] : null;
}

function getPlannerMergeSignature(cell?: {
  cours_id?: string;
  salle_id?: string;
  isPause?: boolean;
} | null) {
  if (!cell?.cours_id && !cell?.isPause) return null;
  if (cell?.isPause) return "pause";
  return `course:${cell?.cours_id ?? ""}:${cell?.salle_id ?? ""}`;
}

function toMinutes(value?: string | null) {
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  return Number.parseInt(match[1], 10) * 60 + Number.parseInt(match[2], 10);
}

function getCreneauDurationMinutes(creneau?: {
  heure_debut?: string | null;
  heure_fin?: string | null;
} | null) {
  const start = toMinutes(creneau?.heure_debut);
  const end = toMinutes(creneau?.heure_fin);

  if (start == null || end == null || end <= start) {
    return 0;
  }

  return end - start;
}

function formatHoursFromMinutes(totalMinutes: number) {
  const safeMinutes = Math.max(0, totalMinutes);

  if (safeMinutes === 0) {
    return "0 h";
  }

  const hours = safeMinutes / 60;

  if (Number.isInteger(hours)) {
    return `${hours} h`;
  }

  return `${hours.toFixed(1).replace(".", ",")} h`;
}

function timeRangesOverlap(
  leftStart?: string | null,
  leftEnd?: string | null,
  rightStart?: number | null,
  rightEnd?: number | null,
) {
  const leftStartMinutes = toMinutes(leftStart);
  const leftEndMinutes = toMinutes(leftEnd);

  if (
    leftStartMinutes == null ||
    leftEndMinutes == null ||
    rightStart == null ||
    rightEnd == null
  ) {
    return false;
  }

  return leftStartMinutes < rightEnd && rightStart < leftEndMinutes;
}

type PlanningDraftEntry = {
  key: string;
  classeId: string;
  classeLabel: string;
  coursId?: string;
  enseignantId?: string;
  enseignantLabel?: string;
  salleId?: string;
  salleLabel?: string;
  jour: number;
  dayLabel: string;
  creneauId: string;
  creneauLabel: string;
  startMinutes: number;
  endMinutes: number;
  start: Date;
  end: Date;
};

type PlanningConflict = {
  type: "enseignant" | "salle" | "classe";
  key: string;
  title: string;
  message: string;
};

function isSameWindow(
  leftStart?: Date | string | null,
  leftEnd?: Date | string | null,
  rightStart?: Date | string | null,
  rightEnd?: Date | string | null,
) {
  const lStart = toDayStart(leftStart)?.getTime();
  const lEnd = toDayEnd(leftEnd)?.getTime();
  const rStart = toDayStart(rightStart)?.getTime();
  const rEnd = toDayEnd(rightEnd)?.getTime();
  if (
    lStart == null ||
    lEnd == null ||
    rStart == null ||
    rEnd == null
  ) {
    return false;
  }
  return lStart === rStart && lEnd === rEnd;
}

function datesOverlap(
  leftStart?: Date | string | null,
  leftEnd?: Date | string | null,
  rightStart?: Date | string | null,
  rightEnd?: Date | string | null,
) {
  const lStart = toDayStart(leftStart)?.getTime();
  const lEnd = toDayEnd(leftEnd)?.getTime();
  const rStart = toDayStart(rightStart)?.getTime();
  const rEnd = toDayEnd(rightEnd)?.getTime();

  if (
    lStart == null ||
    lEnd == null ||
    rStart == null ||
    rEnd == null ||
    Number.isNaN(lStart) ||
    Number.isNaN(lEnd) ||
    Number.isNaN(rStart) ||
    Number.isNaN(rEnd)
  ) {
    return false;
  }
  return lStart <= rEnd && rStart <= lEnd;
}

function isExactPlanningWindow(
  leftStart?: Date | string | null,
  leftEnd?: Date | string | null,
  rightStart?: Date | string | null,
  rightEnd?: Date | string | null,
) {
  return isSameWindow(leftStart, leftEnd, rightStart, rightEnd);
}

function StatCard({
  icon,
  label,
  value,
  accent,
  helper,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  accent: string;
  helper: string;
}) {
  return (
    <div className="rounded-[28px] border border-slate-200/80 bg-white/95 p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.4)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {value}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">{helper}</p>
        </div>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-2xl text-lg shadow-inner ${accent}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)]">
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white/80 px-6 py-12 text-center shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </div>
  );
}

export default function ScheduleDashboard() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const [selectionAnchor, setSelectionAnchor] = useState<{
    day: number;
    creneauId: string;
  } | null>(null);
  const [selectedCellKeys, setSelectedCellKeys] = useState<string[]>([]);
  const [bulkEditorOpen, setBulkEditorOpen] = useState(false);
  const [bulkCourseId, setBulkCourseId] = useState("");
  const [bulkSalleId, setBulkSalleId] = useState("");
  const [manualLockedPlanningMode, setManualLockedPlanningMode] =
    useState<PlanningMode | null>(null);
  const [isGridHovered, setIsGridHovered] = useState(false);
  const [isShortcutHovered, setIsShortcutHovered] = useState(false);

  const loading = useEmploiDuTempsDashboardStore((state) => state.loading);
  const loadingPlanning = useEmploiDuTempsDashboardStore(
    (state) => state.loadingPlanning,
  );
  const saving = useEmploiDuTempsDashboardStore((state) => state.saving);
  const error = useEmploiDuTempsDashboardStore((state) => state.error);
  const currentYear = useEmploiDuTempsDashboardStore((state) => state.currentYear);
  const classes = useEmploiDuTempsDashboardStore((state) => state.classes);
  const courses = useEmploiDuTempsDashboardStore((state) => state.courses);
  const creneaux = useEmploiDuTempsDashboardStore((state) => state.creneaux);
  const salles = useEmploiDuTempsDashboardStore((state) => state.salles);
  const allEntries = useEmploiDuTempsDashboardStore((state) => state.allEntries);
  const relatedEntries = useEmploiDuTempsDashboardStore((state) => state.relatedEntries);
  const planner = useEmploiDuTempsDashboardStore((state) => state.planner);
  const selectedClasseId = useEmploiDuTempsDashboardStore(
    (state) => state.selectedClasseId,
  );
  const planningMode = useEmploiDuTempsDashboardStore(
    (state) => state.planningMode,
  );
  const specificWeekStart = useEmploiDuTempsDashboardStore(
    (state) => state.specificWeekStart,
  );
  const initialize = useEmploiDuTempsDashboardStore((state) => state.initialize);
  const selectClasse = useEmploiDuTempsDashboardStore((state) => state.selectClasse);
  const setPlanningMode = useEmploiDuTempsDashboardStore(
    (state) => state.setPlanningMode,
  );
  const setSpecificWeekStart = useEmploiDuTempsDashboardStore(
    (state) => state.setSpecificWeekStart,
  );
  const updatePlannerCell = useEmploiDuTempsDashboardStore(
    (state) => state.updatePlannerCell,
  );
  const clearPlanner = useEmploiDuTempsDashboardStore((state) => state.clearPlanner);
  const resetFromExisting = useEmploiDuTempsDashboardStore(
    (state) => state.resetFromExisting,
  );
  const savePlanning = useEmploiDuTempsDashboardStore((state) => state.savePlanning);

  useEffect(() => {
    if (etablissement_id) {
      initialize(etablissement_id);
    }
  }, [etablissement_id, initialize]);

  const selectedClasse = useMemo(
    () => classes.find((item) => item.id === selectedClasseId) ?? null,
    [classes, selectedClasseId],
  );

  const creneauDurationById = useMemo(
    () =>
      Object.fromEntries(
        creneaux.map((creneau) => [creneau.id, getCreneauDurationMinutes(creneau)]),
      ) as Record<string, number>,
    [creneaux],
  );

  const plannedMinutes = useMemo(
    () =>
      Object.entries(planner).reduce((total, [key, cell]) => {
        if (!cell?.cours_id && !cell?.isPause) return total;
        const [, creneauId] = key.split("::");
        return total + (creneauDurationById[creneauId] ?? 0);
      }, 0),
    [creneauDurationById, planner],
  );

  const assignedRooms = useMemo(() => {
    return new Set(
      Object.values(planner)
        .map((cell) => cell?.salle_id)
        .filter(Boolean),
    ).size;
  }, [planner]);

  const unplannedCourses = useMemo(() => {
    const usedCourses = new Set(
      Object.values(planner)
        .map((cell) => cell?.cours_id)
        .filter(Boolean),
    );

    return courses.filter((course) => !usedCourses.has(course.id)).length;
  }, [courses, planner]);

  const visibleDays = useMemo(
    () => WEEKDAY_OPTIONS,
    [],
  );

  const specificWeekStartDate = useMemo(() => {
    if (!specificWeekStart) return null;
    return parseDateValue(specificWeekStart);
  }, [specificWeekStart]);

  const specificWeekEndDate = useMemo(() => {
    if (!specificWeekStartDate) return null;
    return addDays(specificWeekStartDate, visibleDays.length - 1);
  }, [specificWeekStartDate, visibleDays.length]);

  const currentYearWindow = useMemo(() => {
    if (!currentYear?.date_debut || !currentYear?.date_fin) return null;
    const start = toDayStart(currentYear.date_debut);
    const end = toDayEnd(currentYear.date_fin);
    if (!start || !end) return null;
    return { start, end };
  }, [currentYear?.date_debut, currentYear?.date_fin]);

  const displayDays = useMemo(() => {
    if (planningMode !== "specific_week" || !specificWeekStartDate) {
      return visibleDays.map((day) => ({
        ...day,
        label: day.label,
        helper: null as string | null,
        isOutsideYear: false,
      }));
    }

    return visibleDays.map((day, index) => {
      const date = addDays(specificWeekStartDate, index);
      return {
        ...day,
        label: day.label,
        helper: formatShortDate(date),
        isOutsideYear: Boolean(
          currentYearWindow &&
            (date < currentYearWindow.start || date > currentYearWindow.end),
        ),
      };
    });
  }, [currentYearWindow, planningMode, specificWeekStartDate, visibleDays]);

  const activeWindow = useMemo(() => {
    if (planningMode === "specific_week") {
      if (!specificWeekStartDate || !specificWeekEndDate) return null;
      return {
        start: specificWeekStartDate,
        end: specificWeekEndDate,
      };
    }

    if (!currentYear?.date_debut || !currentYear?.date_fin) return null;
    const yearStart = parseDateValue(currentYear.date_debut);
    const yearEnd = parseDateValue(currentYear.date_fin);
    if (!yearStart || !yearEnd) return null;
    return {
      start: yearStart,
      end: yearEnd,
    };
  }, [currentYear?.date_debut, currentYear?.date_fin, planningMode, specificWeekEndDate, specificWeekStartDate]);

  const lockedPlanningMode = useMemo<PlanningMode | null>(() => {
    if (!currentYear?.date_debut || !currentYear?.date_fin) return null;

    const yearEntries = allEntries
      .filter((entry) =>
        datesOverlap(
          entry.effectif_du,
          entry.effectif_au,
          currentYear.date_debut,
          currentYear.date_fin,
        ),
      )
      .sort(
        (left, right) =>
          new Date(left.created_at).getTime() - new Date(right.created_at).getTime(),
      );

    if (!yearEntries.length) return null;

    const firstEntry = yearEntries[0];
    return isExactPlanningWindow(
      firstEntry.effectif_du,
      firstEntry.effectif_au,
      currentYear.date_debut,
      currentYear.date_fin,
    )
      ? "recurrent"
      : "specific_week";
  }, [allEntries, currentYear?.date_debut, currentYear?.date_fin]);

  useEffect(() => {
    setManualLockedPlanningMode(null);
  }, [selectedClasseId, lockedPlanningMode]);

  const effectiveLockedPlanningMode = lockedPlanningMode ?? manualLockedPlanningMode;
  const isPlanningModeLocked = Boolean(effectiveLockedPlanningMode);
  const lockedModeLabel =
    effectiveLockedPlanningMode === "specific_week"
      ? "Semaine"
      : effectiveLockedPlanningMode === "recurrent"
        ? "Annuel"
        : null;

  useEffect(() => {
    if (lockedPlanningMode && planningMode !== lockedPlanningMode) {
      void setPlanningMode(lockedPlanningMode);
    }
  }, [lockedPlanningMode, planningMode, setPlanningMode]);

  const specificWeekBounds = useMemo(() => {
    if (!currentYear?.date_debut || !currentYear?.date_fin) {
      return { min: "", max: "" };
    }

    return {
      min: normalizeToWeekMonday(toDateInputValue(currentYear.date_debut)),
      max: normalizeToWeekMonday(toDateInputValue(currentYear.date_fin)),
    };
  }, [currentYear?.date_debut, currentYear?.date_fin]);

  const totalMinutes = useMemo(
    () =>
      visibleDays.reduce(
        (dayTotal) =>
          dayTotal +
          creneaux.reduce((slotTotal, creneau) => slotTotal + getCreneauDurationMinutes(creneau), 0),
        0,
      ),
    [creneaux, visibleDays],
  );
  const isGridRendered =
    Boolean(selectedClasseId) && (loadingPlanning || creneaux.length > 0);
  const isShortcutVisible = isGridRendered && (isGridHovered || isShortcutHovered);

  const courseUsageMinutesById = useMemo(() => {
    return Object.entries(planner).reduce<Record<string, number>>((acc, [key, cell]) => {
      if (!cell?.cours_id) return acc;
      const [, creneauId] = key.split("::");
      acc[cell.cours_id] = (acc[cell.cours_id] ?? 0) + (creneauDurationById[creneauId] ?? 0);
      return acc;
    }, {});
  }, [creneauDurationById, planner]);

  const selectedCourseByCell = useMemo(() => {
    return Object.fromEntries(
      Object.entries(planner).map(([key, cell]) => [
        key,
        courses.find((course) => course.id === cell?.cours_id) ?? null,
      ]),
    );
  }, [courses, planner]);

  const roomById = useMemo(
    () => Object.fromEntries(salles.map((room) => [room.id, room])),
    [salles],
  );

  const courseById = useMemo(
    () => Object.fromEntries(courses.map((course) => [course.id, course])),
    [courses],
  );

  const creneauById = useMemo(
    () => Object.fromEntries(creneaux.map((creneau) => [creneau.id, creneau])),
    [creneaux],
  );

  const dayIndexByValue = useMemo(
    () =>
      Object.fromEntries(displayDays.map((day, index) => [day.value, index])) as Record<
        number,
        number
      >,
    [displayDays],
  );

  const creneauIndexById = useMemo(
    () =>
      Object.fromEntries(creneaux.map((creneau, index) => [creneau.id, index])) as Record<
        string,
        number
      >,
    [creneaux],
  );

  const plannedMinutesByDay = useMemo(() => {
    return visibleDays.reduce<Record<number, number>>((acc, day) => {
      acc[day.value] = creneaux.reduce((count, creneau) => {
        const key = getPlannerCellKey(day.value, creneau.id);
        return count + (planner[key]?.cours_id || planner[key]?.isPause ? getCreneauDurationMinutes(creneau) : 0);
      }, 0);
      return acc;
    }, {});
  }, [creneaux, planner, visibleDays]);

  const isCompactGrid = planningMode === "recurrent";

  const entriesToReplaceIds = useMemo(() => {
    if (!activeWindow) return new Set<string>();

    return new Set(
      allEntries
        .filter((entry) => {
          if (planningMode === "recurrent") {
            return isSameWindow(
              entry.effectif_du,
              entry.effectif_au,
              currentYear?.date_debut,
              currentYear?.date_fin,
            );
          }

          return isSameWindow(
            entry.effectif_du,
            entry.effectif_au,
            activeWindow.start,
            activeWindow.end,
          );
        })
        .map((entry) => entry.id),
    );
  }, [activeWindow, allEntries, currentYear?.date_debut, currentYear?.date_fin, planningMode]);

  const buildDraftEntries = (plannerSource: Record<string, (typeof planner)[string]>) => {
    if (!activeWindow || !selectedClasse) return [] as PlanningDraftEntry[];

    return Object.entries(plannerSource).flatMap(([key, cell]) => {
      if (!cell?.cours_id && !cell?.isPause) return [];

      const [dayPart, creneauId] = key.split("::");
      const day = Number.parseInt(dayPart, 10);
      const course = cell?.cours_id ? courseById[cell.cours_id] : null;
      const creneau = creneauById[creneauId];
      const room = cell?.salle_id ? roomById[cell.salle_id] : undefined;
      const dayInfo = displayDays.find((item) => item.value === day);
      const startMinutes = toMinutes(creneau?.heure_debut);
      const endMinutes = toMinutes(creneau?.heure_fin);

      if (
        !creneau ||
        !dayInfo ||
        dayInfo.isOutsideYear ||
        startMinutes == null ||
        endMinutes == null
      ) {
        return [];
      }

      return [
        {
          key,
          classeId: selectedClasse.id,
          classeLabel: selectedClasse.nom,
          coursId: cell.isPause ? undefined : cell.cours_id ?? undefined,
          enseignantId: cell.isPause ? undefined : course?.enseignant_id ?? undefined,
          enseignantLabel: cell.isPause
            ? undefined
            : getTeacherDisplayLabel(course?.enseignant),
          salleId: cell.isPause ? undefined : cell.salle_id ?? undefined,
          salleLabel: cell.isPause ? undefined : room?.nom ?? undefined,
          jour: day,
          dayLabel: dayInfo.label,
          creneauId,
          creneauLabel: `${creneau.heure_debut} - ${creneau.heure_fin}`,
          startMinutes,
          endMinutes,
          start: activeWindow.start,
          end: activeWindow.end,
        } satisfies PlanningDraftEntry,
      ];
    });
  };

  const computeConflicts = (draftEntries: PlanningDraftEntry[]) => {
    const conflicts: PlanningConflict[] = [];

    draftEntries.forEach((draft) => {
      const overlappingEntries = relatedEntries.filter((entry) => {
        if (entriesToReplaceIds.has(entry.id)) return false;
        if (entry.jour_semaine !== draft.jour) return false;
        if (
          !timeRangesOverlap(
            entry.heure_debut ?? entry.creneau?.heure_debut,
            entry.heure_fin ?? entry.creneau?.heure_fin,
            draft.startMinutes,
            draft.endMinutes,
          )
        ) {
          return false;
        }
        return datesOverlap(entry.effectif_du, entry.effectif_au, draft.start, draft.end);
      });

      overlappingEntries.forEach((entry) => {
        const sameWindow = isSameWindow(
          entry.effectif_du,
          entry.effectif_au,
          draft.start,
          draft.end,
        );

        if (
          draft.enseignantId &&
          entry.enseignant_id &&
          draft.enseignantId === entry.enseignant_id &&
          entry.classe_id !== draft.classeId
        ) {
          conflicts.push({
            type: "enseignant",
            key: `${draft.key}:teacher:${entry.id}`,
            title: "Conflit enseignant",
            message: `${draft.enseignantLabel ?? "Enseignant"} est deja affecte(e) a ${entry.classe?.nom ?? "une autre classe"} le ${draft.dayLabel} sur ${draft.creneauLabel}.`,
          });
        }

        if (
          draft.salleId &&
          entry.salle_id &&
          draft.salleId === entry.salle_id &&
          entry.classe_id !== draft.classeId
        ) {
          conflicts.push({
            type: "salle",
            key: `${draft.key}:room:${entry.id}`,
            title: "Conflit salle",
            message: `${draft.salleLabel ?? "La salle"} est deja utilisee par ${entry.classe?.nom ?? "une autre classe"} le ${draft.dayLabel} sur ${draft.creneauLabel}.`,
          });
        }

        if (
          entry.classe_id === draft.classeId &&
          sameWindow &&
          !entriesToReplaceIds.has(entry.id)
        ) {
          conflicts.push({
            type: "classe",
            key: `${draft.key}:class:${entry.id}`,
            title: "Conflit classe",
            message: `${draft.classeLabel} possede deja une ligne sur ${draft.dayLabel} pendant ${draft.creneauLabel} pour cette meme periode.`,
          });
        }
      });
    });

    return Array.from(new Map(conflicts.map((conflict) => [conflict.key, conflict])).values());
  };

  const planningDraftEntries = useMemo(
    () => buildDraftEntries(planner),
    [activeWindow, creneauById, courseById, displayDays, planner, roomById, selectedClasse],
  );

  const planningConflicts = useMemo(
    () => computeConflicts(planningDraftEntries),
    [entriesToReplaceIds, planningDraftEntries, relatedEntries],
  );

  const bulkPreviewPlanner = useMemo(() => {
    if (!selectedCellKeys.length) return planner;

    const nextPlanner = { ...planner };

    selectedCellKeys.forEach((key) => {
      if (!bulkCourseId) {
        delete nextPlanner[key];
        return;
      }

      const previousCell = nextPlanner[key];

      if (bulkCourseId === PAUSE_COURSE_ID) {
        nextPlanner[key] = {
          ...previousCell,
          cours_id: undefined,
          salle_id: undefined,
          isPause: true,
        };
        return;
      }

      nextPlanner[key] = {
        ...previousCell,
        cours_id: bulkCourseId,
        salle_id: bulkSalleId || undefined,
        isPause: false,
      };
    });

    return nextPlanner;
  }, [bulkCourseId, bulkSalleId, planner, selectedCellKeys]);

  const bulkPreviewEntries = useMemo(
    () =>
      buildDraftEntries(bulkPreviewPlanner).filter((entry) =>
        selectedCellKeys.includes(entry.key),
      ),
    [bulkPreviewPlanner, selectedCellKeys],
  );

  const bulkPreviewConflicts = useMemo(() => {
    if (!bulkCourseId || bulkCourseId === PAUSE_COURSE_ID) return [];
    return computeConflicts(bulkPreviewEntries);
  }, [bulkCourseId, bulkPreviewEntries]);

  const mergedCells = useMemo(() => {
    const byKey: Record<
      string,
      {
        rowSpan: number;
        endCreneauId: string;
        coveredKeys: string[];
      }
    > = {};
    const hiddenKeys = new Set<string>();

    displayDays.forEach((day) => {
      let rowIndex = 0;

      while (rowIndex < creneaux.length) {
        const currentCreneau = creneaux[rowIndex];
        const currentKey = getPlannerCellKey(day.value, currentCreneau.id);
        const currentCell = planner[currentKey];
        const currentSignature = getPlannerMergeSignature(currentCell);

        let rowSpan = 1;
        const coveredKeys = [currentKey];

        if (currentSignature) {
          while (rowIndex + rowSpan < creneaux.length) {
            const nextCreneau = creneaux[rowIndex + rowSpan];
            const nextKey = getPlannerCellKey(day.value, nextCreneau.id);
            const nextSignature = getPlannerMergeSignature(planner[nextKey]);

            if (nextSignature !== currentSignature) {
              break;
            }

            coveredKeys.push(nextKey);
            hiddenKeys.add(nextKey);
            rowSpan += 1;
          }
        }

        byKey[currentKey] = {
          rowSpan,
          endCreneauId: creneaux[rowIndex + rowSpan - 1]?.id ?? currentCreneau.id,
          coveredKeys,
        };

        rowIndex += rowSpan;
      }
    });

    return { byKey, hiddenKeys };
  }, [creneaux, displayDays, planner]);

  const openBulkEditor = (keys: string[]) => {
    if (!keys.length) return;

    const selectedCells = keys
      .map((key) => planner[key])
      .filter(Boolean);

    const commonCourseId = getUniformValue(
      selectedCells.map((cell) => (cell?.isPause ? PAUSE_COURSE_ID : cell?.cours_id ?? "")),
    );
    const commonSalleId = getUniformValue(
      selectedCells.map((cell) => (cell?.isPause ? "" : cell?.salle_id ?? "")),
    );

    setSelectedCellKeys(keys);
    setBulkCourseId(commonCourseId ?? "");
    setBulkSalleId(commonSalleId ?? "");
    setBulkEditorOpen(true);
  };

  const buildSelectionKeys = (startDay: number, startCreneauId: string, endDay: number, endCreneauId: string) => {
    const startDayIndex = dayIndexByValue[startDay];
    const endDayIndex = dayIndexByValue[endDay];
    const startCreneauIndex = creneauIndexById[startCreneauId];
    const endCreneauIndex = creneauIndexById[endCreneauId];

    if (
      startDayIndex == null ||
      endDayIndex == null ||
      startCreneauIndex == null ||
      endCreneauIndex == null
    ) {
      return [];
    }

    const minDay = Math.min(startDayIndex, endDayIndex);
    const maxDay = Math.max(startDayIndex, endDayIndex);
    const minCreneau = Math.min(startCreneauIndex, endCreneauIndex);
    const maxCreneau = Math.max(startCreneauIndex, endCreneauIndex);

    const keys: string[] = [];

    for (let creneauIndex = minCreneau; creneauIndex <= maxCreneau; creneauIndex += 1) {
      const creneau = creneaux[creneauIndex];
      if (!creneau) continue;

      for (let dayIndex = minDay; dayIndex <= maxDay; dayIndex += 1) {
        const day = displayDays[dayIndex];
        if (!day || day.isOutsideYear) continue;
        keys.push(getPlannerCellKey(day.value, creneau.id));
      }
    }

    return keys;
  };

  const startSelection = (
    event: ReactMouseEvent<HTMLElement>,
    day: number,
    creneauId: string,
    endCreneauId?: string,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const keys = buildSelectionKeys(day, creneauId, day, endCreneauId ?? creneauId);
    setSelectionAnchor({ day, creneauId });
    setSelectedCellKeys(keys);
    setIsDraggingSelection(true);
  };

  const extendSelection = (day: number, creneauId: string) => {
    if (!isDraggingSelection || !selectionAnchor) return;
    setSelectedCellKeys(
      buildSelectionKeys(selectionAnchor.day, selectionAnchor.creneauId, day, creneauId),
    );
  };

  const finalizeSelection = () => {
    if (!isDraggingSelection) return;
    setIsDraggingSelection(false);

    if (selectedCellKeys.length > 0) {
      openBulkEditor(selectedCellKeys);
    }
  };

  const closeBulkEditor = () => {
    setBulkEditorOpen(false);
    setSelectionAnchor(null);
    setSelectedCellKeys([]);
    setBulkCourseId("");
    setBulkSalleId("");
  };

  const applyBulkSelection = () => {
    if (!selectedCellKeys.length) return;

    if (bulkCourseId && bulkCourseId !== PAUSE_COURSE_ID && bulkPreviewConflicts.length > 0) {
      info(
        "Cette selection provoque un conflit de salle ou d'enseignant. Corrige-le avant d'appliquer.",
        "error",
      );
      return;
    }

    selectedCellKeys.forEach((key) => {
      const [dayPart, creneauId] = key.split("::");
      const day = Number.parseInt(dayPart, 10);
      updatePlannerCell(day, creneauId, {
        cours_id: bulkCourseId || undefined,
        salle_id: bulkCourseId && bulkCourseId !== PAUSE_COURSE_ID ? bulkSalleId || undefined : undefined,
      });
    });

    closeBulkEditor();
  };

  const clearBulkSelection = () => {
    selectedCellKeys.forEach((key) => {
      const [dayPart, creneauId] = key.split("::");
      const day = Number.parseInt(dayPart, 10);
      updatePlannerCell(day, creneauId, {
        cours_id: undefined,
        salle_id: undefined,
      });
    });

    closeBulkEditor();
  };

  useEffect(() => {
    const handleMouseUp = () => finalizeSelection();

    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [isDraggingSelection, selectedCellKeys]);

  const handleSave = async () => {
    if (planningConflicts.length > 0) {
      info(
        "Le planning contient encore des conflits de salle, d'enseignant ou de classe.",
        "error",
      );
      return;
    }

    const shouldSave = window.confirm(
      planningMode === "specific_week"
        ? "Ce bouton va remplacer le planning specifique de la semaine selectionnee pour cette classe. Continuer ?"
        : "Ce bouton va remplacer tout l'emploi du temps de la classe selectionnee pour l'annee scolaire en cours. Continuer ?",
    );

    if (!shouldSave) return;

    const result = await savePlanning();
    if (result.success && !lockedPlanningMode) {
      setManualLockedPlanningMode(planningMode);
    }
    info(result.message, result.success ? "success" : "error");
  };

  const handleGeneratePdf = () => {
    if (!selectedClasse) {
      info("Selectionne d'abord une classe a exporter.", "warning");
      return;
    }

    if (plannedMinutes === 0) {
      info("Ajoute au moins une heure avant de generer le PDF.", "warning");
      return;
    }

    if (!creneaux.length) {
      info("Aucun creneau n'est disponible pour generer le PDF.", "warning");
      return;
    }

    downloadSchedulePdf({
      classe: selectedClasse,
      currentYear,
      days: displayDays,
      creneaux,
      planner,
      courseByCell: selectedCourseByCell,
      roomById,
      activeWindow,
    });

    info("Le PDF de l'emploi du temps a ete genere.", "success");
  };

  if (!etablissement_id) {
    return (
      <EmptyState
        title="Session incomplete"
        description="Connecte-toi a un etablissement pour planifier un emploi du temps global."
      />
    );
  }

  if (loading) {
    return (
      <div className="rounded-3xl bg-white p-10 shadow-sm">
        <Spin label="Chargement du tableau de bord..." showLabel />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)] sm:p-6">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">
                Emploi du temps
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Tableau de bord de planification
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Toute la configuration utile est regroupee en haut pour travailler
                plus vite, puis la grille occupe toute la place pour l'edition.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                {currentYear?.nom ?? "Annee non definie"}
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                {formatShortDate(activeWindow?.start)} - {formatShortDate(activeWindow?.end)}
              </div>
              <div
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  planningConflicts.length > 0
                    ? "bg-rose-100 text-rose-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {planningConflicts.length > 0
                  ? `${planningConflicts.length} conflit(s)`
                  : "Aucun conflit"}
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {error}
            </div>
          ) : (
            <div
              className={`rounded-[24px] border px-4 py-3 text-sm ${
                isPlanningModeLocked
                  ? "border-cyan-200 bg-cyan-50 text-cyan-900"
                  : "border-emerald-200 bg-emerald-50 text-emerald-900"
              }`}
            >
              <p className="font-semibold">
                {isPlanningModeLocked
                  ? `Mode ${lockedModeLabel ?? ""} actif pour cette classe`
                  : "Le mode reste libre jusqu'au premier enregistrement"}
              </p>
              <p className="mt-1 text-xs leading-5">
                {isPlanningModeLocked
                  ? `L'autre mode reste bloque pour ${selectedClasse?.nom ?? "la classe selectionnee"} sur cette annee.`
                  : "Tu peux choisir Annuel ou Semaine. Le premier mode enregistre sera ensuite verrouille."}
              </p>
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-[minmax(220px,260px)_minmax(250px,1fr)_minmax(220px,260px)]">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Mode de planning
              </p>
              <div className="mt-3 inline-flex w-full rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
                {[
                  { value: "recurrent", label: "Annuel" },
                  { value: "specific_week", label: "Semaine" },
                ].map((mode) => {
                  const nextMode = mode.value as PlanningMode;
                  const isBlockedMode = Boolean(
                    effectiveLockedPlanningMode &&
                      nextMode !== effectiveLockedPlanningMode,
                  );

                  return (
                    <button
                      key={mode.value}
                      type="button"
                      onClick={() => {
                        if (isBlockedMode) {
                          info(
                            effectiveLockedPlanningMode === "recurrent"
                              ? "Le mode Annuel est deja choisi pour cette classe. Le mode Semaine est bloque."
                              : "Le mode Semaine est deja choisi pour cette classe. Le mode Annuel est bloque.",
                            "warning",
                          );
                          return;
                        }

                        void setPlanningMode(nextMode);
                      }}
                      className={`flex-1 rounded-[14px] px-3 py-2 text-sm font-semibold transition ${
                        planningMode === mode.value
                          ? "bg-slate-950 text-white shadow-sm"
                          : isBlockedMode
                            ? "cursor-not-allowed text-slate-300"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                      disabled={loadingPlanning || saving || isBlockedMode}
                    >
                      <span className="flex items-center justify-center gap-2">{mode.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                {planningMode === "specific_week"
                  ? "Utilise une grille datee pour une semaine exceptionnelle."
                  : "Diffuse une semaine type sur toute l'annee scolaire."}
              </p>
            </div>

            <label className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
              <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Classe a planifier
              </span>
              <select
                value={selectedClasseId}
                onChange={(event) => {
                  void selectClasse(event.target.value);
                }}
                className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                disabled={loadingPlanning || saving || classes.length === 0}
              >
                <option value="">Choisir une classe</option>
                {classes.map((classe) => (
                  <option key={classe.id} value={classe.id}>
                    {classe.nom}
                  </option>
                ))}
              </select>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                {selectedClasse?.site?.nom
                  ? `${selectedClasse.site.nom} - ${selectedClasse?.niveau?.nom ?? "Niveau non precise"}`
                  : "Selectionne la classe a charger dans la grille."}
              </p>
            </label>

            {planningMode === "specific_week" ? (
              <label className="rounded-[24px] border border-cyan-100 bg-cyan-50/70 p-4">
                <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
                  Debut de semaine
                </span>
                <input
                  type="date"
                  value={specificWeekStart || toDateInputValue(currentYear?.date_debut)}
                  min={specificWeekBounds.min || undefined}
                  max={specificWeekBounds.max || undefined}
                  onChange={(event) => {
                    const selectedDate = event.target.value;
                    const normalizedDate = normalizeToWeekMonday(selectedDate);

                    if (selectedDate && normalizedDate && selectedDate !== normalizedDate) {
                      info(
                        `La semaine est alignee sur le lundi ${formatShortDate(normalizedDate)}.`,
                        "info",
                      );
                    }

                    void setSpecificWeekStart(selectedDate);
                  }}
                  className="mt-3 w-full rounded-2xl border border-cyan-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                  disabled={loadingPlanning || saving}
                />
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  La date choisie est automatiquement ramenee au lundi et doit rester dans l'annee scolaire active.
                </p>
              </label>
            ) : (
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/90 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Periode active
                </p>
                <p className="mt-3 text-base font-semibold text-slate-900">
                  Recurrence annuelle
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {formatShortDate(activeWindow?.start)} - {formatShortDate(activeWindow?.end)}
                </p>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Chaque creneau reste actif sur toute l'annee scolaire courante.
                </p>
              </div>
            )}

            <div className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-4 xl:col-span-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Actions
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Les commandes de travail restent regroupees sous la configuration du planning.
                  </p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {selectedClasse?.nom ?? "Aucune classe"}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => selectedClasseId && void selectClasse(selectedClasseId)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!selectedClasseId || loadingPlanning || saving}
                >
                  <FiRefreshCw />
                  Recharger
                </button>
                <button
                  type="button"
                  onClick={resetFromExisting}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!selectedClasseId || loadingPlanning || saving}
                >
                  <FiRotateCcw />
                  Version chargee
                </button>
                <button
                  type="button"
                  onClick={handleGeneratePdf}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 px-3 py-3 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!selectedClasseId || loadingPlanning || saving || plannedMinutes === 0}
                >
                  <FiDownload />
                  Exporter PDF
                </button>
                <button
                  type="button"
                  onClick={clearPlanner}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={loadingPlanning || saving || plannedMinutes === 0}
                >
                  <FiTrash2 />
                  Vider la grille
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={
                    !selectedClasseId ||
                    loadingPlanning ||
                    saving ||
                    planningConflicts.length > 0
                  }
                >
                  {saving ? <Spin inline /> : <FiSave />}
                  {planningMode === "specific_week"
                    ? "Enregistrer la semaine"
                    : "Enregistrer le planning"}
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<FiLayers />}
          label="Heures planifiees"
          value={`${formatHoursFromMinutes(plannedMinutes)} / ${formatHoursFromMinutes(totalMinutes)}`}
          accent="bg-emerald-100 text-emerald-700"
          helper="Vue immediate du volume horaire couvert sur la periode."
        />
        <StatCard
          icon={<FiBookOpen />}
          label="Matieres a placer"
          value={courses.length}
          accent="bg-cyan-100 text-cyan-700"
          helper="Cours disponibles pour construire la grille."
        />
        <StatCard
          icon={<FiClock />}
          label="Cours sans horaire"
          value={unplannedCourses}
          accent="bg-amber-100 text-amber-700"
          helper="Cours encore absents de la planification horaire."
        />
        <StatCard
          icon={<FiUsers />}
          label="Salles mobilisees"
          value={assignedRooms}
          accent="bg-slate-200 text-slate-700"
          helper="Nombre de salles deja affectees cette semaine."
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)]">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700 shadow-inner">
              <FiInfo />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Guide rapide</h3>
              <p className="mt-1 text-sm text-slate-500">
                Une organisation simple pour construire puis publier le planning.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                1. Choisir
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">Classe et mode</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Commence par la classe puis determine si tu travailles en annuel ou sur une semaine.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                2. Construire
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">Remplir la grille</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Selectionne une ou plusieurs cases, puis attribue un cours ou une pause.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                3. Verifier
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">Publier proprement</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Regarde les conflits affiches puis enregistre une version propre du planning.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Cours de la classe</h3>
              <p className="mt-1 text-sm text-slate-500">
                Visualise rapidement ce qui est deja place ou reste a placer.
              </p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {courses.length} cours
            </div>
          </div>

          <div className="mt-5 max-h-[320px] space-y-3 overflow-y-auto pr-1">
            {courses.length === 0 ? (
              <EmptyState
                title="Pas encore de cours"
                description="Ajoute d'abord les cours de la classe pour pouvoir les repartir dans la grille."
              />
            ) : (
              courses.map((course) => {
                const usageMinutes = courseUsageMinutesById[course.id] ?? 0;

                return (
                  <div
                    key={course.id}
                    className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {course.matiere?.nom ?? "Matiere sans nom"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {getTeacherDisplayLabel(course.enseignant)}
                        </p>
                        {getTeacherSecondaryLabel(course.enseignant) ? (
                          <p className="mt-1 text-[11px] text-slate-400">
                            {getTeacherSecondaryLabel(course.enseignant)}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          usageMinutes > 0
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {usageMinutes > 0 ? formatHoursFromMinutes(usageMinutes) : "A placer"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <div className="hidden">
      <div className="sticky top-3 z-30 flex flex-wrap gap-3 rounded-[28px] border border-slate-200 bg-white/88 p-2 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] backdrop-blur">

      </div>
      </div>

      <section className="min-w-0">
        <div
          className="min-w-0 space-y-6"
          onMouseEnter={() => setIsGridHovered(true)}
          onMouseLeave={() => setIsGridHovered(false)}
        >
          <SectionCard
            title="Grille hebdomadaire"
            description={
              planningMode === "specific_week"
                ? "Glisse sur plusieurs cases pour ouvrir une affectation groupee de la semaine datee."
                : "Glisse sur plusieurs cases pour affecter rapidement un cours et une salle sur la semaine type."
            }
            action={
              loadingPlanning ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Spin inline />
                  Chargement...
                </div>
              ) : null
            }
          >
            {!selectedClasseId ? (
              <EmptyState
                title="Choisir une classe"
                description="Des que la classe est selectionnee, on charge ses cours, ses salles et le planning adapte au mode choisi."
              />
            ) : courses.length === 0 && !loadingPlanning ? (
              <EmptyState
                title="Aucun cours trouve"
                description="La classe selectionnee n'a pas encore de cours associes a l'annee scolaire active."
              />
            ) : (
              <div className="space-y-4">
                {planningConflicts.length > 0 ? (
                  <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-900">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {planningConflicts.length} conflit(s) detecte(s)
                        </p>
                        <p className="mt-1 text-xs leading-5 text-rose-700">
                          La sauvegarde est bloquee tant que ces conflits ne sont pas resolus.
                        </p>
                      </div>
                      <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-rose-700">
                        Verification active
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {planningConflicts.slice(0, 6).map((conflict) => (
                        <div
                          key={conflict.key}
                          className="rounded-2xl border border-rose-200 bg-white px-3 py-3"
                        >
                          <p className="text-sm font-semibold text-rose-900">
                            {conflict.title}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-rose-700">
                            {conflict.message}
                          </p>
                        </div>
                      ))}
                      {planningConflicts.length > 6 ? (
                        <p className="text-xs text-rose-700">
                          ... et {planningConflicts.length - 6} autre(s) conflit(s).
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                    Aucun conflit de salle, d'enseignant ou de classe detecte sur la periode active.
                  </div>
                )}

                <div className={`rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,_#f8fafc_0%,_#ffffff_40%,_#f0fdf4_100%)] ${isCompactGrid ? "p-2.5" : "p-3"}`}>
                <div className={`mb-3 rounded-[24px] border border-white/70 bg-white/80 shadow-sm ${isCompactGrid ? "p-2.5" : "p-3"}`}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        Lecture rapide de la semaine
                      </p>
                      <p className={`text-slate-500 ${isCompactGrid ? "text-[11px]" : "text-xs"}`}>
                        Visualise le remplissage journalier avant d'entrer dans le detail des cases.
                      </p>
                    </div>
                    <div className={`flex flex-wrap ${isCompactGrid ? "gap-1.5" : "gap-2"}`}>
                      {displayDays.map((day) => (
                        <div
                          key={`summary-${day.value}`}
                          className={`rounded-full border font-medium ${
                            day.isOutsideYear
                              ? "border-slate-200 bg-slate-100 text-slate-400"
                              : "border-slate-200 bg-white text-slate-600"
                          } ${isCompactGrid ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"}`}
                        >
                          {day.label}
                          {day.helper ? ` (${day.helper})` : ""}:{" "}
                          {day.isOutsideYear
                            ? "hors annee"
                            : `${formatHoursFromMinutes(plannedMinutesByDay[day.value] ?? 0)} / ${formatHoursFromMinutes(
                                creneaux.reduce((total, item) => total + getCreneauDurationMinutes(item), 0),
                              )}`}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <div className={isCompactGrid ? "min-w-[920px]" : "min-w-[1080px]"}>
                    <table className="w-full table-fixed border-separate border-spacing-0">
                      <thead>
                        <tr>
                          <th
                            className={`sticky left-0 z-20 border border-slate-200 bg-white/95 text-left font-semibold text-slate-700 backdrop-blur ${
                              isCompactGrid ? "w-[138px] px-2.5 py-1.5 text-[11px]" : "w-[170px] px-3 py-2 text-xs"
                            }`}
                          >
                            Creneaux
                          </th>
                          {displayDays.map((day) => (
                            <th
                              key={day.value}
                              className={`border text-left font-semibold shadow-sm ${
                                day.isOutsideYear
                                  ? "border-slate-200 bg-slate-100 text-slate-400"
                                  : "border-slate-200 bg-white/90 text-slate-800"
                              } ${
                                isCompactGrid ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-xs"
                              }`}
                            >
                              {day.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {creneaux.map((creneau) => (
                          <tr key={creneau.id}>
                            <th
                              className={`sticky left-0 z-10 border border-slate-200 bg-white/95 text-left font-semibold text-slate-900 shadow-sm backdrop-blur ${
                                isCompactGrid ? "px-2.5 py-1.5 text-[11px]" : "px-3 py-2 text-xs"
                              }`}
                            >
                              {creneau.heure_debut} - {creneau.heure_fin}
                            </th>
                            {displayDays.map((day) => {
                              const cellKey = getPlannerCellKey(day.value, creneau.id);
                              const isUnavailableDay = Boolean(day.isOutsideYear);

                              if (mergedCells.hiddenKeys.has(cellKey)) {
                                return null;
                              }

                              const cell = planner[cellKey];
                              const selectedCourse = selectedCourseByCell[cellKey];
                              const isPauseCell = Boolean(cell?.isPause);
                              const mergeInfo = mergedCells.byKey[cellKey] ?? {
                                rowSpan: 1,
                                endCreneauId: creneau.id,
                                coveredKeys: [cellKey],
                              };
                              const isSelected = mergeInfo.coveredKeys.some((key) =>
                                selectedCellKeys.includes(key),
                              );
                              const baseCellHeight = isCompactGrid ? 42 : 52;
                              const mergedCellMinHeight = baseCellHeight * mergeInfo.rowSpan;

                              return (
                                <td
                                  key={cellKey}
                                  rowSpan={mergeInfo.rowSpan}
                                  onMouseDown={(event) => {
                                    if (isUnavailableDay) return;
                                    startSelection(
                                      event,
                                      day.value,
                                      creneau.id,
                                      mergeInfo.endCreneauId,
                                    );
                                  }}
                                  onMouseEnter={() => {
                                    if (isUnavailableDay) return;
                                    extendSelection(day.value, mergeInfo.endCreneauId);
                                  }}
                                  className={`p-0 align-top ${
                                    isSelected ? "relative" : ""
                                  }`}
                                >
                                  <div
                                    style={{ minHeight: `${mergedCellMinHeight}px` }}
                                    className={`group flex h-full min-h-full select-none flex-col justify-center border text-center transition-all duration-150 ${
                                      isUnavailableDay
                                        ? "cursor-not-allowed border-dashed border-slate-200 bg-slate-50"
                                        : cell?.cours_id || isPauseCell
                                        ? "border-emerald-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f0fdf4_100%)] hover:border-emerald-300"
                                        : "border-slate-200 bg-white/90 hover:border-cyan-300"
                                    } ${
                                      isSelected
                                        ? "ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-50"
                                        : ""
                                    } ${
                                      isCompactGrid
                                        ? "px-2 py-1"
                                        : mergeInfo.rowSpan > 1
                                          ? "px-2.5 py-2"
                                          : "px-2.5 py-1.5"
                                    }`}
                                  >
                                    {isUnavailableDay ? (
                                      <div
                                        className={`flex h-full items-center justify-center font-medium text-slate-400 ${
                                          isCompactGrid ? "text-[10px]" : "text-xs"
                                        }`}
                                      >
                                        Hors annee scolaire
                                      </div>
                                    ) : isPauseCell ? (
                                      <div className="flex h-full flex-col items-center justify-center space-y-1">
                                        <p
                                          className={`font-semibold text-amber-900 ${
                                            isCompactGrid ? "text-xs" : "text-sm"
                                          }`}
                                        >
                                          Pause
                                        </p>
                                      </div>
                                    ) : selectedCourse ? (
                                      <div className="flex h-full flex-col items-center justify-center space-y-1">
                                        <p
                                          className={`line-clamp-3 font-semibold text-slate-900 ${
                                            isCompactGrid ? "text-xs leading-4" : "text-sm"
                                          }`}
                                        >
                                          {selectedCourse.matiere?.nom ?? "Matiere"}
                                        </p>
                                        {cell?.salle_id && roomById[cell.salle_id] ? (
                                          <div
                                            className={`inline-flex items-center justify-center gap-1 rounded-full bg-slate-100 font-medium text-slate-600 ${
                                              isCompactGrid
                                                ? "px-2 py-0.5 text-[9px]"
                                                : "px-2.5 py-1 text-[10px]"
                                            }`}
                                          >
                                            <FiMapPin />
                                            {roomById[cell.salle_id]?.nom}
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : (
                                      <div
                                        className={`flex h-full items-center justify-center text-slate-400 ${
                                          isCompactGrid ? "text-[10px]" : "text-xs"
                                        }`}
                                      >
                                        {isCompactGrid ? "" : ""}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              </div>
            )}
          </SectionCard>
        </div>

        <aside className="hidden min-w-0 space-y-6 2xl:sticky 2xl:top-6 2xl:self-start">
          <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700 shadow-inner">
                <FiCheckCircle />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Vue d'ensemble
                </h3>
                <p className="text-sm text-slate-500">
                  Les reperes utiles pour garder un planning propre et lisible.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Couverture de grille
                </p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {totalMinutes === 0 ? "0%" : `${Math.round((plannedMinutes / totalMinutes) * 100)}%`}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Cadence
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {planningMode === "specific_week"
                    ? "Semaine precise datee"
                    : "Semaine type sur l'annee scolaire"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {planningMode === "specific_week"
                    ? "Chaque creneau porte uniquement les dates de la semaine selectionnee."
                    : "Chaque creneau porte ses dates d'effet sur l'annee active."}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Action globale
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {planningMode === "specific_week"
                    ? "Sauvegarde = override de la semaine"
                    : "Sauvegarde = remplacement complet"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {planningMode === "specific_week"
                    ? "Pratique pour gerer une semaine speciale sans perdre le planning annuel."
                    : "Pratique pour replanifier toute la classe lors d'un changement."}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,_#ffffff_0%,_#f8fafc_100%)] p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Cours de la classe
                </h3>
                <p className="text-sm text-slate-500">
                  Repere rapidement ce qui est deja place dans la grille ou reste a placer.
                </p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {courses.length} cours
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {courses.length === 0 ? (
                <EmptyState
                  title="Pas encore de cours"
                  description="Ajoute d'abord les cours de la classe pour pouvoir les repartir dans la grille."
                />
              ) : (
                courses.map((course) => {
                  const usageMinutes = courseUsageMinutesById[course.id] ?? 0;

                  return (
                    <div
                      key={course.id}
                      className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {course.matiere?.nom ?? "Matiere sans nom"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {getTeacherDisplayLabel(course.enseignant)}
                          </p>
                          {getTeacherSecondaryLabel(course.enseignant) ? (
                            <p className="mt-1 text-[11px] text-slate-400">
                              {getTeacherSecondaryLabel(course.enseignant)}
                            </p>
                          ) : null}
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            usageMinutes > 0
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {usageMinutes > 0 ? formatHoursFromMinutes(usageMinutes) : "A placer"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>
      </section>

      {isGridRendered && !bulkEditorOpen ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-10 z-40 flex justify-end px-4 sm:px-6 xl:px-8">
          <div
            onMouseEnter={() => setIsShortcutHovered(true)}
            onMouseLeave={() => setIsShortcutHovered(false)}
            className={`flex items-center gap-3 rounded-[22px] border border-slate-200 bg-white/95 px-3 py-3 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.45)] backdrop-blur transition-all duration-200 ease-out ${
              isShortcutVisible
                ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
                : "pointer-events-none translate-y-3 scale-95 opacity-0"
            }`}
          >
            <div className="hidden sm:block">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Raccourci
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {planningConflicts.length > 0
                  ? `${planningConflicts.length} conflit(s) a corriger`
                  : "Enregistrement accessible depuis la grille"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void handleSave()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={
                !selectedClasseId ||
                loadingPlanning ||
                saving ||
                planningConflicts.length > 0
              }
            >
              {saving ? <Spin inline /> : <FiSave />}
              {planningMode === "specific_week"
                ? "Enregistrer la semaine"
                : "Enregistrer le planning"}
            </button>
          </div>
        </div>
      ) : null}

      {bulkEditorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_28px_80px_-32px_rgba(15,23,42,0.6)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
                  Affectation groupee
                </p>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">
                  Attribuer un cours a la selection
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {selectedCellKeys.length} case(s) seront mises a jour en une seule action.
                </p>
              </div>
              <button
                type="button"
                onClick={closeBulkEditor}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
              >
                <FiX />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Cours
                </span>
                <select
                  value={bulkCourseId}
                  onChange={(event) => {
                    setBulkCourseId(event.target.value);
                    if (!event.target.value || event.target.value === PAUSE_COURSE_ID) {
                      setBulkSalleId("");
                    }
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                >
                  <option value="">Aucun cours</option>
                  <option value={PAUSE_COURSE_ID}>Pause</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {getCourseLabel(course)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Salle
                </span>
                <select
                  value={bulkSalleId}
                  onChange={(event) => setBulkSalleId(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!bulkCourseId || bulkCourseId === PAUSE_COURSE_ID}
                >
                  <option value="">Salle non definie</option>
                  {salles.map((room) => (
                    <option key={room.id} value={room.id}>
                      {getRoomLabel(room)}
                    </option>
                  ))}
                </select>
              </label>

              {bulkCourseId && bulkCourseId !== PAUSE_COURSE_ID && bulkPreviewConflicts.length > 0 ? (
                <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-900">
                  <p className="font-semibold">
                    Des conflits bloquent cette affectation
                  </p>
                  <div className="mt-3 grid gap-2">
                    {bulkPreviewConflicts.slice(0, 4).map((conflict) => (
                      <div
                        key={conflict.key}
                        className="rounded-2xl border border-rose-200 bg-white px-3 py-3"
                      >
                        <p className="text-sm font-semibold text-rose-900">
                          {conflict.title}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-rose-700">
                          {conflict.message}
                        </p>
                      </div>
                    ))}
                    {bulkPreviewConflicts.length > 4 ? (
                      <p className="text-xs text-rose-700">
                        ... et {bulkPreviewConflicts.length - 4} autre(s) conflit(s).
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={clearBulkSelection}
                className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
              >
                <FiTrash2 />
                Vider la selection
              </button>
              <button
                type="button"
                onClick={closeBulkEditor}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={applyBulkSelection}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={
                  Boolean(
                    bulkCourseId &&
                      bulkCourseId !== PAUSE_COURSE_ID &&
                      bulkPreviewConflicts.length > 0,
                  )
                }
              >
                <FiCheck />
                Appliquer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
