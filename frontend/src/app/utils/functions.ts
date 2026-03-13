type FormattedDateTime = {
  date: string;
  heure: string;
  dateHeure: string;
  annee: string;
  mois: string;
  jour: string;
};

export function formatDateWithLocalTimezone(
  isoDate: string,
  storageKey = "timezone",
): FormattedDateTime {
  const dateObj = new Date(isoDate);

  if (Number.isNaN(dateObj.getTime())) {
    return {
      date: "",
      heure: "",
      dateHeure: "",
      annee: "",
      mois: "",
      jour: "",
    };
  }

  const savedTimeZone = localStorage.getItem(storageKey) || "UTC";

  let timeZone = savedTimeZone;
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone }).format(dateObj);
  } catch {
    timeZone = "UTC";
  }

  const dateParts = new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).formatToParts(dateObj);

  const timeParts = new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(dateObj);

  const getDatePart = (type: Intl.DateTimeFormatPartTypes) =>
    dateParts.find((p) => p.type === type)?.value ?? "";

  const getTimePart = (type: Intl.DateTimeFormatPartTypes) =>
    timeParts.find((p) => p.type === type)?.value ?? "";

  const jour = getDatePart("day");
  const mois = getDatePart("month");
  const annee = getDatePart("year");
  const heure = `${getTimePart("hour")}:${getTimePart("minute")}`;

  const date = `${jour} ${mois} ${annee}`;
  const dateHeure = `${date}, ${heure}`;

  return {
    date,
    heure,
    dateHeure,
    annee,
    mois,
    jour,
  };
}