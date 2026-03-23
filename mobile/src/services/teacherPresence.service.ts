import { api } from "@/lib/api";
import {
  mergeScheduleRows,
  toMinutes,
  type MergedScheduleBlock,
} from "@/services/mobileSchedule.service";
import { getFirst, getRows } from "@/services/query.service";
import type {
  ApiEnvelope,
  EmploiDuTempsItem,
  PersistedSession,
  PresenceEleveItem,
  SessionAppelItem,
  TeacherAttendanceBundle,
  TeacherAttendanceCourse,
  TeacherAttendanceStudent,
} from "@/types/models";

const EMPLOI_INCLUDE = {
  classe: { include: { niveau: true, site: true } },
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
  creneau: true,
  salle: true,
} as const;

const SESSION_INCLUDE = {
  classe: { include: { niveau: true, site: true } },
  emploi: {
    include: {
      cours: {
        include: {
          matiere: true,
        },
      },
      creneau: true,
      salle: true,
    },
  },
  creneau: true,
} as const;

const PRESENCE_INCLUDE = {
  session: {
    include: SESSION_INCLUDE,
  },
  eleve: {
    include: {
      utilisateur: {
        include: {
          profil: true,
        },
      },
    },
  },
} as const;

function getWeekdayNumber(date: Date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function getNowMinutes(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function getCourseLabel(entry: MergedScheduleBlock): TeacherAttendanceCourse {
  return {
    id: entry.id,
    className: entry.className,
    subjectName: entry.subjectName,
    roomName: entry.roomName,
    slotLabel: `${entry.dayLabel} | ${entry.slotLabel}`,
    startsAt: entry.startsAt,
    endsAt: entry.endsAt,
    timingState: entry.timingState,
  };
}

function sortStudents(items: TeacherAttendanceStudent[]) {
  return [...items].sort((left, right) => left.name.localeCompare(right.name, "fr"));
}

async function getTeacherId(userId: string, etablissementId: string) {
  const teacher = await getFirst<{ id: string }>("enseignant", {
    where: {
      personnel: {
        is: {
          utilisateur_id: userId,
          etablissement_id: etablissementId,
        },
      },
    },
  });

  return teacher?.id ?? null;
}

async function getTodayCourses(teacherId: string, etablissementId: string, now: Date) {
  const day = getWeekdayNumber(now);
  const { start, end } = getDayBounds(now);
  const rows = await getRows<EmploiDuTempsItem>("emploi-du-temps", {
    take: 50,
    where: {
      enseignant_id: teacherId,
      jour_semaine: day,
      classe: { etablissement_id: etablissementId },
      effectif_du: { lte: end.toISOString() },
      effectif_au: { gte: start.toISOString() },
    },
    includeSpec: EMPLOI_INCLUDE,
    orderBy: [{ creneau: { ordre: "asc" } }, { creneau: { heure_debut: "asc" } }],
  });

  return rows;
}

function findCurrentCourse(items: MergedScheduleBlock[]) {
  return items.find((item) => item.timingState === "current") ?? null;
}

function findNextCourse(items: MergedScheduleBlock[]) {
  return items.find((item) => item.timingState === "upcoming") ?? null;
}

function getDayBounds(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

async function ensureSession(
  course: MergedScheduleBlock,
  teacherId: string,
  now: Date,
) {
  const anchorRow =
    course.rawRows.find((row) => {
      const start = toMinutes(row.heure_debut ?? row.creneau?.heure_debut);
      const end = toMinutes(row.heure_fin ?? row.creneau?.heure_fin);
      if (start === null || end === null) return false;
      return getNowMinutes(now) >= start && getNowMinutes(now) < end;
    }) ?? course.rawRows[0] ?? null;

  const emploiDuTempsId = anchorRow?.id?.trim();
  if (!emploiDuTempsId) {
    throw new Error("Le cours detecte ne contient pas assez d'informations pour ouvrir la session d'appel.");
  }

  const { start, end } = getDayBounds(now);

  const existing = await getFirst<SessionAppelItem>("session-appel", {
    where: {
      emploi_du_temps_id: emploiDuTempsId,
      date: {
        gte: start.toISOString(),
        lte: end.toISOString(),
      },
    },
    includeSpec: SESSION_INCLUDE,
    orderBy: [{ date: "desc" }],
  });

  if (existing) {
    return existing.id;
  }

  const payload = {
    emploi_du_temps_id: emploiDuTempsId,
    date: now.toISOString(),
    pris_par_enseignant_id: teacherId,
    pris_le: now.toISOString(),
  };

  const { data } = await api.post<ApiEnvelope<{ id: string }>>("/api/session-appel", payload);
  return data.data.id;
}

async function getSessionPresences(sessionId: string) {
  const rows = await getRows<PresenceEleveItem>("presence-eleve", {
    take: 120,
    where: { session_appel_id: sessionId },
    includeSpec: PRESENCE_INCLUDE,
    orderBy: [{ created_at: "asc" }],
  });

  return sortStudents(
    rows.map((item) => ({
      id: item.id,
      eleveId: item.eleve_id?.trim() || item.eleve?.id || "",
      name:
        [
          item.eleve?.utilisateur?.profil?.prenom?.trim(),
          item.eleve?.utilisateur?.profil?.nom?.trim(),
        ]
          .filter(Boolean)
          .join(" ")
          .trim() || item.eleve?.code_eleve?.trim() || "Eleve",
      code: item.eleve?.code_eleve?.trim() || "",
      status:
        item.statut === "ABSENT" ||
        item.statut === "RETARD" ||
        item.statut === "EXCUSE"
          ? item.statut
          : "PRESENT",
      minutesLate: item.minutes_retard ?? null,
      note: item.note ?? null,
    })),
  );
}

export async function loadTeacherAttendanceBundle(
  session: PersistedSession,
  selectedCourseId?: string | null,
): Promise<TeacherAttendanceBundle> {
  const now = new Date();
  const etablissementId = session.user.etablissement_id?.trim() ?? "";
  const teacherId = await getTeacherId(session.user.id, etablissementId);

  if (!teacherId) {
    return {
      title: "Appel du cours",
      subtitle: "Le compte enseignant n'est pas encore relie a un profil enseignant.",
      todayCourses: [],
      selectedCourse: null,
      currentCourse: null,
      nextCourse: null,
      sessionId: null,
      sessionStatus: "idle",
      students: [],
    };
  }

  const todayRows = await getTodayCourses(teacherId, etablissementId, now);
  const todayCourses = mergeScheduleRows(todayRows, now);
  const currentCourse = findCurrentCourse(todayCourses);
  const nextCourse = findNextCourse(todayCourses);
  const selectedCourse =
    todayCourses.find((item) => item.id === selectedCourseId) ??
    currentCourse ??
    nextCourse ??
    todayCourses[0] ??
    null;

  if (!selectedCourse) {
    return {
      title: "Appel du cours",
      subtitle: nextCourse
        ? "Aucun cours n'est en cours. Le prochain creneau est deja identifie."
        : "Aucun cours actif n'a ete detecte pour aujourd'hui.",
      todayCourses: [],
      selectedCourse: null,
      currentCourse: null,
      nextCourse: nextCourse ? getCourseLabel(nextCourse) : null,
      sessionId: null,
      sessionStatus: "idle",
      students: [],
    };
  }

  const sessionId = await ensureSession(selectedCourse, teacherId, now);
  const students = await getSessionPresences(sessionId);
  const todayCourseCards = todayCourses.map((item) => getCourseLabel(item));

  return {
    title: "Appel du cours",
    subtitle:
      currentCourse?.id === selectedCourse.id
        ? "La session du cours en cours est detectee automatiquement depuis l'emploi du temps."
        : "Choisis un cours du jour pour ouvrir la session d'appel du bon creneau.",
    todayCourses: todayCourseCards,
    selectedCourse: getCourseLabel(selectedCourse),
    currentCourse: currentCourse ? getCourseLabel(currentCourse) : null,
    nextCourse: nextCourse ? getCourseLabel(nextCourse) : null,
    sessionId,
    sessionStatus: "ready",
    students,
  };
}

export async function updateTeacherPresenceStatus(
  student: TeacherAttendanceStudent,
  nextStatus: TeacherAttendanceStudent["status"],
  currentCourse: TeacherAttendanceCourse | null,
) {
  const now = new Date();
  const startMinutes = toMinutes(currentCourse?.startsAt ?? null);
  const nowMinutes = getNowMinutes(now);
  const lateMinutes =
    nextStatus === "RETARD" && startMinutes !== null
      ? Math.max(nowMinutes - startMinutes, 1)
      : null;

  await api.put(`/api/presence-eleve/${student.id}`, {
    statut: nextStatus,
    minutes_retard: lateMinutes,
    note: student.note ?? null,
  });
}

export async function updateTeacherPresenceStatuses(
  students: TeacherAttendanceStudent[],
  nextStatus: TeacherAttendanceStudent["status"],
  currentCourse: TeacherAttendanceCourse | null,
) {
  for (const student of students) {
    await updateTeacherPresenceStatus(student, nextStatus, currentCourse);
  }
}

export async function closeTeacherAttendanceSession(sessionId: string) {
  const { data } = await api.get<ApiEnvelope<SessionAppelItem>>(`/api/session-appel/${sessionId}`);
  const session = data.data;

  if ((!session?.emploi_du_temps_id && (!session?.classe_id || !session?.creneau_horaire_id)) || !session?.date) {
    throw new Error("La session d'appel selectionnee est incomplete et ne peut pas etre cloturee.");
  }

  await api.put(`/api/session-appel/${sessionId}`, {
    emploi_du_temps_id: session.emploi_du_temps_id ?? null,
    classe_id: session.classe_id,
    creneau_horaire_id: session.creneau_horaire_id,
    date: session.date,
    pris_par_enseignant_id: session.pris_par_enseignant_id ?? null,
    pris_le: new Date().toISOString(),
  });
}
