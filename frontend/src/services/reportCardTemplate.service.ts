import { Http } from "../app/api/Http";
import Service from "../app/api/Service";
import type {
  PedagogicalDisplayMode,
  ReportCardTemplate,
  ReportCardTemplateType,
} from "../types/models";
import type { BulletinDisplaySnapshot } from "./bulletin.service";

type QueryParams = Record<string, unknown>;

export type ReportCardTemplateWithRelations = ReportCardTemplate & {
  annee?: {
    id: string;
    nom: string;
    est_active: boolean;
  } | null;
  niveau?: {
    id: string;
    nom: string;
  } | null;
  bulletins?: Array<{ id: string }>;
  pedagogicalItems?: Array<{
    id: string;
    pedagogical_item_id: string;
    is_visible: boolean;
    custom_label?: string | null;
    display_order: number;
    show_result: boolean;
    show_appreciation: boolean;
    show_children: boolean;
    pedagogicalItem?: {
      id: string;
      nom: string;
      item_type: string;
      parent_id?: string | null;
      matiere_id?: string | null;
      display_order?: number | null;
      parent?: {
        id: string;
        nom: string;
      } | null;
      matiere?: {
        id: string;
        nom: string;
      } | null;
    } | null;
  }>;
};

export type ReportCardTemplatePedagogicalItemInput = {
  pedagogical_item_id: string;
  is_visible: boolean;
  custom_label?: string | null;
  display_order: number;
  show_result: boolean;
  show_appreciation: boolean;
  show_children: boolean;
};

export type ReportCardTemplatePreviewPayload = {
  bulletin_id: string;
  etablissement_id: string;
  annee_scolaire_id: string;
  niveau_scolaire_id?: string | null;
  nom: string;
  description?: string | null;
  template_type: ReportCardTemplateType;
  pedagogical_display_mode: PedagogicalDisplayMode;
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
  is_default: boolean;
  is_active: boolean;
  pedagogical_items?: ReportCardTemplatePedagogicalItemInput[];
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

export function getReportCardTemplateTypeLabel(
  type?: ReportCardTemplateType | string | null,
) {
  switch (type) {
    case "DETAILED":
      return "Detaille";
    case "ASSESSMENT_TYPE_SUMMARY":
      return "Par type d'evaluation";
    case "FINAL_EXAM_ONLY":
      return "Examen final uniquement";
    case "CUSTOM":
      return "Personnalise";
    default:
      return "Standard";
  }
}

export function getPedagogicalDisplayModeLabel(
  mode?: PedagogicalDisplayMode | string | null,
) {
  switch (mode) {
    case "SUBJECTS_AND_DOMAINS":
      return "Matieres et domaines";
    case "FULL_HIERARCHY":
      return "Hierarchie complete";
    case "COMPETENCIES_ONLY":
      return "Competences uniquement";
    case "CUSTOM":
      return "Personnalise";
    default:
      return "Matieres uniquement";
  }
}

export function getReportCardTemplateDisplayLabel(
  template?: Partial<ReportCardTemplateWithRelations> | null,
) {
  if (!template) return "Modele de bulletin";
  const nom = template.nom?.trim() ?? "";
  if (nom) return nom;
  return getReportCardTemplateTypeLabel(template.template_type);
}

class ReportCardTemplateService extends Service {
  constructor() {
    super("report-card-template");
  }

  async getForEtablissement(etablissementId: string, params: QueryParams = {}) {
    const scopedWhere = this.buildScopedWhere(etablissementId, params.where);

    return this.getAll({
      ...params,
      where: JSON.stringify(scopedWhere),
      orderBy:
        typeof params.orderBy === "string"
          ? params.orderBy
          : JSON.stringify(
              params.orderBy ?? [
                { is_default: "desc" },
                { is_active: "desc" },
                { created_at: "desc" },
              ],
            ),
    } as Record<string, string | number | Date | boolean>);
  }

  async setDefault(id: string) {
    return Http.post(["/api", this.url, id, "set-default"].join("/"), {});
  }

  async preview(id: string, bulletinId: string) {
    return Http.post(
      ["/api", this.url, id, "preview"].join("/"),
      { bulletin_id: bulletinId },
    ) as Promise<{ status: unknown; data: BulletinDisplaySnapshot }>;
  }

  async previewInline(payload: ReportCardTemplatePreviewPayload) {
    return Http.post(
      ["/api", this.url, "preview"].join("/"),
      payload,
    ) as Promise<{ status: unknown; data: BulletinDisplaySnapshot }>;
  }

  private buildScopedWhere(etablissementId: string, whereParam?: unknown) {
    const parsedWhere = parseObjectParam(whereParam);

    if (!parsedWhere || Object.keys(parsedWhere).length === 0) {
      return { etablissement_id: etablissementId };
    }

    return {
      AND: [parsedWhere, { etablissement_id: etablissementId }],
    };
  }
}

export default ReportCardTemplateService;
