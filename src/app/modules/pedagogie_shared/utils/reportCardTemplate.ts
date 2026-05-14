import { PrismaClient } from "@prisma/client";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function readNumber(value: unknown, fallback: number, minimum?: number) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  if (typeof minimum === "number" && parsed < minimum) {
    return minimum;
  }

  return parsed;
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function extractAcademicYearId(raw: unknown) {
  if (!isPlainObject(raw)) return null;
  return typeof raw.annee_scolaire_id === "string" && raw.annee_scolaire_id.trim()
    ? raw.annee_scolaire_id.trim()
    : null;
}

export const PEDAGOGIE_INITIALISATION_SCOPE = "PEDAGOGIE_INITIALISATION";
export const BULLETIN_DISPLAY_SNAPSHOT_SCOPE_PREFIX =
  "BULLETIN_AFFICHAGE_SNAPSHOT::";

export const REPORT_CARD_TEMPLATE_TYPES = [
  "STANDARD",
  "DETAILED",
  "ASSESSMENT_TYPE_SUMMARY",
  "FINAL_EXAM_ONLY",
  "CUSTOM",
] as const;

export type ReportCardTemplateType =
  (typeof REPORT_CARD_TEMPLATE_TYPES)[number];

export const PEDAGOGICAL_DISPLAY_MODES = [
  "SUBJECTS_ONLY",
  "SUBJECTS_AND_DOMAINS",
  "FULL_HIERARCHY",
  "COMPETENCIES_ONLY",
  "CUSTOM",
] as const;

export type PedagogicalDisplayMode =
  (typeof PEDAGOGICAL_DISPLAY_MODES)[number];

export const EVALUATION_TYPE_CODES = [
  "DEVOIR",
  "EXAMEN",
  "ORAL",
  "AUTRE",
] as const;

export type EvaluationTypeCode = (typeof EVALUATION_TYPE_CODES)[number];

export type PedagogieEvaluationTypeConfig = {
  code: EvaluationTypeCode;
  label: string;
  poids: number;
  note_max: number;
  include_in_average: boolean;
  show_in_report_card: boolean;
  is_final_exam: boolean;
};

export const NOTE_AVERAGE_METHODS = ["PONDEREE", "SIMPLE"] as const;
export type PedagogieNoteAverageMethod =
  (typeof NOTE_AVERAGE_METHODS)[number];

export const NOTE_ROUNDING_STEPS = ["0.25", "0.5", "1"] as const;
export type PedagogieNoteRoundingStep =
  (typeof NOTE_ROUNDING_STEPS)[number];

export const NOTE_MISSING_GRADE_POLICIES = [
  "IGNORE",
  "ZERO",
  "BLOCK",
] as const;
export type PedagogieMissingGradePolicy =
  (typeof NOTE_MISSING_GRADE_POLICIES)[number];

export const NOTE_RANKING_MODES = ["COMPETITION", "DENSE"] as const;
export type PedagogieRankingMode = (typeof NOTE_RANKING_MODES)[number];

export type PedagogieNoteRules = {
  moyenne: PedagogieNoteAverageMethod;
  arrondi: PedagogieNoteRoundingStep;
  absence_non_notee: boolean;
  autoriser_rattrapage: boolean;
  missing_grade_policy: PedagogieMissingGradePolicy;
  ranking_mode: PedagogieRankingMode;
  exclude_ungraded_from_ranking: boolean;
};

export type PedagogieBulletinConfig = {
  template_type: ReportCardTemplateType;
  pedagogical_display_mode: PedagogicalDisplayMode;
  description: string | null;
  calculation_mode?: "SIMPLE" | "HIERARCHICAL" | "WEIGHTED" | "COEFFICIENT_BASED";
  include_code_grades_in_general_average?: boolean;
  rounding_precision?: number;
  base_score?: number | null;
  exclude_non_evaluated_items?: boolean;
  minimum_required_results?: number;
  use_weights?: boolean;
  use_coefficients?: boolean;
  show_assessment_details: boolean;
  show_assessment_type_summary: boolean;
  show_only_final_exam: boolean;
  show_subjects: boolean;
  show_groups: boolean;
  show_domains: boolean;
  show_subdomains: boolean;
  show_competencies: boolean;
  show_objectives: boolean;
  show_only_evaluated_items: boolean;
  show_non_evaluated_items: boolean;
  non_evaluated_label: string;
  group_items_by_parent: boolean;
  show_hierarchical_indent: boolean;
  max_hierarchy_depth: number;
  show_subject_summary: boolean;
  show_domain_summary: boolean;
  show_subdomain_summary: boolean;
  show_competency_results: boolean;
  show_subject_average: boolean;
  show_class_average: boolean;
  show_subject_coefficient: boolean;
  show_subject_points: boolean;
  show_subject_rank: boolean;
  show_teacher_appreciation: boolean;
  show_general_average: boolean;
  show_general_class_average: boolean;
  show_code_legend: boolean;
  show_section_headers?: boolean;
  show_total_coefficients: boolean;
  show_total_points: boolean;
  show_general_rank: boolean;
  show_mention: boolean;
  show_decision: boolean;
  show_general_appreciation: boolean;
  show_absences: boolean;
  show_late_count: boolean;
  show_logo: boolean;
  show_signature: boolean;
  publier_par_defaut: boolean;
};

export type PedagogieInitialisationConfig = {
  mode_initialisation: "RAPIDE" | "AVANCE";
  default_teacher_id: string | null;
  teacher_assignments: Record<string, Record<string, string>>;
  evaluation_types: PedagogieEvaluationTypeConfig[];
  note_rules: PedagogieNoteRules;
  bulletin_config: PedagogieBulletinConfig;
};

export const DEFAULT_EVALUATION_TYPES: PedagogieEvaluationTypeConfig[] = [
  {
    code: "DEVOIR",
    label: "Devoir",
    poids: 1,
    note_max: 20,
    include_in_average: true,
    show_in_report_card: false,
    is_final_exam: false,
  },
  {
    code: "EXAMEN",
    label: "Composition",
    poids: 2,
    note_max: 20,
    include_in_average: true,
    show_in_report_card: true,
    is_final_exam: true,
  },
  {
    code: "ORAL",
    label: "Oral / participation",
    poids: 1,
    note_max: 20,
    include_in_average: true,
    show_in_report_card: false,
    is_final_exam: false,
  },
];

export const DEFAULT_BULLETIN_CONFIG: PedagogieBulletinConfig = {
  template_type: "STANDARD",
  pedagogical_display_mode: "SUBJECTS_ONLY",
  description: null,
  calculation_mode: "HIERARCHICAL",
  include_code_grades_in_general_average: false,
  rounding_precision: 2,
  base_score: null,
  exclude_non_evaluated_items: true,
  minimum_required_results: 1,
  use_weights: true,
  use_coefficients: true,
  show_assessment_details: false,
  show_assessment_type_summary: false,
  show_only_final_exam: false,
  show_subjects: true,
  show_groups: false,
  show_domains: false,
  show_subdomains: false,
  show_competencies: false,
  show_objectives: false,
  show_only_evaluated_items: false,
  show_non_evaluated_items: true,
  non_evaluated_label: "Non evalue",
  group_items_by_parent: true,
  show_hierarchical_indent: true,
  max_hierarchy_depth: 4,
  show_subject_summary: true,
  show_domain_summary: false,
  show_subdomain_summary: false,
  show_competency_results: true,
  show_subject_average: true,
  show_class_average: true,
  show_subject_coefficient: true,
  show_subject_points: false,
  show_subject_rank: true,
  show_teacher_appreciation: true,
  show_general_average: true,
  show_general_class_average: false,
  show_code_legend: false,
  show_section_headers: true,
  show_total_coefficients: true,
  show_total_points: false,
  show_general_rank: true,
  show_mention: true,
  show_decision: true,
  show_general_appreciation: true,
  show_absences: false,
  show_late_count: false,
  show_logo: true,
  show_signature: true,
  publier_par_defaut: false,
};

export const DEFAULT_NOTE_RULES: PedagogieNoteRules = {
  moyenne: "PONDEREE",
  arrondi: "0.25",
  absence_non_notee: true,
  autoriser_rattrapage: true,
  missing_grade_policy: "IGNORE",
  ranking_mode: "COMPETITION",
  exclude_ungraded_from_ranking: true,
};

export function normalizeReportCardTemplateType(
  value: unknown,
): ReportCardTemplateType {
  return REPORT_CARD_TEMPLATE_TYPES.includes(value as ReportCardTemplateType)
    ? (value as ReportCardTemplateType)
    : "STANDARD";
}

export function normalizePedagogicalDisplayMode(
  value: unknown,
): PedagogicalDisplayMode {
  return PEDAGOGICAL_DISPLAY_MODES.includes(value as PedagogicalDisplayMode)
    ? (value as PedagogicalDisplayMode)
    : DEFAULT_BULLETIN_CONFIG.pedagogical_display_mode;
}

export function normalizeEvaluationTypeCode(value: unknown): EvaluationTypeCode {
  return EVALUATION_TYPE_CODES.includes(value as EvaluationTypeCode)
    ? (value as EvaluationTypeCode)
    : "DEVOIR";
}

export function normalizePedagogieNoteRules(
  raw: unknown,
): PedagogieNoteRules {
  const source = isPlainObject(raw) ? raw : {};

  return {
    moyenne:
      source.moyenne === "SIMPLE"
        ? "SIMPLE"
        : DEFAULT_NOTE_RULES.moyenne,
    arrondi: NOTE_ROUNDING_STEPS.includes(
      source.arrondi as PedagogieNoteRoundingStep,
    )
      ? (source.arrondi as PedagogieNoteRoundingStep)
      : DEFAULT_NOTE_RULES.arrondi,
    absence_non_notee: readBoolean(
      source.absence_non_notee,
      DEFAULT_NOTE_RULES.absence_non_notee,
    ),
    autoriser_rattrapage: readBoolean(
      source.autoriser_rattrapage,
      DEFAULT_NOTE_RULES.autoriser_rattrapage,
    ),
    missing_grade_policy: NOTE_MISSING_GRADE_POLICIES.includes(
      source.missing_grade_policy as PedagogieMissingGradePolicy,
    )
      ? (source.missing_grade_policy as PedagogieMissingGradePolicy)
      : DEFAULT_NOTE_RULES.missing_grade_policy,
    ranking_mode: NOTE_RANKING_MODES.includes(
      source.ranking_mode as PedagogieRankingMode,
    )
      ? (source.ranking_mode as PedagogieRankingMode)
      : DEFAULT_NOTE_RULES.ranking_mode,
    exclude_ungraded_from_ranking: readBoolean(
      source.exclude_ungraded_from_ranking,
      DEFAULT_NOTE_RULES.exclude_ungraded_from_ranking,
    ),
  };
}

export function normalizeBulletinConfig(
  raw: unknown,
): PedagogieBulletinConfig {
  const source = isPlainObject(raw) ? raw : {};
  const templateType = normalizeReportCardTemplateType(source.template_type);
  const calculationMode =
    source.calculation_mode === "SIMPLE" ||
    source.calculation_mode === "WEIGHTED" ||
    source.calculation_mode === "COEFFICIENT_BASED"
      ? source.calculation_mode
      : "HIERARCHICAL";

  const config: PedagogieBulletinConfig = {
    template_type: templateType,
    pedagogical_display_mode: normalizePedagogicalDisplayMode(
      source.pedagogical_display_mode,
    ),
    description: readString(source.description) || null,
    calculation_mode: calculationMode,
    include_code_grades_in_general_average: readBoolean(
      source.include_code_grades_in_general_average,
      DEFAULT_BULLETIN_CONFIG.include_code_grades_in_general_average ?? false,
    ),
    rounding_precision: readNumber(
      source.rounding_precision,
      DEFAULT_BULLETIN_CONFIG.rounding_precision ?? 2,
      0,
    ),
    base_score:
      source.base_score === null
        ? null
        : readNumber(source.base_score, DEFAULT_BULLETIN_CONFIG.base_score ?? 0, 0) ||
          null,
    exclude_non_evaluated_items: readBoolean(
      source.exclude_non_evaluated_items,
      DEFAULT_BULLETIN_CONFIG.exclude_non_evaluated_items ?? true,
    ),
    minimum_required_results: Math.trunc(
      readNumber(
        source.minimum_required_results,
        DEFAULT_BULLETIN_CONFIG.minimum_required_results ?? 1,
        1,
      ),
    ),
    use_weights: readBoolean(
      source.use_weights,
      DEFAULT_BULLETIN_CONFIG.use_weights ?? true,
    ),
    use_coefficients: readBoolean(
      source.use_coefficients,
      DEFAULT_BULLETIN_CONFIG.use_coefficients ?? true,
    ),
    show_assessment_details: readBoolean(
      source.show_assessment_details,
      DEFAULT_BULLETIN_CONFIG.show_assessment_details,
    ),
    show_assessment_type_summary: readBoolean(
      source.show_assessment_type_summary,
      DEFAULT_BULLETIN_CONFIG.show_assessment_type_summary,
    ),
    show_only_final_exam: readBoolean(
      source.show_only_final_exam,
      DEFAULT_BULLETIN_CONFIG.show_only_final_exam,
    ),
    show_subjects: readBoolean(
      source.show_subjects,
      DEFAULT_BULLETIN_CONFIG.show_subjects,
    ),
    show_groups: readBoolean(
      source.show_groups,
      DEFAULT_BULLETIN_CONFIG.show_groups,
    ),
    show_domains: readBoolean(
      source.show_domains,
      DEFAULT_BULLETIN_CONFIG.show_domains,
    ),
    show_subdomains: readBoolean(
      source.show_subdomains,
      DEFAULT_BULLETIN_CONFIG.show_subdomains,
    ),
    show_competencies: readBoolean(
      source.show_competencies,
      DEFAULT_BULLETIN_CONFIG.show_competencies,
    ),
    show_objectives: readBoolean(
      source.show_objectives,
      DEFAULT_BULLETIN_CONFIG.show_objectives,
    ),
    show_only_evaluated_items: readBoolean(
      source.show_only_evaluated_items,
      DEFAULT_BULLETIN_CONFIG.show_only_evaluated_items,
    ),
    show_non_evaluated_items: readBoolean(
      source.show_non_evaluated_items,
      DEFAULT_BULLETIN_CONFIG.show_non_evaluated_items,
    ),
    non_evaluated_label: readString(
      source.non_evaluated_label,
      DEFAULT_BULLETIN_CONFIG.non_evaluated_label,
    ),
    group_items_by_parent: readBoolean(
      source.group_items_by_parent,
      DEFAULT_BULLETIN_CONFIG.group_items_by_parent,
    ),
    show_hierarchical_indent: readBoolean(
      source.show_hierarchical_indent,
      DEFAULT_BULLETIN_CONFIG.show_hierarchical_indent,
    ),
    max_hierarchy_depth: readNumber(
      source.max_hierarchy_depth,
      DEFAULT_BULLETIN_CONFIG.max_hierarchy_depth,
      1,
    ),
    show_subject_summary: readBoolean(
      source.show_subject_summary,
      DEFAULT_BULLETIN_CONFIG.show_subject_summary,
    ),
    show_domain_summary: readBoolean(
      source.show_domain_summary,
      DEFAULT_BULLETIN_CONFIG.show_domain_summary,
    ),
    show_subdomain_summary: readBoolean(
      source.show_subdomain_summary,
      DEFAULT_BULLETIN_CONFIG.show_subdomain_summary,
    ),
    show_competency_results: readBoolean(
      source.show_competency_results,
      DEFAULT_BULLETIN_CONFIG.show_competency_results,
    ),
    show_subject_average: readBoolean(
      source.show_subject_average,
      DEFAULT_BULLETIN_CONFIG.show_subject_average,
    ),
    show_class_average: readBoolean(
      source.show_class_average,
      DEFAULT_BULLETIN_CONFIG.show_class_average,
    ),
    show_subject_coefficient: readBoolean(
      source.show_subject_coefficient,
      DEFAULT_BULLETIN_CONFIG.show_subject_coefficient,
    ),
    show_subject_points: readBoolean(
      source.show_subject_points,
      DEFAULT_BULLETIN_CONFIG.show_subject_points,
    ),
    show_subject_rank: readBoolean(
      source.show_subject_rank,
      DEFAULT_BULLETIN_CONFIG.show_subject_rank,
    ),
    show_teacher_appreciation: readBoolean(
      source.show_teacher_appreciation,
      DEFAULT_BULLETIN_CONFIG.show_teacher_appreciation,
    ),
    show_general_average: readBoolean(
      source.show_general_average,
      DEFAULT_BULLETIN_CONFIG.show_general_average,
    ),
    show_general_class_average: readBoolean(
      source.show_general_class_average,
      DEFAULT_BULLETIN_CONFIG.show_general_class_average,
    ),
    show_code_legend: readBoolean(
      source.show_code_legend,
      DEFAULT_BULLETIN_CONFIG.show_code_legend,
    ),
    show_section_headers: readBoolean(
      source.show_section_headers,
      DEFAULT_BULLETIN_CONFIG.show_section_headers ?? true,
    ),
    show_total_coefficients: readBoolean(
      source.show_total_coefficients,
      DEFAULT_BULLETIN_CONFIG.show_total_coefficients,
    ),
    show_total_points: readBoolean(
      source.show_total_points,
      DEFAULT_BULLETIN_CONFIG.show_total_points,
    ),
    show_general_rank: readBoolean(
      source.show_general_rank,
      DEFAULT_BULLETIN_CONFIG.show_general_rank,
    ),
    show_mention: readBoolean(
      source.show_mention,
      DEFAULT_BULLETIN_CONFIG.show_mention,
    ),
    show_decision: readBoolean(
      source.show_decision,
      DEFAULT_BULLETIN_CONFIG.show_decision,
    ),
    show_general_appreciation: readBoolean(
      source.show_general_appreciation,
      DEFAULT_BULLETIN_CONFIG.show_general_appreciation,
    ),
    show_absences: readBoolean(
      source.show_absences,
      DEFAULT_BULLETIN_CONFIG.show_absences,
    ),
    show_late_count: readBoolean(
      source.show_late_count,
      DEFAULT_BULLETIN_CONFIG.show_late_count,
    ),
    show_logo: readBoolean(source.show_logo, DEFAULT_BULLETIN_CONFIG.show_logo),
    show_signature: readBoolean(
      source.show_signature,
      DEFAULT_BULLETIN_CONFIG.show_signature,
    ),
    publier_par_defaut: readBoolean(
      source.publier_par_defaut,
      DEFAULT_BULLETIN_CONFIG.publier_par_defaut,
    ),
  };

  if (config.pedagogical_display_mode === "SUBJECTS_AND_DOMAINS") {
    config.show_subjects = true;
    config.show_groups = true;
    config.show_domains = true;
    config.max_hierarchy_depth = Math.min(config.max_hierarchy_depth, 2);
  }

  if (config.pedagogical_display_mode === "FULL_HIERARCHY") {
    config.show_subjects = true;
    config.show_groups = true;
    config.show_domains = true;
    config.show_subdomains = true;
    config.show_competencies = true;
    config.show_objectives = true;
    config.max_hierarchy_depth = Math.max(config.max_hierarchy_depth, 5);
  }

  if (config.pedagogical_display_mode === "COMPETENCIES_ONLY") {
    config.show_subjects = false;
    config.show_groups = false;
    config.show_domains = false;
    config.show_subdomains = false;
    config.show_competencies = true;
    config.show_objectives = true;
    config.max_hierarchy_depth = Math.max(config.max_hierarchy_depth, 5);
  }

  if (config.show_only_final_exam) {
    config.show_assessment_details = true;
    config.show_assessment_type_summary = false;
  }

  if (config.show_assessment_type_summary) {
    config.show_assessment_details = false;
  }

  return config;
}

export function normalizeEvaluationTypes(
  raw: unknown,
): PedagogieEvaluationTypeConfig[] {
  if (!Array.isArray(raw)) {
    return [...DEFAULT_EVALUATION_TYPES];
  }

  const normalized = raw
    .filter((item) => isPlainObject(item))
    .map((item) => {
      const code = normalizeEvaluationTypeCode(item.code);
      const fallback = DEFAULT_EVALUATION_TYPES.find(
        (candidate) => candidate.code === code,
      );

      return {
        code,
        label: readString(item.label, fallback?.label ?? "Evaluation"),
        poids: readNumber(item.poids, fallback?.poids ?? 1, 0.1),
        note_max: readNumber(item.note_max, fallback?.note_max ?? 20, 1),
        include_in_average: readBoolean(
          item.include_in_average,
          fallback?.include_in_average ?? true,
        ),
        show_in_report_card: readBoolean(
          item.show_in_report_card,
          fallback?.show_in_report_card ?? code === "EXAMEN",
        ),
        is_final_exam: readBoolean(
          item.is_final_exam,
          fallback?.is_final_exam ?? code === "EXAMEN",
        ),
      } satisfies PedagogieEvaluationTypeConfig;
    });

  if (normalized.length === 0) {
    return [...DEFAULT_EVALUATION_TYPES];
  }

  const uniqueByCode = new Map<EvaluationTypeCode, PedagogieEvaluationTypeConfig>();
  normalized.forEach((item) => {
    uniqueByCode.set(item.code, item);
  });

  DEFAULT_EVALUATION_TYPES.forEach((defaultItem) => {
    if (!uniqueByCode.has(defaultItem.code)) {
      uniqueByCode.set(defaultItem.code, defaultItem);
    }
  });

  return [...uniqueByCode.values()];
}

export function normalizePedagogieInitialisationConfig(
  raw: unknown,
): PedagogieInitialisationConfig {
  const source = isPlainObject(raw) ? raw : {};

  return {
    mode_initialisation: source.mode_initialisation === "AVANCE" ? "AVANCE" : "RAPIDE",
    default_teacher_id: readString(source.default_teacher_id) || null,
    teacher_assignments: isPlainObject(source.teacher_assignments)
      ? (source.teacher_assignments as Record<string, Record<string, string>>)
      : {},
    evaluation_types: normalizeEvaluationTypes(source.evaluation_types),
    note_rules: normalizePedagogieNoteRules(source.note_rules),
    bulletin_config: normalizeBulletinConfig(source.bulletin_config),
  };
}

export function normalizeBulletinConfigFromTemplateRecord(raw: unknown) {
  if (!isPlainObject(raw)) {
    return { ...DEFAULT_BULLETIN_CONFIG };
  }

  return normalizeBulletinConfig({
    template_type: raw.template_type,
    pedagogical_display_mode: raw.pedagogical_display_mode,
    description: raw.description,
    calculation_mode: raw.calculation_mode,
    include_code_grades_in_general_average:
      raw.include_code_grades_in_general_average,
    rounding_precision: raw.rounding_precision,
    base_score: raw.base_score,
    exclude_non_evaluated_items: raw.exclude_non_evaluated_items,
    minimum_required_results: raw.minimum_required_results,
    use_weights: raw.use_weights,
    use_coefficients: raw.use_coefficients,
    show_assessment_details: raw.show_assessment_details,
    show_assessment_type_summary: raw.show_assessment_type_summary,
    show_only_final_exam: raw.show_only_final_exam,
    show_subjects: raw.show_subjects,
    show_groups: raw.show_groups,
    show_domains: raw.show_domains,
    show_subdomains: raw.show_subdomains,
    show_competencies: raw.show_competencies,
    show_objectives: raw.show_objectives,
    show_only_evaluated_items: raw.show_only_evaluated_items,
    show_non_evaluated_items: raw.show_non_evaluated_items,
    non_evaluated_label: raw.non_evaluated_label,
    group_items_by_parent: raw.group_items_by_parent,
    show_hierarchical_indent: raw.show_hierarchical_indent,
    max_hierarchy_depth: raw.max_hierarchy_depth,
    show_subject_summary: raw.show_subject_summary,
    show_domain_summary: raw.show_domain_summary,
    show_subdomain_summary: raw.show_subdomain_summary,
    show_competency_results: raw.show_competency_results,
    show_subject_average:
      raw.show_subject_average ?? raw.show_student_average,
    show_class_average: raw.show_class_average,
    show_subject_coefficient: raw.show_subject_coefficient,
    show_subject_points: raw.show_subject_points,
    show_subject_rank: raw.show_subject_rank,
    show_teacher_appreciation: raw.show_teacher_appreciation,
    show_general_average:
      raw.show_general_average ?? raw.show_general_student_average,
    show_general_class_average: raw.show_general_class_average,
    show_code_legend: raw.show_code_legend,
    show_section_headers: raw.show_section_headers,
    show_total_coefficients: raw.show_total_coefficients,
    show_total_points: raw.show_total_points,
    show_general_rank: raw.show_general_rank,
    show_mention: raw.show_mention,
    show_decision: raw.show_decision,
    show_general_appreciation: raw.show_general_appreciation,
    show_absences: raw.show_absences,
    show_late_count: raw.show_late_count,
    show_logo: raw.show_logo,
    show_signature: raw.show_signature,
  });
}

export function getBulletinDisplaySnapshotScope(bulletinId: string) {
  return `${BULLETIN_DISPLAY_SNAPSHOT_SCOPE_PREFIX}${bulletinId}`;
}

export async function loadPedagogieInitialisationConfig(
  prisma: PrismaClient,
  etablissementId: string,
  academicYearId: string,
) {
  const records = await prisma.regleNote.findMany({
    where: {
      etablissement_id: etablissementId,
      scope: PEDAGOGIE_INITIALISATION_SCOPE,
    },
    orderBy: [{ updated_at: "desc" }, { created_at: "desc" }],
  });

  const record =
    records.find((item) => extractAcademicYearId(item.regle_json) === academicYearId) ??
    null;
  const templateRecord = await prisma.reportCardTemplate.findFirst({
    where: {
      etablissement_id: etablissementId,
      annee_scolaire_id: academicYearId,
      is_default: true,
      is_active: true,
    },
    orderBy: [{ updated_at: "desc" }, { created_at: "desc" }],
  });
  const config = normalizePedagogieInitialisationConfig(record?.regle_json ?? {});

  if (templateRecord) {
    config.bulletin_config = normalizeBulletinConfigFromTemplateRecord(
      templateRecord as unknown as Record<string, unknown>,
    );
  }

  return {
    record,
    templateRecord,
    config,
  };
}
