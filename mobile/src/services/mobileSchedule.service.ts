import type { EmploiDuTempsItem } from "@/types/models";

export type ScheduleTimingState = "current" | "upcoming" | "completed";

export type MergedScheduleBlock = {
  id: string;
  day: number;
  dayLabel: string;
  startsAt: string;
  endsAt: string;
  className: string;
  subjectName: string;
  roomName: string;
  teacherName: string;
  slotLabel: string;
  timingState: ScheduleTimingState;
  rawRows: EmploiDuTempsItem[];
};

const WEEKDAY_LABELS: Record<number, string> = {
  1: "Lundi",
  2: "Mardi",
  3: "Mercredi",
  4: "Jeudi",
  5: "Vendredi",
  6: "Samedi",
  7: "Dimanche",
};

export function parseWeekday(value?: number | string | null) {
  const numeric = typeof value === "string" ? Number(value) : value ?? null;
  return typeof numeric === "number" && Number.isFinite(numeric) ? numeric : null;
}

export function getWeekdayLabel(value?: number | string | null) {
  const numeric = parseWeekday(value);
  return numeric ? WEEKDAY_LABELS[numeric] ?? `Jour ${numeric}` : "Jour non renseigne";
}

export function toMinutes(value?: string | null) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function getNowMinutes(now: Date) {
  return now.getHours() * 60 + now.getMinutes();
}

function getTeacherName(row: EmploiDuTempsItem) {
  return [
    row.enseignant?.personnel?.utilisateur?.profil?.prenom?.trim(),
    row.enseignant?.personnel?.utilisateur?.profil?.nom?.trim(),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function getSignature(row: EmploiDuTempsItem) {
  return (
    row.cours_id?.trim() ||
    [
      row.classe_id?.trim() || row.classe?.id || "",
      row.matiere?.id || row.matiere?.nom?.trim() || "",
      row.enseignant_id?.trim() || row.enseignant?.id || getTeacherName(row),
      row.salle?.id || row.salle?.nom?.trim() || "",
      row.type_portee?.trim() || "",
    ].join("::")
  );
}

function sortScheduleRows(left: EmploiDuTempsItem, right: EmploiDuTempsItem) {
  const leftDay = parseWeekday(left.jour_semaine) ?? Number.MAX_SAFE_INTEGER;
  const rightDay = parseWeekday(right.jour_semaine) ?? Number.MAX_SAFE_INTEGER;
  if (leftDay !== rightDay) return leftDay - rightDay;

  const leftMinutes = toMinutes(left.heure_debut ?? left.creneau?.heure_debut) ?? Number.MAX_SAFE_INTEGER;
  const rightMinutes = toMinutes(right.heure_debut ?? right.creneau?.heure_debut) ?? Number.MAX_SAFE_INTEGER;
  return leftMinutes - rightMinutes;
}

function resolveTimingState(
  day: number,
  startsAt: string,
  endsAt: string,
  now: Date,
): ScheduleTimingState {
  const todayDay = ((now.getDay() + 6) % 7) + 1;
  if (day < todayDay) return "completed";
  if (day > todayDay) return "upcoming";

  const nowMinutes = getNowMinutes(now);
  const startMinutes = toMinutes(startsAt);
  const endMinutes = toMinutes(endsAt);

  if (startMinutes === null || endMinutes === null) return "upcoming";
  if (nowMinutes >= startMinutes && nowMinutes < endMinutes) return "current";
  if (nowMinutes < startMinutes) return "upcoming";
  return "completed";
}

export function mergeScheduleRows(
  rows: EmploiDuTempsItem[],
  now = new Date(),
): MergedScheduleBlock[] {
  const ordered = [...rows].sort(sortScheduleRows);
  const blocks: MergedScheduleBlock[] = [];

  for (const row of ordered) {
    const day = parseWeekday(row.jour_semaine) ?? 0;
    const subjectName = row.matiere?.nom?.trim() || "Cours";
    const className = row.classe?.nom?.trim() || "Classe";
    const roomName = row.salle?.nom?.trim() || "Salle non renseignee";
    const teacherName = getTeacherName(row);
    const startsAt = row.heure_debut?.trim() || row.creneau?.heure_debut?.trim() || "";
    const endsAt = row.heure_fin?.trim() || row.creneau?.heure_fin?.trim() || "";

    const previous = blocks[blocks.length - 1];
    const shouldMerge =
      previous &&
      previous.day === day &&
      getSignature(previous.rawRows[0]) === getSignature(row) &&
      previous.className === className &&
      previous.endsAt === startsAt;

    if (shouldMerge) {
      previous.rawRows.push(row);
      previous.endsAt = endsAt || previous.endsAt;
      previous.slotLabel = `${previous.startsAt} - ${previous.endsAt}`;
      previous.timingState = resolveTimingState(
        previous.day,
        previous.startsAt,
        previous.endsAt,
        now,
      );
      continue;
    }

    blocks.push({
      id: row.id,
      day,
      dayLabel: getWeekdayLabel(day),
      startsAt,
      endsAt,
      className,
      subjectName,
      roomName,
      teacherName,
      slotLabel: startsAt && endsAt ? `${startsAt} - ${endsAt}` : row.creneau?.nom?.trim() || "Creneau",
      timingState: resolveTimingState(day, startsAt, endsAt, now),
      rawRows: [row],
    });
  }

  return blocks;
}
