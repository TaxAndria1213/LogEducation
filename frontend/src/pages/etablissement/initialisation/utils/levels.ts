import type {
  InitialisationClassGroup,
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

export function parseCustomLevelNames(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((entry) => entry.trim())
    .filter(Boolean);
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
    return group.class_names.every((className, classIndex) => className === next.class_names[classIndex]);
  });
}

export function countEnteredClasses(groups: InitialisationClassGroup[]) {
  return groups.reduce((sum, group) => {
    return (
      sum +
      group.class_names.filter((className, index, names) => {
        const normalized = className.trim();
        return Boolean(normalized) && names.findIndex((entry) => entry.trim() === normalized) === index;
      }).length
    );
  }, 0);
}
