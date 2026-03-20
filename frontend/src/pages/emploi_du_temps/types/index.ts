import type {
  Cours,
  CreneauHoraire,
  EmploiDuTemps,
  Enseignant,
  EvenementCalendrier,
  Personnel,
  Profil,
  Salle,
  Site,
  Utilisateur,
} from "../../../types/models";

export type SelectOption = {
  value: string;
  label: string;
};

export type PlannerCellDraft = {
  cours_id?: string;
  salle_id?: string;
  sourceId?: string;
  isPause?: boolean;
};

export const PAUSE_COURSE_ID = "__DEFAULT_PAUSE__";

export function isPauseCourseValue(value?: string | null): boolean {
  return value === PAUSE_COURSE_ID;
}

export function getPlannerCellKey(day: number, creneauId: string): string {
  return `${day}::${creneauId}`;
}

export const WEEKDAY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: "Lundi" },
  { value: 2, label: "Mardi" },
  { value: 3, label: "Mercredi" },
  { value: 4, label: "Jeudi" },
  { value: 5, label: "Vendredi" },
  { value: 6, label: "Samedi" },
  { value: 7, label: "Dimanche" },
];

export type ScheduleFormInput = Omit<
  EmploiDuTemps,
  "id" | "created_at" | "updated_at"
>;

export type CreneauFormInput = Omit<
  CreneauHoraire,
  "id" | "created_at" | "updated_at"
>;

export type EventFormInput = Omit<
  EvenementCalendrier,
  "id" | "created_at" | "updated_at"
>;

export type EventRow = EvenementCalendrier & {
  site?: Site | null;
};

export const EVENT_TYPE_OPTIONS: SelectOption[] = [
  { value: "Cours", label: "Cours special" },
  { value: "Examen", label: "Examen" },
  { value: "Reunion", label: "Reunion" },
  { value: "Activite", label: "Activite" },
  { value: "Ferie", label: "Jour ferie" },
  { value: "Sortie", label: "Sortie" },
];

export type ScheduleRow = EmploiDuTemps & {
  cours?: (Cours & { classe?: EmploiDuTemps["classe"] }) | null;
  enseignant?: (Enseignant & {
    personnel?: (Personnel & {
      utilisateur?: (Utilisateur & { profil?: Profil | null }) | null;
    }) | null;
  }) | null;
  salle?: (Salle & { site?: Site | null }) | null;
  creneau?: CreneauHoraire;
};

type TeacherLike = {
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

type ScheduleDisplayLike = Pick<
  EmploiDuTemps,
  "cours_id" | "matiere_id" | "effectif_du" | "effectif_au"
> & {
  classe?: {
    nom?: string | null;
    niveau?: {
      nom?: string | null;
    } | null;
    site?: {
      nom?: string | null;
    } | null;
  } | null;
  cours?: {
    classe?: {
      nom?: string | null;
      niveau?: {
        nom?: string | null;
      } | null;
      site?: {
        nom?: string | null;
      } | null;
    } | null;
    matiere?: {
      nom?: string | null;
    } | null;
  } | null;
  matiere?: {
    nom?: string | null;
  } | null;
  enseignant?: TeacherLike;
  salle?: {
    nom?: string | null;
    site?: {
      nom?: string | null;
    } | null;
  } | null;
  creneau?: {
    nom?: string | null;
    heure_debut?: string | null;
    heure_fin?: string | null;
  } | null;
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

export function getWeekdayLabel(day: number | null | undefined): string {
  if (!day) return "-";
  return WEEKDAY_LABELS[day] ?? String(day);
}

export function getCreneauLabel(creneau?: CreneauHoraire | null): string {
  if (!creneau) return "-";
  return `${creneau.nom} (${creneau.heure_debut} - ${creneau.heure_fin})`;
}

export function getScheduleSubjectLabel(schedule?: ScheduleDisplayLike | null): string {
  if (!schedule) return "Cours non renseigne";

  const matiere = schedule.matiere?.nom?.trim() ?? schedule.cours?.matiere?.nom?.trim() ?? "";
  if (matiere) return matiere;

  if (!schedule.cours_id && !schedule.matiere_id) {
    return "Pause";
  }

  return "Cours non renseigne";
}

export function getScheduleClasseLabel(schedule?: ScheduleDisplayLike | null): string {
  if (!schedule) return "Classe non renseignee";

  const classe = schedule.classe ?? schedule.cours?.classe;
  const nom = classe?.nom?.trim() ?? "";
  const niveau = classe?.niveau?.nom?.trim() ?? "";
  const site = classe?.site?.nom?.trim() ?? "";

  if (nom && niveau) return `${nom} - ${niveau}`;
  if (nom && site) return `${nom} - ${site}`;
  if (nom) return nom;
  if (niveau) return niveau;
  if (site) return site;
  return "Classe non renseignee";
}

export function getScheduleRoomLabel(schedule?: ScheduleDisplayLike | null): string {
  if (!schedule) return "Salle non renseignee";

  const nom = schedule.salle?.nom?.trim() ?? "";
  const site = schedule.salle?.site?.nom?.trim() ?? "";

  if (nom && site) return `${nom} - ${site}`;
  if (nom) return nom;
  if (site) return site;
  return "Salle non renseignee";
}

export function getScheduleDateWindowLabel(
  schedule: Pick<EmploiDuTemps, "effectif_du" | "effectif_au">,
): string {
  const start = new Date(schedule.effectif_du);
  const end = new Date(schedule.effectif_au);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Fenetre non renseignee";
  }

  const formatter = new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

export function getScheduleScopeMeta(
  schedule: Pick<EmploiDuTemps, "effectif_du" | "effectif_au">,
): {
  label: string;
  tone: string;
} {
  const start = new Date(schedule.effectif_du);
  const end = new Date(schedule.effectif_au);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { label: "Non defini", tone: "bg-slate-100 text-slate-600" };
  }

  const diffDays = Math.round(
    (new Date(end.setHours(23, 59, 59, 999)).getTime() -
      new Date(start.setHours(0, 0, 0, 0)).getTime()) /
      86400000,
  );

  if (diffDays <= 6) {
    return { label: "Specifique", tone: "bg-cyan-100 text-cyan-700" };
  }

  return { label: "Recurrent", tone: "bg-emerald-100 text-emerald-700" };
}

export function getEventTypeLabel(type?: string | null): string {
  if (!type) return "Non classe";
  return EVENT_TYPE_OPTIONS.find((item) => item.value === type)?.label ?? type;
}

export function getEventStatus(event: Pick<EvenementCalendrier, "debut" | "fin">): {
  label: string;
  tone: string;
} {
  const now = new Date();
  const start = new Date(event.debut);
  const end = new Date(event.fin);

  if (start <= now && end >= now) {
    return { label: "En cours", tone: "bg-emerald-100 text-emerald-700" };
  }

  if (start > now) {
    return { label: "A venir", tone: "bg-sky-100 text-sky-700" };
  }

  return { label: "Termine", tone: "bg-slate-200 text-slate-700" };
}

export function getEventDurationLabel(event: Pick<EvenementCalendrier, "debut" | "fin">): string {
  const start = new Date(event.debut).getTime();
  const end = new Date(event.fin).getTime();

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return "-";

  const totalMinutes = Math.round((end - start) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) return `${hours} h ${minutes} min`;
  if (hours > 0) return `${hours} h`;
  return `${minutes} min`;
}

export function isEventOnSameDay(
  event: Pick<EvenementCalendrier, "debut">,
  date: Date,
): boolean {
  const target = new Date(event.debut);
  return (
    target.getFullYear() === date.getFullYear() &&
    target.getMonth() === date.getMonth() &&
    target.getDate() === date.getDate()
  );
}

export function getTeacherDisplayLabel(teacher?: TeacherLike): string {
  const prenom = teacher?.personnel?.utilisateur?.profil?.prenom?.trim() ?? "";
  const nom = teacher?.personnel?.utilisateur?.profil?.nom?.trim() ?? "";
  const fullName = [prenom, nom].filter(Boolean).join(" ").trim();
  const code = teacher?.personnel?.code_personnel?.trim() ?? "";
  const poste = teacher?.personnel?.poste?.trim() ?? "";

  if (code && fullName) return `${code} - ${fullName}`;
  if (fullName) return fullName;
  if (code && poste) return `${code} - ${poste}`;
  if (code) return code;
  if (poste) return poste;
  return "Enseignant non renseigne";
}

export function getTeacherSecondaryLabel(teacher?: TeacherLike): string {
  const prenom = teacher?.personnel?.utilisateur?.profil?.prenom?.trim() ?? "";
  const nom = teacher?.personnel?.utilisateur?.profil?.nom?.trim() ?? "";
  const fullName = [prenom, nom].filter(Boolean).join(" ").trim();
  const code = teacher?.personnel?.code_personnel?.trim() ?? "";
  const poste = teacher?.personnel?.poste?.trim() ?? "";

  if (fullName && poste) return poste;
  if (code && poste) return poste;
  if (!fullName && code) return "Code enseignant";
  return "";
}
