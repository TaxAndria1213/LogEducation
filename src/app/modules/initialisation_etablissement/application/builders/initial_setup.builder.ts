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
  create_default_departements: boolean;
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
      toTrimmedString(group.level_code) ?? toTrimmedString(group.level_nom) ?? "",
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
      class_names: Array.from(
        new Set(parseStringList(rawGroup?.class_names)),
      ),
    };
  });
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
      toTrimmedString(group.level_code) ?? toTrimmedString(group.level_nom) ?? "",
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
            Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
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

function buildResolvedLevels(
  selectedCodes: string[],
  customLevels: string[],
) {
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

export function normalizeInitialSetupPayload(body: unknown): InitialSetupPayload {
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
  const classesByLevel = normalizeClassGroups(raw.classes_by_level, resolvedLevels);
  const academicByLevel = normalizeAcademicGroups(raw.academic_by_level, resolvedLevels);

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
    selected_level_codes: selectedCodes,
    custom_levels: customLevels,
    classes_by_level: classesByLevel,
    academic_by_level: academicByLevel,
    create_default_departements: toBoolean(raw.create_default_departements, true),
    classes_mode: toBlockMode(raw.classes_mode, "PLUS_TARD"),
    academic_mode: toBlockMode(raw.academic_mode, "PLUS_TARD"),
    security_mode: toBlockMode(raw.security_mode, "PLUS_TARD"),
    finance_mode: toBlockMode(raw.finance_mode, "PLUS_TARD"),
    services_mode: toBlockMode(raw.services_mode, "PLUS_TARD"),
    audit_mode: toBlockMode(raw.audit_mode, "PLUS_TARD"),
  };
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
        : executionDisponible && mode !== "PLUS_TARD"
          ? "PRET"
          : "DIFFERE",
    description,
    estimation_creation: estimationCreation,
    execution_disponible: executionDisponible,
  };
}

export function resolveLevelNames(payload: InitialSetupPayload) {
  return buildResolvedLevels(payload.selected_level_codes, payload.custom_levels);
}

export function buildInitialSetupPreviewBlocks(
  payload: InitialSetupPayload,
): InitialisationPreviewBlock[] {
  const levelCount = resolveLevelNames(payload).length;
  const plannedClassCount = payload.classes_by_level.reduce(
    (sum, group) => sum + group.class_names.length,
    0,
  );
  const levelsWithClasses = payload.classes_by_level.filter(
    (group) => group.class_names.length > 0,
  ).length;
  const classesReady =
    payload.classes_mode !== "PLUS_TARD" &&
    levelCount > 0 &&
    levelsWithClasses === levelCount &&
    plannedClassCount > 0;
  const plannedAcademicSubjectCount = payload.academic_by_level.reduce(
    (sum, group) => sum + group.subjects.length,
    0,
  );
  const levelsWithAcademic = payload.academic_by_level.filter(
    (group) => group.subjects.length > 0 && group.programme_nom.trim(),
  ).length;
  const academicReady =
    payload.academic_mode !== "PLUS_TARD" &&
    levelCount > 0 &&
    levelsWithAcademic === levelCount &&
    plannedAcademicSubjectCount > 0;

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
        ? "Creation de la premiere annee scolaire operationnelle de l'etablissement."
        : "La premiere annee scolaire sera ouverte plus tard.",
      payload.create_initial_year ? 1 : 0,
      true,
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
      payload.classes_mode === "PLUS_TARD"
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
      payload.academic_mode === "PLUS_TARD"
        ? "Le referentiel academique sera renseigne dans une passe ulterieure."
        : academicReady
          ? "Creation immediate des programmes par niveau et de leurs matieres de depart."
          : "Chaque niveau doit avoir un programme et au moins une matiere avant generation.",
      academicReady ? payload.academic_by_level.length + plannedAcademicSubjectCount : 0,
      academicReady,
    ),
    buildBlock(
      "ORGANISATION",
      "Organisation",
      payload.create_default_departements ? "CREATION" : "PLUS_TARD",
      payload.create_default_departements
        ? "Creation des departements transverses de base."
        : "Les departements seront configures plus tard.",
      payload.create_default_departements ? 9 : 0,
      true,
    ),
    buildBlock(
      "SECURITE",
      "Roles et securite",
      payload.security_mode,
      "Le bloc de securite est reference dans la previsualisation. La generation assistee sera branchee dans une passe suivante.",
      0,
      false,
    ),
    buildBlock(
      "FINANCE",
      "Socle finance",
      payload.finance_mode,
      "Categories de frais, statuts et echeanciers minimaux a cadrer avec Finance.",
      0,
      false,
    ),
    buildBlock(
      "SERVICES",
      "Services annexes",
      payload.services_mode,
      "Transport, cantine et regles d'acces restent prepares mais non generes automatiquement a ce stade.",
      0,
      false,
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
