import type {
  Cours,
  CreneauHoraire,
  EmploiDuTemps,
  Enseignant,
  EvenementCalendrier,
  Salle,
  Site,
} from "../../../types/models";

export type SelectOption = {
  value: string;
  label: string;
};

export type ScheduleFormInput = Omit<
  EmploiDuTemps,
  "id" | "created_at" | "updated_at"
>;

export type EventFormInput = Omit<
  EvenementCalendrier,
  "id" | "created_at" | "updated_at"
>;

export type ScheduleRow = EmploiDuTemps & {
  cours?: (Cours & { classe?: EmploiDuTemps["classe"] }) | null;
  enseignant?: (Enseignant & { personnel?: Enseignant["personnel"] }) | null;
  salle?: (Salle & { site?: Site | null }) | null;
  creneau?: CreneauHoraire;
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
