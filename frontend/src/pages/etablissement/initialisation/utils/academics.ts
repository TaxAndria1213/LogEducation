import type {
  InitialisationAcademicGroup,
  InitialisationAcademicSubject,
} from "../types";
import type { DraftLevelDefinition } from "./levels";

export function buildSuggestedProgrammeName(level: DraftLevelDefinition) {
  return `Programme ${level.nom}`;
}

export function buildEmptyAcademicSubject(): InitialisationAcademicSubject {
  return {
    nom: "",
    code: "",
    heures_semaine: "",
    coefficient: "",
  };
}

export function syncAcademicGroups(
  levels: DraftLevelDefinition[],
  currentGroups: InitialisationAcademicGroup[],
) {
  const groupsByCode = new Map(
    currentGroups.map((group) => [group.level_code, group] as const),
  );

  return levels.map((level) => {
    const current = groupsByCode.get(level.code);
    return {
      level_code: level.code,
      level_nom: level.nom,
      programme_nom: current?.programme_nom?.trim()
        ? current.programme_nom
        : buildSuggestedProgrammeName(level),
      subjects:
        current?.subjects.length && Array.isArray(current.subjects)
          ? current.subjects.map((subject) => ({ ...subject }))
          : [buildEmptyAcademicSubject()],
    };
  });
}

export function areAcademicGroupsEqual(
  currentGroups: InitialisationAcademicGroup[],
  nextGroups: InitialisationAcademicGroup[],
) {
  if (currentGroups.length !== nextGroups.length) return false;

  return currentGroups.every((group, index) => {
    const next = nextGroups[index];
    if (!next) return false;
    if (
      group.level_code !== next.level_code ||
      group.level_nom !== next.level_nom ||
      group.programme_nom !== next.programme_nom
    ) {
      return false;
    }
    if (group.subjects.length !== next.subjects.length) return false;
    return group.subjects.every((subject, subjectIndex) => {
      const nextSubject = next.subjects[subjectIndex];
      if (!nextSubject) return false;
      return (
        subject.nom === nextSubject.nom &&
        subject.code === nextSubject.code &&
        subject.heures_semaine === nextSubject.heures_semaine &&
        subject.coefficient === nextSubject.coefficient
      );
    });
  });
}

export function countEnteredAcademicSubjects(groups: InitialisationAcademicGroup[]) {
  return groups.reduce((sum, group) => {
    return (
      sum +
      group.subjects.filter((subject) => subject.nom.trim()).length
    );
  }, 0);
}
