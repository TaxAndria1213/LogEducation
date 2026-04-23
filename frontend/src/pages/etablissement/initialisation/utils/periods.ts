import type {
  InitialisationPeriodDraft,
  InitialisationSetupDraft,
  InitialisationTemplates,
} from "../types";

function isPeriodFilled(period: InitialisationPeriodDraft) {
  return Boolean(period.nom.trim() || period.date_debut || period.date_fin);
}

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  date.setHours(0, 0, 0, 0);

  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day)
  ) {
    return null;
  }

  return date;
}

function formatDateOnly(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function differenceInCalendarDays(start: Date, end: Date) {
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endUtc - startUtc) / 86_400_000);
}

function buildEvenDateRanges(yearStart: Date, yearEnd: Date, periodCount: number) {
  const totalInclusiveDays = differenceInCalendarDays(yearStart, yearEnd) + 1;

  return Array.from({ length: periodCount }, (_, index) => {
    const startOffset = Math.floor((totalInclusiveDays * index) / periodCount);
    const nextStartOffset = Math.floor((totalInclusiveDays * (index + 1)) / periodCount);
    const endOffset = Math.max(startOffset, nextStartOffset - 1);

    return {
      date_debut: formatDateOnly(addDays(yearStart, startOffset)),
      date_fin: formatDateOnly(addDays(yearStart, endOffset)),
    };
  });
}

export function buildEmptyCustomPeriod(): InitialisationPeriodDraft {
  return {
    nom: "",
    date_debut: "",
    date_fin: "",
  };
}

export function getSelectedPeriodTemplate(
  templates: InitialisationTemplates | null,
  templateCode: string,
) {
  const templatesList = templates?.periodes_standards ?? [];
  return (
    templatesList.find((template) => template.code === templateCode) ??
    templatesList[0] ??
    null
  );
}

export function buildPeriodsFromTemplate(
  templates: InitialisationTemplates | null,
  templateCode: string,
  yearStartValue: string,
  yearEndValue: string,
): InitialisationPeriodDraft[] {
  const template = getSelectedPeriodTemplate(templates, templateCode);
  const basePeriods = [...(template?.periodes ?? [])].sort(
    (left, right) => left.ordre - right.ordre,
  );

  if (!basePeriods.length) {
    return [];
  }

  const yearStart = parseDateOnly(yearStartValue);
  const yearEnd = parseDateOnly(yearEndValue);

  if (!yearStart || !yearEnd || yearStart.getTime() > yearEnd.getTime()) {
    return basePeriods.map((periode) => ({
      nom: periode.nom,
      date_debut: "",
      date_fin: "",
    }));
  }

  const ranges = buildEvenDateRanges(yearStart, yearEnd, basePeriods.length);

  return basePeriods.map((periode, index) => {
    return {
      nom: periode.nom,
      date_debut: ranges[index]?.date_debut ?? "",
      date_fin: ranges[index]?.date_fin ?? "",
    };
  });
}

export function syncPeriodsWithTemplateBoundaries(
  templates: InitialisationTemplates | null,
  templateCode: string,
  yearStartValue: string,
  yearEndValue: string,
  currentPeriods: InitialisationPeriodDraft[],
): InitialisationPeriodDraft[] {
  const basePeriods = buildPeriodsFromTemplate(
    templates,
    templateCode,
    yearStartValue,
    yearEndValue,
  );

  if (!basePeriods.length) {
    return [];
  }

  return basePeriods.map((basePeriod, index) => {
    const currentPeriod =
      currentPeriods.find((period) => period.nom === basePeriod.nom) ??
      currentPeriods[index];

    return {
      nom: basePeriod.nom,
      date_debut: basePeriod.date_debut || currentPeriod?.date_debut || "",
      date_fin: basePeriod.date_fin || currentPeriod?.date_fin || "",
    };
  });
}

export function arePeriodsEqual(
  left: InitialisationPeriodDraft[],
  right: InitialisationPeriodDraft[],
) {
  if (left.length !== right.length) return false;

  return left.every((period, index) => {
    const other = right[index];
    if (!other) return false;
    return (
      period.nom === other?.nom &&
      period.date_debut === other.date_debut &&
      period.date_fin === other.date_fin
    );
  });
}

export function resolveDraftPeriods(
  draft: Pick<
    InitialisationSetupDraft,
    | "periods_strategy"
    | "periods_template_code"
    | "custom_periods"
    | "annee_date_debut"
    | "annee_date_fin"
  >,
  templates: InitialisationTemplates | null,
) {
  if (draft.periods_strategy === "PERSONNALISE" || draft.custom_periods.length > 0) {
    return draft.custom_periods.filter(isPeriodFilled);
  }

  return buildPeriodsFromTemplate(
    templates,
    draft.periods_template_code,
    draft.annee_date_debut,
    draft.annee_date_fin,
  );
}

export function countConfiguredPeriods(
  draft: Pick<
    InitialisationSetupDraft,
    | "periods_strategy"
    | "periods_template_code"
    | "custom_periods"
    | "annee_date_debut"
    | "annee_date_fin"
  >,
  templates: InitialisationTemplates | null,
) {
  return resolveDraftPeriods(draft, templates).length;
}
