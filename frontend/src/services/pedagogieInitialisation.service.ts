import { Http } from "../app/api/Http";

export type ReportCardTemplateType =
  | "STANDARD"
  | "DETAILED"
  | "ASSESSMENT_TYPE_SUMMARY"
  | "FINAL_EXAM_ONLY"
  | "CUSTOM";

export type PedagogieNoteAverageMethod = "PONDEREE" | "SIMPLE";
export type PedagogieNoteRoundingStep = "0.25" | "0.5" | "1";
export type PedagogieMissingGradePolicy = "IGNORE" | "ZERO" | "BLOCK";
export type PedagogieRankingMode = "COMPETITION" | "DENSE";

export type PedagogieNoteRules = {
  moyenne: PedagogieNoteAverageMethod;
  arrondi: PedagogieNoteRoundingStep;
  absence_non_notee: boolean;
  autoriser_rattrapage: boolean;
  missing_grade_policy: PedagogieMissingGradePolicy;
  ranking_mode: PedagogieRankingMode;
  exclude_ungraded_from_ranking: boolean;
};

export type PedagogieEvaluationTypeConfig = {
  code: "DEVOIR" | "EXAMEN" | "ORAL" | "AUTRE";
  label: string;
  poids: number;
  note_max: number;
  include_in_average: boolean;
  show_in_report_card: boolean;
  is_final_exam: boolean;
};

export type PedagogieBulletinConfig = {
  template_type: ReportCardTemplateType;
  description?: string | null;
  show_assessment_details: boolean;
  show_assessment_type_summary: boolean;
  show_only_final_exam: boolean;
  show_subject_average: boolean;
  show_subject_coefficient: boolean;
  show_subject_points: boolean;
  show_subject_rank: boolean;
  show_teacher_appreciation: boolean;
  show_general_average: boolean;
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

export type PedagogieInitialisationConfigRecord = {
  id: string;
  etablissement_id: string;
  scope: string | null;
  regle_json: Record<string, unknown>;
  created_at?: string | Date;
  updated_at?: string | Date;
};

export type PedagogieInitialisationConfigResponse = {
  active_year_id: string | null;
  config: PedagogieInitialisationConfigRecord | null;
};

export type SavePedagogieInitialisationConfigPayload = {
  etablissement_id: string;
  annee_scolaire_id?: string | null;
  mode_initialisation: "RAPIDE" | "AVANCE";
  default_teacher_id?: string | null;
  teacher_assignments?: Record<string, Record<string, string>>;
  evaluation_types?: PedagogieEvaluationTypeConfig[];
  note_rules?: PedagogieNoteRules;
  bulletin_config?: PedagogieBulletinConfig;
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizePedagogieNoteRules(raw: unknown): PedagogieNoteRules {
  const source = isPlainObject(raw) ? raw : {};

  return {
    moyenne: source.moyenne === "SIMPLE" ? "SIMPLE" : DEFAULT_NOTE_RULES.moyenne,
    arrondi:
      source.arrondi === "0.5" || source.arrondi === "1"
        ? (source.arrondi as PedagogieNoteRoundingStep)
        : DEFAULT_NOTE_RULES.arrondi,
    absence_non_notee:
      typeof source.absence_non_notee === "boolean"
        ? source.absence_non_notee
        : DEFAULT_NOTE_RULES.absence_non_notee,
    autoriser_rattrapage:
      typeof source.autoriser_rattrapage === "boolean"
        ? source.autoriser_rattrapage
        : DEFAULT_NOTE_RULES.autoriser_rattrapage,
    missing_grade_policy:
      source.missing_grade_policy === "ZERO" || source.missing_grade_policy === "BLOCK"
        ? (source.missing_grade_policy as PedagogieMissingGradePolicy)
        : DEFAULT_NOTE_RULES.missing_grade_policy,
    ranking_mode:
      source.ranking_mode === "DENSE"
        ? "DENSE"
        : DEFAULT_NOTE_RULES.ranking_mode,
    exclude_ungraded_from_ranking:
      typeof source.exclude_ungraded_from_ranking === "boolean"
        ? source.exclude_ungraded_from_ranking
        : DEFAULT_NOTE_RULES.exclude_ungraded_from_ranking,
  };
}

class PedagogieInitialisationService {
  private readonly url = "initialisation-pedagogique";

  async getConfig(etablissementId: string, anneeScolaireId?: string | null) {
    return Http.get(`/api/${this.url}/config`, {
      etablissement_id: etablissementId,
      ...(anneeScolaireId ? { annee_scolaire_id: anneeScolaireId } : {}),
    });
  }

  async saveConfig(payload: SavePedagogieInitialisationConfigPayload) {
    return Http.put(`/api/${this.url}/config`, payload);
  }
}

export default new PedagogieInitialisationService();
