import {
  DEFAULT_NOTE_RULES,
  normalizePedagogieNoteRules,
  type PedagogieInitialisationConfigRecord,
  type PedagogieNoteRules,
  type SavePedagogieInitialisationConfigPayload,
} from "../../../services/pedagogieInitialisation.service";

export type NoteRulesDraft = PedagogieNoteRules;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTeacherAssignmentsRecord(
  value: unknown,
): value is Record<string, Record<string, string>> {
  if (!isPlainObject(value)) return false;

  return Object.values(value).every(
    (assignment) =>
      isPlainObject(assignment) &&
      Object.values(assignment).every((teacherId) => typeof teacherId === "string"),
  );
}

export function readPersistedNoteRules(
  configRecord?: PedagogieInitialisationConfigRecord | null,
): NoteRulesDraft {
  const regleJson = isPlainObject(configRecord?.regle_json)
    ? configRecord.regle_json
    : null;
  const noteRules =
    regleJson && isPlainObject(regleJson.note_rules) ? regleJson.note_rules : null;

  return normalizePedagogieNoteRules(noteRules);
}

export function buildNoteRulesSavePayload(args: {
  etablissementId: string;
  existingConfig?: PedagogieInitialisationConfigRecord | null;
  noteRules: NoteRulesDraft;
}): SavePedagogieInitialisationConfigPayload {
  const regleJson = isPlainObject(args.existingConfig?.regle_json)
    ? args.existingConfig.regle_json
    : {};

  return {
    etablissement_id: args.etablissementId,
    annee_scolaire_id:
      typeof regleJson.annee_scolaire_id === "string"
        ? regleJson.annee_scolaire_id
        : null,
    mode_initialisation:
      regleJson.mode_initialisation === "RAPIDE" ? "RAPIDE" : "AVANCE",
    default_teacher_id:
      typeof regleJson.default_teacher_id === "string"
        ? regleJson.default_teacher_id
        : null,
    teacher_assignments: isTeacherAssignmentsRecord(regleJson.teacher_assignments)
      ? regleJson.teacher_assignments
      : {},
    evaluation_types: Array.isArray(regleJson.evaluation_types)
      ? regleJson.evaluation_types
      : [],
    note_rules: args.noteRules,
    bulletin_config: isPlainObject(regleJson.bulletin_config)
      ? (regleJson.bulletin_config as SavePedagogieInitialisationConfigPayload["bulletin_config"])
      : undefined,
  };
}

export function getNoteRulesSummaryLabel(noteRules: NoteRulesDraft) {
  const moyenne =
    noteRules.moyenne === "SIMPLE" ? "Moyenne simple" : "Moyenne ponderee";
  const arrondi = `arrondi ${noteRules.arrondi}`;
  const notesManquantes =
    noteRules.missing_grade_policy === "ZERO"
      ? "note manquante = 0"
      : noteRules.missing_grade_policy === "BLOCK"
        ? "note manquante bloquante"
        : "note manquante ignoree";
  const classement =
    noteRules.ranking_mode === "DENSE" ? "rang dense" : "rang competition";

  return [moyenne, arrondi, notesManquantes, classement].join(" | ");
}

export { DEFAULT_NOTE_RULES };
