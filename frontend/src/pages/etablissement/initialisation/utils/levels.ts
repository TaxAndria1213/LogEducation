import type {
  InitialisationClassGroup,
  InitialisationLevelSelectionPreset,
  InitialisationSetupDraft,
  InitialisationTemplates,
} from "../types";

export type DraftLevelDefinition = {
  code: string;
  nom: string;
  ordre: number;
  cycle?: string;
};

const CLASS_SUFFIXES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const PRESET_TO_CYCLE: Record<InitialisationLevelSelectionPreset, string> = {
  PRESCOLAIRE: "Prescolaire",
  PRIMAIRE: "Primaire",
  COLLEGE: "College",
  LYCEE: "Lycee",
};

export const LEVEL_SELECTION_PRESETS: {
  key: InitialisationLevelSelectionPreset;
  label: string;
  description: string;
}[] = [
  {
    key: "PRESCOLAIRE",
    label: "Prescolaire",
    description: "Maternelle, petites et grandes sections pretes a l'emploi.",
  },
  {
    key: "PRIMAIRE",
    label: "Primaire",
    description: "CP a CM2 pour demarrer vite sur le socle fondamental.",
  },
  {
    key: "COLLEGE",
    label: "College",
    description: "6e a 3e avec une structure standard de cycle college.",
  },
  {
    key: "LYCEE",
    label: "Lycee",
    description: "Seconde, Premiere et Terminale en selection rapide.",
  },
];

export function parseCustomLevelNames(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function getPresetStandardLevels(
  templates: InitialisationTemplates | null,
  preset: InitialisationLevelSelectionPreset,
) {
  const cycle = PRESET_TO_CYCLE[preset];
  return (templates?.niveaux_standards ?? []).filter((level) => level.cycle === cycle);
}

export function getPresetLevelCodes(
  templates: InitialisationTemplates | null,
  preset: InitialisationLevelSelectionPreset,
) {
  return getPresetStandardLevels(templates, preset).map((level) => level.code);
}

export function getPresetLevelNames(
  templates: InitialisationTemplates | null,
  preset: InitialisationLevelSelectionPreset,
) {
  return getPresetStandardLevels(templates, preset).map((level) => level.nom);
}

export function getCombinedPresetLevelNames(
  templates: InitialisationTemplates | null,
  presets: InitialisationLevelSelectionPreset[],
) {
  const names = presets.flatMap((preset) => getPresetLevelNames(templates, preset));
  return Array.from(new Set(names));
}

export function buildSelectedLevelCodes(
  templates: InitialisationTemplates | null,
  presets: InitialisationLevelSelectionPreset[],
  manualSelectedLevelCodes: string[],
) {
  const mergedSet = new Set([
    ...presets.flatMap((preset) => getPresetLevelCodes(templates, preset)),
    ...manualSelectedLevelCodes,
  ]);

  const orderedStandardCodes = (templates?.niveaux_standards ?? [])
    .map((level) => level.code)
    .filter((code) => mergedSet.has(code));

  const nonStandardCodes = manualSelectedLevelCodes.filter(
    (code) => !orderedStandardCodes.includes(code),
  );

  return [...orderedStandardCodes, ...nonStandardCodes];
}

export function areStringArraysEqual(current: string[], next: string[]) {
  if (current.length !== next.length) return false;
  return current.every((value, index) => value === next[index]);
}

export function resolveDraftLevels(
  draft: Pick<InitialisationSetupDraft, "selected_level_codes" | "custom_levels">,
  templates: InitialisationTemplates | null,
): DraftLevelDefinition[] {
  const standardLevels = (templates?.niveaux_standards ?? [])
    .filter((level) => draft.selected_level_codes.includes(level.code))
    .map((level) => ({
      code: level.code,
      nom: level.nom,
      ordre: level.ordre,
      cycle: level.cycle,
    }));

  const customLevels = parseCustomLevelNames(draft.custom_levels).map((nom, index) => ({
    code: `CUSTOM_${index + 1}`,
    nom,
    ordre: standardLevels.length + index + 1,
    cycle: "Personnalise",
  }));

  return [...standardLevels, ...customLevels];
}

export function buildSuggestedClassName(level: DraftLevelDefinition, index: number) {
  const suffix = CLASS_SUFFIXES[index] ?? `${index + 1}`;
  return `${level.nom} ${suffix}`;
}

export function syncClassGroups(
  levels: DraftLevelDefinition[],
  currentGroups: InitialisationClassGroup[],
) {
  const groupsByCode = new Map(
    currentGroups.map((group) => [group.level_code, group] as const),
  );

  return levels.map((level) => {
    const current = groupsByCode.get(level.code);
    return {
      level_code: level.code,
      level_nom: level.nom,
      class_names:
        current?.class_names.length && Array.isArray(current.class_names)
          ? [...current.class_names]
          : [buildSuggestedClassName(level, 0)],
    };
  });
}

export function areClassGroupsEqual(
  currentGroups: InitialisationClassGroup[],
  nextGroups: InitialisationClassGroup[],
) {
  if (currentGroups.length !== nextGroups.length) return false;

  return currentGroups.every((group, index) => {
    const next = nextGroups[index];
    if (!next) return false;
    if (group.level_code !== next.level_code || group.level_nom !== next.level_nom) {
      return false;
    }
    if (group.class_names.length !== next.class_names.length) return false;
    return group.class_names.every(
      (className, classIndex) => className === next.class_names[classIndex],
    );
  });
}

export function countEnteredClasses(groups: InitialisationClassGroup[]) {
  return groups.reduce((sum, group) => {
    return (
      sum +
      group.class_names.filter((className, index, names) => {
        const normalized = className.trim();
        return (
          Boolean(normalized) &&
          names.findIndex((entry) => entry.trim() === normalized) === index
        );
      }).length
    );
  }, 0);
}
