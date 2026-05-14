import { Http } from "../app/api/Http";
import Service from "../app/api/Service";
import type {
  Bulletin,
  BulletinCodeLegend,
  BulletinLigne,
  BulletinLigneDetail,
  Classe,
  Periode,
} from "../types/models";
import type { MatiereWithRelations } from "./matiere.service";
import { getEleveDisplayLabel, type EleveWithRelations } from "./note.service";

type QueryParams = Record<string, unknown>;
type ReportAverageCalculationModeValue =
  | "SIMPLE"
  | "HIERARCHICAL"
  | "WEIGHTED"
  | "COEFFICIENT_BASED";

export type BulletinLineWithRelations = BulletinLigne & {
  matiere?: MatiereWithRelations | null;
  details?: BulletinLigneDetail[];
};

export type BulletinDisplayColumn = {
  key: string;
  label: string;
};

export type BulletinDisplayLine = {
  row_type?: "data" | "section_header";
  row_id: string;
  matiere_id: string;
  matiere_nom: string;
  pedagogical_item_id?: string | null;
  item_type?: string | null;
  grading_mode?: string | null;
  section_id?: string | null;
  section_title?: string | null;
  section_type?: string | null;
  depth?: number;
  is_summary_line?: boolean;
  moyenne: number | null;
  class_average?: number | null;
  coefficient: number | null;
  points: number | null;
  rang: number | null;
  appreciation: string | null;
  assessment_details?: Array<{
    evaluation_id: string;
    pedagogical_item_id: string | null;
    title: string;
    type: string;
    type_label: string;
    display_value: string | null;
    status: string;
    score: number | null;
    max_score: number;
    normalized_score: number | null;
    weight: number;
    include_in_average: boolean;
    visible_in_report_card: boolean;
    is_final_exam: boolean;
    is_published: boolean;
  }>;
  display_cells: Record<string, string>;
};

export type BulletinDisplaySnapshot = {
  template_id?: string | null;
  template: {
    template_type: "STANDARD" | "DETAILED" | "ASSESSMENT_TYPE_SUMMARY" | "FINAL_EXAM_ONLY" | "CUSTOM";
    pedagogical_display_mode?: "SUBJECTS_ONLY" | "SUBJECTS_AND_DOMAINS" | "FULL_HIERARCHY" | "COMPETENCIES_ONLY" | "CUSTOM";
    calculation_mode?: ReportAverageCalculationModeValue;
    include_code_grades_in_general_average?: boolean;
    rounding_precision?: number;
    base_score?: number | null;
    exclude_non_evaluated_items?: boolean;
    minimum_required_results?: number;
    use_weights?: boolean;
    use_coefficients?: boolean;
    show_assessment_details?: boolean;
    show_assessment_type_summary?: boolean;
    show_only_final_exam?: boolean;
    show_subjects?: boolean;
    show_groups?: boolean;
    show_domains?: boolean;
    show_subdomains?: boolean;
    show_competencies?: boolean;
    show_objectives?: boolean;
    show_only_evaluated_items?: boolean;
    show_non_evaluated_items?: boolean;
    non_evaluated_label?: string;
    group_items_by_parent?: boolean;
    show_hierarchical_indent?: boolean;
    max_hierarchy_depth?: number;
    show_subject_summary?: boolean;
    show_domain_summary?: boolean;
    show_subdomain_summary?: boolean;
    show_competency_results?: boolean;
    show_student_average?: boolean;
    show_absences: boolean;
    show_late_count: boolean;
    show_subject_average?: boolean;
    show_class_average?: boolean;
    show_subject_coefficient?: boolean;
    show_subject_points?: boolean;
    show_subject_rank?: boolean;
    show_teacher_appreciation?: boolean;
    show_general_average: boolean;
    show_general_student_average?: boolean;
    show_general_class_average?: boolean;
    show_code_legend?: boolean;
    show_section_headers?: boolean;
    show_total_coefficients: boolean;
    show_total_points: boolean;
    show_general_rank: boolean;
    show_mention: boolean;
    show_decision: boolean;
    show_general_appreciation: boolean;
    show_logo: boolean;
    show_signature: boolean;
  };
  branding?: {
    etablissement_name: string | null;
    logo_url: string | null;
  };
  columns: BulletinDisplayColumn[];
  lines: BulletinDisplayLine[];
  summary: {
    general_average: number | null;
    general_class_average?: number | null;
    total_coefficients: number;
    total_points: number;
    rank: number | null;
    mention: string | null;
    decision: string | null;
    general_appreciation: string | null;
    absence_count: number | null;
    late_count: number | null;
  };
  code_legend?: Array<{
    grading_scale_id: string | null;
    code: string;
    label: string;
    numeric_value: number | null;
    display_order: number;
    color?: string | null;
  }>;
  warnings: string[];
  generated_at: string;
};

export type BulletinWithRelations = Bulletin & {
  eleve?: EleveWithRelations | null;
  periode?: Pick<Periode, "id" | "nom" | "date_debut" | "date_fin" | "ordre"> | null;
  classe?: (Pick<Classe, "id" | "nom" | "annee_scolaire_id"> & {
    niveau?: {
      id: string;
      nom: string;
    } | null;
    site?: {
      id: string;
      nom: string;
    } | null;
  }) | null;
  lignes?: BulletinLineWithRelations[];
  codeLegends?: BulletinCodeLegend[];
  affichage_bulletin?: BulletinDisplaySnapshot | null;
};

function parseObjectParam(value: unknown): Record<string, unknown> | undefined {
  if (!value) return undefined;

  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      return typeof parsed === "object" && parsed !== null ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function readNumericValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export function getBulletinAverage(lines?: BulletinLineWithRelations[] | null) {
  if (!lines || lines.length === 0) return null;

  const valid = lines.filter((line) => typeof line.moyenne === "number");
  if (valid.length === 0) return null;

  return Math.round((valid.reduce((sum, line) => sum + (line.moyenne ?? 0), 0) / valid.length) * 100) / 100;
}

export function getBulletinGeneralAverage(
  bulletin?: Partial<BulletinWithRelations> | null,
) {
  const snapshotAverage = readNumericValue(
    bulletin?.affichage_bulletin?.summary?.general_average,
  );
  if (snapshotAverage !== null) {
    return snapshotAverage;
  }

  const persistedAverage = readNumericValue(bulletin?.general_average);
  if (persistedAverage !== null) {
    return persistedAverage;
  }

  return getBulletinAverage(bulletin?.lignes);
}

export function getBulletinDisplayLabel(bulletin?: Partial<BulletinWithRelations> | null) {
  if (!bulletin) return "Bulletin non renseigne";

  const eleve = getEleveDisplayLabel(bulletin.eleve);
  const periode = bulletin.periode?.nom?.trim() ?? "";

  return periode ? `${eleve} - ${periode}` : eleve;
}

export function getBulletinSecondaryLabel(bulletin?: Partial<BulletinWithRelations> | null) {
  if (!bulletin) return "";

  const classe = bulletin.classe?.nom?.trim() ?? "";
  const lineCount =
    bulletin.affichage_bulletin?.lines?.length ??
    bulletin.lignes?.filter((line) => typeof line.moyenne === "number").length ??
    0;
  const statut = bulletin.statut?.trim() ?? "";
  const templateLabel = bulletin.affichage_bulletin?.template?.template_type
    ?.replaceAll("_", " ")
    .toLowerCase() ?? "";

  return [
    classe,
    lineCount > 0 ? `${lineCount} ligne(s)` : "",
    templateLabel ? `mode ${templateLabel}` : "",
    statut,
  ]
    .filter(Boolean)
    .join(" • ");
}

class BulletinService extends Service {
  constructor() {
    super("bulletin");
  }

  async generate(id: string) {
    return await Http.post(["/api", this.url, id, "generer"].join("/"), {});
  }

  async validate(id: string) {
    return await Http.post(["/api", this.url, id, "valider"].join("/"), {});
  }

  async publish(id: string) {
    return await Http.post(["/api", this.url, id, "publier"].join("/"), {});
  }

  async getForEtablissement(
    etablissementId: string,
    params: QueryParams = {},
  ) {
    const scopedWhere = this.buildScopedWhere(etablissementId, params.where);

    return this.getAll({
      ...params,
      where: JSON.stringify(scopedWhere),
      orderBy:
        typeof params.orderBy === "string"
          ? params.orderBy
          : JSON.stringify(params.orderBy ?? [{ created_at: "desc" }]),
    } as Record<string, string | number | Date | boolean>);
  }

  private buildScopedWhere(etablissementId: string, whereParam?: unknown) {
    const parsedWhere = parseObjectParam(whereParam);
    const scope = {
      classe: {
        etablissement_id: etablissementId,
      },
    };

    if (!parsedWhere || Object.keys(parsedWhere).length === 0) {
      return scope;
    }

    return {
      AND: [parsedWhere, scope],
    };
  }
}

export default BulletinService;

