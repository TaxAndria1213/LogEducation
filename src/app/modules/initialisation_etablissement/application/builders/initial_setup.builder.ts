import { defaultPeriodTemplates } from "../templates/default-periods.template";
import { standardLevelTemplates } from "../templates/standard-levels.template";

export type BlockMode =
  | "CREATION"
  | "REPRISE"
  | "REPRISE_MODIFIEE"
  | "DESACTIVEE"
  | "PLUS_TARD";

export type InitialisationPreviewBlock = {
  code: string;
  libelle: string;
  mode: BlockMode;
  statut: "PRET" | "DIFFERE" | "IGNORE";
  description: string;
  estimation_creation: number;
  execution_disponible: boolean;
};

export type InitialSetupPayload = {
  etablissement_id: string;
  include_site_principal: boolean;
  site_principal_nom?: string;
  site_principal_adresse?: string;
  site_principal_telephone?: string;
  create_initial_year: boolean;
  annee_nom?: string;
  annee_date_debut?: string;
  annee_date_fin?: string;
  periods_strategy: "STANDARD" | "PERSONNALISE";
  periods_template_code?: string;
  periods: {
    nom: string;
    date_debut?: string;
    date_fin?: string;
    ordre: number;
  }[];
  selected_level_codes: string[];
  custom_levels: string[];
  classes_by_level: {
    level_code: string;
    level_nom: string;
    class_names: string[];
  }[];
  academic_by_level: {
    level_code: string;
    level_nom: string;
    programme_nom: string;
    subjects: {
      nom: string;
      code?: string;
      heures_semaine?: number;
      coefficient?: number;
    }[];
  }[];
  finance_catalogues: {
    level_code?: string;
    class_name?: string;
    nom: string;
    description?: string;
    montant?: number;
    devise: string;
    nombre_tranches: number;
    usage_scope: string;
    est_recurrent: boolean;
    periodicite?: string | null;
    prorata_eligible: boolean;
    eligibilite_json: Record<string, unknown> | null;
  }[];
  selected_role_names: string[];
  classes_mode: BlockMode;
  academic_mode: BlockMode;
  security_mode: BlockMode;
  finance_mode: BlockMode;
  services_mode: BlockMode;
  audit_mode: BlockMode;
};

function toTrimmedString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
  }
  return fallback;
}

function toBlockMode(value: unknown, fallback: BlockMode): BlockMode {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toUpperCase();
  const allowed: BlockMode[] = [
    "CREATION",
    "REPRISE",
    "REPRISE_MODIFIEE",
    "DESACTIVEE",
    "PLUS_TARD",
  ];
  return allowed.includes(normalized as BlockMode)
    ? (normalized as BlockMode)
    : fallback;
}

export function isImmediateCreationMode(mode: BlockMode) {
  return mode === "CREATION";
}

const ALLOWED_PERIODICITIES = new Set([
  "daily",
  "weekly",
  "monthly",
  "term",
  "semester",
  "year",
]);

const ALLOWED_USAGE_SCOPES = new Set([
  "GENERAL",
  "INSCRIPTION",
  "SCOLARITE",
  "OPTION_PEDAGOGIQUE",
  "ACTIVITE_EXTRASCOLAIRE",
  "FOURNITURE",
  "UNIFORME",
  "BADGE",
  "EXAMEN",
  "RATTRAPAGE",
  "COMPLEMENTAIRE",
]);

function toPeriodStrategy(value: unknown): "STANDARD" | "PERSONNALISE" {
  return typeof value === "string" &&
    value.trim().toUpperCase() === "PERSONNALISE"
    ? "PERSONNALISE"
    : "STANDARD";
}

function parseStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n|,/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeRoleGuardToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, " ");
}

function isForbiddenAdminRoleName(value: string) {
  return [
    "ADMIN",
    "ADMINISTRATEUR",
    "ADMINISTRATOR",
    "SUPER ADMIN",
    "SUPERADMIN",
  ].includes(normalizeRoleGuardToken(value));
}

function parseAllowedRoleNames(value: unknown) {
  return Array.from(
    new Set(
      parseStringList(value).filter(
        (roleName) => !isForbiddenAdminRoleName(roleName),
      ),
    ),
  );
}

function parseOptionalNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim().replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function parsePositiveInteger(value: unknown, fallback = 1) {
  const parsed = parseOptionalNumber(value);
  if (typeof parsed !== "number") return fallback;
  return Math.max(1, Math.round(parsed));
}

function normalizeEligibilityRules(raw: unknown) {
  if (raw == null || raw === "") return null;

  const value =
    typeof raw === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(raw) as unknown;
            return parsed &&
              typeof parsed === "object" &&
              !Array.isArray(parsed)
              ? (parsed as Record<string, unknown>)
              : null;
          } catch {
            return null;
          }
        })()
      : typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : null;

  if (!value) {
    throw new Error(
      "Les regles d'eligibilite des frais catalogue doivent etre un JSON valide.",
    );
  }

  const normalized: Record<string, unknown> = {};
  const normalizeStringArray = (input: unknown) => {
    if (!Array.isArray(input)) return null;
    const items = input
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
    return items.length > 0 ? items : null;
  };

  if (value.classe_ids != null && !Array.isArray(value.classe_ids)) {
    throw new Error("La regle classe_ids doit etre un tableau de chaines.");
  }

  if (value.eleve_ids != null && !Array.isArray(value.eleve_ids)) {
    throw new Error("La regle eleve_ids doit etre un tableau de chaines.");
  }

  const classeIds = normalizeStringArray(value.classe_ids);
  const eleveIds = normalizeStringArray(value.eleve_ids);

  if (classeIds) normalized.classe_ids = classeIds;
  if (eleveIds) normalized.eleve_ids = eleveIds;

  return Object.keys(normalized).length > 0 ? normalized : null;
}

function parseDateOnly(value?: string | null) {
  if (!value) return null;

  const trimmed = String(value).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  parsed.setHours(0, 0, 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
  const startUtc = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((endUtc - startUtc) / 86_400_000);
}

function buildEvenDateRanges(
  yearStart: Date,
  yearEnd: Date,
  periodCount: number,
) {
  const totalInclusiveDays = differenceInCalendarDays(yearStart, yearEnd) + 1;

  return Array.from({ length: periodCount }, (_, index) => {
    const startOffset = Math.floor((totalInclusiveDays * index) / periodCount);
    const nextStartOffset = Math.floor(
      (totalInclusiveDays * (index + 1)) / periodCount,
    );
    const endOffset = Math.max(startOffset, nextStartOffset - 1);

    return {
      date_debut: formatDateOnly(addDays(yearStart, startOffset)),
      date_fin: formatDateOnly(addDays(yearStart, endOffset)),
    };
  });
}

function buildPresetPeriods(
  templateCode: string | undefined,
  yearStartValue?: string,
  yearEndValue?: string,
) {
  const selectedTemplate =
    defaultPeriodTemplates.find((template) => template.code === templateCode) ??
    defaultPeriodTemplates[0] ??
    null;
  const basePeriods = [...(selectedTemplate?.periodes ?? [])].sort(
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
      date_debut: undefined,
      date_fin: undefined,
      ordre: periode.ordre,
    }));
  }

  const ranges = buildEvenDateRanges(yearStart, yearEnd, basePeriods.length);

  return basePeriods.map((periode, index) => {
    return {
      nom: periode.nom,
      date_debut: ranges[index]?.date_debut,
      date_fin: ranges[index]?.date_fin,
      ordre: periode.ordre,
    };
  });
}

function normalizeCustomPeriods(value: unknown) {
  const rawPeriods = Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> =>
          Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
      )
    : [];

  return rawPeriods
    .map((periode, index) => ({
      nom: toTrimmedString(periode.nom) ?? "",
      date_debut: toTrimmedString(periode.date_debut),
      date_fin: toTrimmedString(periode.date_fin),
      ordre: index + 1,
    }))
    .filter((periode) => periode.nom || periode.date_debut || periode.date_fin);
}

function normalizeClassGroups(
  value: unknown,
  levels: { code: string; nom: string }[],
) {
  const rawGroups = Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> =>
          Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
      )
    : [];

  const rawByCode = new Map(
    rawGroups.map((group) => [
      toTrimmedString(group.level_code) ??
        toTrimmedString(group.level_nom) ??
        "",
      group,
    ]),
  );

  return levels.map((level) => {
    const rawGroup =
      rawByCode.get(level.code) ??
      rawGroups.find((group) => toTrimmedString(group.level_nom) === level.nom);

    return {
      level_code: level.code,
      level_nom: level.nom,
      class_names: Array.from(new Set(parseStringList(rawGroup?.class_names))),
    };
  });
}

function normalizeAcademicGroups(
  value: unknown,
  levels: { code: string; nom: string }[],
) {
  const rawGroups = Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> =>
          Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
      )
    : [];

  const rawByCode = new Map(
    rawGroups.map((group) => [
      toTrimmedString(group.level_code) ??
        toTrimmedString(group.level_nom) ??
        "",
      group,
    ]),
  );

  return levels.map((level) => {
    const rawGroup =
      rawByCode.get(level.code) ??
      rawGroups.find((group) => toTrimmedString(group.level_nom) === level.nom);

    const rawSubjects = Array.isArray(rawGroup?.subjects)
      ? rawGroup.subjects.filter(
          (entry): entry is Record<string, unknown> =>
            Boolean(entry) &&
            typeof entry === "object" &&
            !Array.isArray(entry),
        )
      : [];

    const subjects = rawSubjects
      .map((subject) => ({
        nom: toTrimmedString(subject.nom) ?? "",
        code: toTrimmedString(subject.code),
        heures_semaine: parseOptionalNumber(subject.heures_semaine),
        coefficient: parseOptionalNumber(subject.coefficient),
      }))
      .filter((subject) => subject.nom);

    return {
      level_code: level.code,
      level_nom: level.nom,
      programme_nom:
        toTrimmedString(rawGroup?.programme_nom) ?? `Programme ${level.nom}`,
      subjects,
    };
  });
}

function normalizeFinanceCatalogues(value: unknown) {
  const rawCatalogues = Array.isArray(value)
    ? value.filter(
        (entry): entry is Record<string, unknown> =>
          Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
      )
    : [];

  return rawCatalogues
    .map((catalogue) => {
      const estRecurrent = toBoolean(catalogue.est_recurrent, false);
      const periodicite =
        toTrimmedString(catalogue.periodicite)?.toLowerCase() ?? null;
      const usageScope =
        toTrimmedString(catalogue.usage_scope)?.toUpperCase() ?? "GENERAL";

      return {
        level_code: toTrimmedString(catalogue.level_code),
        class_name: toTrimmedString(catalogue.class_name),
        nom: toTrimmedString(catalogue.nom) ?? "",
        description: toTrimmedString(catalogue.description),
        montant: parseOptionalNumber(catalogue.montant),
        devise: toTrimmedString(catalogue.devise)?.toUpperCase() ?? "MGA",
        nombre_tranches: parsePositiveInteger(catalogue.nombre_tranches, 1),
        usage_scope: usageScope,
        est_recurrent: estRecurrent,
        periodicite: estRecurrent ? periodicite : null,
        prorata_eligible:
          estRecurrent && periodicite === "monthly"
            ? toBoolean(catalogue.prorata_eligible, false)
            : false,
        eligibilite_json: normalizeEligibilityRules(catalogue.eligibilite_json),
      };
    })
    .filter((catalogue) => {
      return (
        catalogue.nom ||
        typeof catalogue.montant === "number" ||
        Boolean(catalogue.description) ||
        Boolean(catalogue.level_code)
      );
    });
}

function buildResolvedLevels(selectedCodes: string[], customLevels: string[]) {
  const standardLevels = standardLevelTemplates
    .filter((level) => selectedCodes.includes(level.code))
    .map((level) => ({
      nom: level.nom,
      ordre: level.ordre,
      code: level.code,
    }));

  const customResolvedLevels = customLevels.map((nom, index) => ({
    nom,
    ordre: standardLevels.length + index + 1,
    code: `CUSTOM_${index + 1}`,
  }));

  return [...standardLevels, ...customResolvedLevels];
}

function buildBlock(
  code: string,
  libelle: string,
  mode: BlockMode,
  description: string,
  estimationCreation: number,
  executionDisponible: boolean,
): InitialisationPreviewBlock {
  return {
    code,
    libelle,
    mode,
    statut:
      mode === "DESACTIVEE"
        ? "IGNORE"
        : executionDisponible && isImmediateCreationMode(mode)
          ? "PRET"
          : "DIFFERE",
    description,
    estimation_creation: estimationCreation,
    execution_disponible: executionDisponible,
  };
}

export function getInitialYearWindow(payload: InitialSetupPayload) {
  if (!payload.create_initial_year) return null;

  const dateDebut = parseDateOnly(payload.annee_date_debut);
  const dateFin = parseDateOnly(payload.annee_date_fin);

  if (!payload.annee_nom || !dateDebut || !dateFin) {
    return null;
  }

  return {
    date_debut: dateDebut,
    date_fin: dateFin,
  };
}

export function validateInitialSetupPeriods(payload: InitialSetupPayload) {
  if (!payload.create_initial_year) {
    return [];
  }

  const yearWindow = getInitialYearWindow(payload);
  if (!yearWindow) {
    return [
      "Le libelle et les dates de l'annee scolaire sont requis avant de preparer les periodes.",
    ];
  }

  if (yearWindow.date_debut.getTime() > yearWindow.date_fin.getTime()) {
    return [
      "La date de debut de l'annee scolaire doit preceder la date de fin.",
    ];
  }

  if (
    payload.periods_strategy === "PERSONNALISE" &&
    payload.periods.length === 0
  ) {
    return [
      "Ajoute au moins une periode personnalisee ou reviens sur un modele standard.",
    ];
  }

  const incompletePeriods = payload.periods.filter(
    (periode) => !periode.nom || !periode.date_debut || !periode.date_fin,
  );
  if (incompletePeriods.length > 0) {
    return [
      "Chaque periode doit avoir un nom, une date de debut et une date de fin.",
    ];
  }

  const normalizedPeriods = payload.periods
    .map((periode) => ({
      ...periode,
      start: parseDateOnly(periode.date_debut),
      end: parseDateOnly(periode.date_fin),
    }))
    .sort((left, right) => left.ordre - right.ordre);

  for (const periode of normalizedPeriods) {
    if (!periode.start || !periode.end) {
      return [`Les dates de la periode ${periode.nom} sont invalides.`];
    }

    if (periode.start.getTime() > periode.end.getTime()) {
      return [
        `La date de debut de la periode ${periode.nom} doit preceder sa date de fin.`,
      ];
    }

    if (
      periode.start.getTime() < yearWindow.date_debut.getTime() ||
      periode.end.getTime() > yearWindow.date_fin.getTime()
    ) {
      return [
        `La periode ${periode.nom} doit rester incluse dans les bornes de l'annee scolaire.`,
      ];
    }
  }

  for (let index = 1; index < normalizedPeriods.length; index += 1) {
    const previous = normalizedPeriods[index - 1];
    const current = normalizedPeriods[index];

    if (
      previous.start &&
      previous.end &&
      current.start &&
      current.end &&
      current.start.getTime() <= previous.end.getTime()
    ) {
      return [
        `Les periodes ${previous.nom} et ${current.nom} se chevauchent. Ajuste leurs dates.`,
      ];
    }
  }

  return [];
}

export function validateInitialSetupFinanceCatalogues(
  payload: InitialSetupPayload,
) {
  if (!isImmediateCreationMode(payload.finance_mode)) {
    return [];
  }

  if (payload.finance_catalogues.length === 0) {
    return [
      "Ajoute au moins un frais catalogue ou reporte le bloc Finance a plus tard.",
    ];
  }

  const levelCodes = new Set(
    buildResolvedLevels(
      payload.selected_level_codes,
      payload.custom_levels,
    ).map((level) => level.code),
  );
  const classNamesByLevel = new Map(
    payload.classes_by_level.map((group) => [
      group.level_code,
      new Set(group.class_names),
    ]),
  );
  const issues: string[] = [];

  payload.finance_catalogues.forEach((catalogue, index) => {
    const label = catalogue.nom || `Frais catalogue ${index + 1}`;

    if (!catalogue.nom) {
      issues.push(`Le nom du frais catalogue ${index + 1} est requis.`);
    }

    if (
      typeof catalogue.montant !== "number" ||
      !Number.isFinite(catalogue.montant) ||
      catalogue.montant < 0
    ) {
      issues.push(`Le montant du frais ${label} doit etre positif ou nul.`);
    }

    if (!ALLOWED_USAGE_SCOPES.has(catalogue.usage_scope)) {
      issues.push(`L'usage du frais ${label} n'est pas valide.`);
    }

    if (
      catalogue.est_recurrent &&
      (!catalogue.periodicite ||
        !ALLOWED_PERIODICITIES.has(catalogue.periodicite))
    ) {
      issues.push(`La periodicite du frais recurrent ${label} est requise.`);
    }

    if (catalogue.level_code && !levelCodes.has(catalogue.level_code)) {
      issues.push(
        `Le niveau cible du frais ${label} n'est plus selectionne dans le wizard.`,
      );
    }

    if (catalogue.class_name && !catalogue.level_code) {
      issues.push(
        `Le frais ${label} doit avoir un niveau pour cibler une classe.`,
      );
    }

    if (
      catalogue.class_name &&
      catalogue.level_code &&
      !classNamesByLevel.get(catalogue.level_code)?.has(catalogue.class_name)
    ) {
      issues.push(
        `La classe cible du frais ${label} n'est plus presente dans l'etape Classes.`,
      );
    }
  });

  return issues;
}

export function normalizeInitialSetupPayload(
  body: unknown,
): InitialSetupPayload {
  const raw =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};

  const etablissementId = toTrimmedString(raw.etablissement_id);
  if (!etablissementId) {
    throw new Error("L'etablissement cible est obligatoire.");
  }

  const selectedCodes = parseStringList(raw.selected_level_codes);
  const customLevels = Array.from(new Set(parseStringList(raw.custom_levels)));
  const resolvedLevels = buildResolvedLevels(selectedCodes, customLevels);
  const classesByLevel = normalizeClassGroups(
    raw.classes_by_level,
    resolvedLevels,
  );
  const academicByLevel = normalizeAcademicGroups(
    raw.academic_by_level,
    resolvedLevels,
  );
  const periodsStrategy = toPeriodStrategy(raw.periods_strategy);
  const periodsTemplateCode =
    toTrimmedString(raw.periods_template_code) ??
    defaultPeriodTemplates[0]?.code;
  const configuredPeriods = normalizeCustomPeriods(raw.custom_periods);
  const periods =
    configuredPeriods.length > 0
      ? configuredPeriods
      : buildPresetPeriods(
          periodsTemplateCode,
          toTrimmedString(raw.annee_date_debut),
          toTrimmedString(raw.annee_date_fin),
        );

  return {
    etablissement_id: etablissementId,
    include_site_principal: toBoolean(raw.include_site_principal, true),
    site_principal_nom: toTrimmedString(raw.site_principal_nom),
    site_principal_adresse: toTrimmedString(raw.site_principal_adresse),
    site_principal_telephone: toTrimmedString(raw.site_principal_telephone),
    create_initial_year: toBoolean(raw.create_initial_year, true),
    annee_nom: toTrimmedString(raw.annee_nom),
    annee_date_debut: toTrimmedString(raw.annee_date_debut),
    annee_date_fin: toTrimmedString(raw.annee_date_fin),
    periods_strategy: periodsStrategy,
    periods_template_code: periodsTemplateCode,
    periods,
    selected_level_codes: selectedCodes,
    custom_levels: customLevels,
    classes_by_level: classesByLevel,
    academic_by_level: academicByLevel,
    finance_catalogues: normalizeFinanceCatalogues(raw.finance_catalogues),
    selected_role_names: parseAllowedRoleNames(raw.selected_role_names),
    classes_mode: toBlockMode(raw.classes_mode, "PLUS_TARD"),
    academic_mode: toBlockMode(raw.academic_mode, "PLUS_TARD"),
    security_mode: toBlockMode(raw.security_mode, "PLUS_TARD"),
    finance_mode: toBlockMode(raw.finance_mode, "PLUS_TARD"),
    services_mode: toBlockMode(raw.services_mode, "PLUS_TARD"),
    audit_mode: toBlockMode(raw.audit_mode, "PLUS_TARD"),
  };
}

export function resolveLevelNames(payload: InitialSetupPayload) {
  return buildResolvedLevels(
    payload.selected_level_codes,
    payload.custom_levels,
  );
}

export function buildInitialSetupPreviewBlocks(
  payload: InitialSetupPayload,
): InitialisationPreviewBlock[] {
  const levelCount = resolveLevelNames(payload).length;
  const initialYearReady = Boolean(
    getInitialYearWindow(payload) &&
      payload.annee_nom &&
      payload.annee_date_debut &&
      payload.annee_date_fin,
  );
  const periodIssues = validateInitialSetupPeriods(payload);
  const periodsReady = payload.create_initial_year && periodIssues.length === 0;
  const periodCount = periodsReady ? payload.periods.length : 0;
  const plannedClassCount = payload.classes_by_level.reduce(
    (sum, group) => sum + group.class_names.length,
    0,
  );
  const levelsWithClasses = payload.classes_by_level.filter(
    (group) => group.class_names.length > 0,
  ).length;
  const classesReady =
    isImmediateCreationMode(payload.classes_mode) &&
    levelCount > 0 &&
    levelsWithClasses === levelCount &&
    plannedClassCount > 0;
  const plannedAcademicSubjectCount = payload.academic_by_level.reduce(
    (sum, group) => sum + group.subjects.length,
    0,
  );
  const plannedRoleCount = payload.selected_role_names.length;
  const levelsWithAcademic = payload.academic_by_level.filter(
    (group) => group.subjects.length > 0 && group.programme_nom.trim(),
  ).length;
  const academicReady =
    isImmediateCreationMode(payload.academic_mode) &&
    levelCount > 0 &&
    levelsWithAcademic === levelCount &&
    plannedAcademicSubjectCount > 0;
  const securityReady =
    isImmediateCreationMode(payload.security_mode) && plannedRoleCount > 0;
  const financeIssues = validateInitialSetupFinanceCatalogues(payload);
  const plannedFinanceCatalogueCount = payload.finance_catalogues.length;
  const financeReady =
    isImmediateCreationMode(payload.finance_mode) &&
    plannedFinanceCatalogueCount > 0 &&
    financeIssues.length === 0;

  return [
    buildBlock(
      "ETABLISSEMENT_BASE",
      "Socle etablissement",
      payload.include_site_principal ? "CREATION" : "PLUS_TARD",
      payload.include_site_principal
        ? "Creation ou verification du site principal et des coordonnees d'exploitation."
        : "Le site principal sera complete plus tard.",
      payload.include_site_principal ? 1 : 0,
      true,
    ),
    buildBlock(
      "ANNEE_INITIALE",
      "Annee scolaire initiale",
      payload.create_initial_year ? "CREATION" : "PLUS_TARD",
      payload.create_initial_year
        ? initialYearReady
          ? "Creation de la premiere annee scolaire operationnelle de l'etablissement."
          : "Complete le libelle et les bornes de l'annee avant de generer ce bloc."
        : "La premiere annee scolaire sera ouverte plus tard.",
      initialYearReady ? 1 : 0,
      initialYearReady,
    ),
    buildBlock(
      "PERIODES",
      "Periodes academiques",
      payload.create_initial_year ? "CREATION" : "PLUS_TARD",
      !payload.create_initial_year
        ? "Les periodes seront definies au moment de l'ouverture effective de l'annee."
        : payload.periods_strategy === "PERSONNALISE"
          ? periodsReady
            ? "Creation immediate des periodes personnalisees renseignees dans cette etape."
            : "Complete ou ajuste les periodes personnalisees pour finaliser ce bloc."
          : periodsReady
            ? "Creation immediate des periodes standards choisies, reparties automatiquement sur l'annee."
            : "Les bornes de l'annee sont encore necessaires pour calculer les periodes standards.",
      periodCount,
      periodsReady,
    ),
    buildBlock(
      "NIVEAUX",
      "Niveaux scolaires",
      levelCount > 0 ? "CREATION" : "PLUS_TARD",
      levelCount > 0
        ? "Preparation des niveaux standards selectionnes et des niveaux personnalises."
        : "Aucun niveau n'a ete selectionne pour cette premiere passe.",
      levelCount,
      true,
    ),
    buildBlock(
      "CLASSES",
      "Classes",
      payload.classes_mode,
      !isImmediateCreationMode(payload.classes_mode)
        ? "Les classes sont laissees pour une passe ulterieure sans bloquer le reste de l'initialisation."
        : classesReady
          ? "Generation immediate des classes par niveau sur l'annee scolaire de depart."
          : "Chaque niveau selectionne doit encore recevoir au moins une classe avant generation.",
      classesReady ? plannedClassCount : 0,
      classesReady,
    ),
    buildBlock(
      "ACADEMIQUE",
      "Referentiel academique",
      payload.academic_mode,
      !isImmediateCreationMode(payload.academic_mode)
        ? "Le referentiel academique sera renseigne dans une passe ulterieure."
        : academicReady
          ? "Creation immediate des programmes par niveau et de leurs matieres de depart."
          : "Chaque niveau doit avoir un programme et au moins une matiere avant generation.",
      academicReady
        ? payload.academic_by_level.length + plannedAcademicSubjectCount
        : 0,
      academicReady,
    ),
    buildBlock(
      "SECURITE",
      "Roles et securite",
      payload.security_mode,
      !isImmediateCreationMode(payload.security_mode)
        ? "Les roles standards de l'etablissement seront prepares plus tard."
        : securityReady
          ? "Creation immediate des roles classiques coches dans cette etape."
          : "Selectionne au moins un role standard pour lancer ce bloc.",
      securityReady ? plannedRoleCount : 0,
      securityReady,
    ),
    buildBlock(
      "FINANCE",
      "Socle finance",
      payload.finance_mode,
      !isImmediateCreationMode(payload.finance_mode)
        ? "Le catalogue financier est laisse pour une passe ulterieure."
        : financeReady
          ? "Creation immediate des frais catalogue saisis dans cette etape."
          : "Ajoute au moins un frais catalogue complet ou reporte ce bloc.",
      financeReady ? plannedFinanceCatalogueCount : 0,
      financeReady,
    ),
    buildBlock(
      "AUDIT_NOTIFICATIONS",
      "Audit et notifications",
      payload.audit_mode,
      "Journal d'audit et modeles de notification de base prevus pour la suite.",
      0,
      false,
    ),
  ];
}
