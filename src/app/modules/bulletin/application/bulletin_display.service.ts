import {
  AssessmentResultStatus,
  PrismaClient,
  type BulletinLigne,
  type ReportCardTemplate,
} from "@prisma/client";
import {
  loadPedagogieInitialisationConfig,
  normalizeBulletinConfigFromTemplateRecord,
  type PedagogieBulletinConfig,
  type PedagogieEvaluationTypeConfig,
  type PedagogieNoteRules,
} from "../../pedagogie_shared/utils/reportCardTemplate";

export type BulletinDisplayColumn = {
  key: string;
  label: string;
};

export type BulletinAssessmentDetail = {
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
  numeric_value?: number | null;
  moyenne: number | null;
  class_average?: number | null;
  coefficient: number | null;
  points: number | null;
  rang: number | null;
  appreciation: string | null;
  assessment_details: BulletinAssessmentDetail[];
  display_cells: Record<string, string>;
};

export type BulletinDisplaySummary = {
  general_average: number | null;
  general_class_average: number | null;
  total_coefficients: number;
  total_points: number;
  rank: number | null;
  mention: string | null;
  decision: string | null;
  general_appreciation: string | null;
  absence_count: number | null;
  late_count: number | null;
};

export type BulletinDisplayBranding = {
  etablissement_name: string | null;
  logo_url: string | null;
};

export type BulletinCodeLegendEntry = {
  grading_scale_id: string | null;
  code: string;
  label: string;
  numeric_value: number | null;
  display_order: number;
  color?: string | null;
};

export type BulletinDisplaySnapshot = {
  template_id: string | null;
  template: PedagogieBulletinConfig;
  branding: BulletinDisplayBranding;
  columns: BulletinDisplayColumn[];
  lines: BulletinDisplayLine[];
  summary: BulletinDisplaySummary;
  code_legend: BulletinCodeLegendEntry[];
  warnings: string[];
  generated_at: string;
};

type StoredBulletinLine = Pick<
  BulletinLigne,
  | "matiere_id"
  | "pedagogical_item_id"
  | "item_type"
  | "moyenne"
  | "display_value"
  | "numeric_value"
  | "student_average"
  | "class_average"
  | "grading_mode"
  | "rang"
  | "commentaire_enseignant"
> & {
  display_order?: number | null;
  matiere?: {
    id?: string | null;
    nom?: string | null;
  } | null;
};

type AssessmentResultForDisplay = {
  id: string;
  assessment_id: string;
  raw_score: number | null;
  max_score: number | null;
  normalized_score: number | null;
  display_value: string | null;
  status: AssessmentResultStatus;
  scaleLevel?: {
    id: string;
    code: string;
    label: string;
  } | null;
      assessment: {
        id: string;
        type: string;
    titre: string | null;
    note_max: number;
    poids: number | null;
    est_publiee: boolean | null;
    include_in_average: boolean | null;
    show_in_report_card: boolean | null;
    is_final_exam: boolean | null;
    typeRef?: {
      nom?: string | null;
    } | null;
        pedagogicalItem?: {
          id: string;
          parent_id?: string | null;
          item_type: string;
          nom: string;
          display_order?: number | null;
          matiere_id?: string | null;
        } | null;
        gradingScale?: {
          id: string;
          grading_type: string;
          levels?: Array<{
            id: string;
            code: string;
            label: string;
            numeric_value?: number | null;
            display_order?: number | null;
            color?: string | null;
            is_active?: boolean | null;
          }>;
        } | null;
        cours: {
          matiere_id: string;
          matiere?: {
        nom?: string | null;
      } | null;
    };
  };
};

type LegacyNoteForDisplay = {
  score: number;
  commentaire?: string | null;
  evaluation: {
    id: string;
    type: string;
    titre: string | null;
    note_max: number;
    poids: number | null;
    est_publiee: boolean | null;
    include_in_average: boolean | null;
    show_in_report_card: boolean | null;
    is_final_exam: boolean | null;
    typeRef?: {
      nom?: string | null;
    } | null;
    pedagogicalItem?: {
      id: string;
      parent_id?: string | null;
      item_type: string;
      nom: string;
      display_order?: number | null;
      matiere_id?: string | null;
    } | null;
    gradingScale?: {
      id: string;
      grading_type: string;
      levels?: Array<{
        id: string;
        code: string;
        label: string;
        numeric_value?: number | null;
        display_order?: number | null;
        color?: string | null;
        is_active?: boolean | null;
      }>;
    } | null;
    cours: {
      matiere_id: string;
      matiere?: {
        nom?: string | null;
      } | null;
    };
  };
};

type BuildSnapshotArgs = {
  tenantId: string;
  eleveId: string;
  periodeId: string;
  classeId: string;
  academicYearId: string;
  storedLines: StoredBulletinLine[];
  templateOverride?: ReportCardTemplate | null;
  templatePedagogicalItems?: Array<{
    pedagogical_item_id: string;
    is_visible: boolean;
    section_id?: string | null;
    custom_label?: string | null;
    display_order: number;
    show_result: boolean;
    show_appreciation: boolean;
    show_children: boolean;
    grading_scale_id_override?: string | null;
    include_in_general_average_override?: boolean | null;
  }>;
  templateSections?: Array<{
    id: string;
    parent_section_id?: string | null;
    title: string;
    section_type?: string | null;
    grading_mode?: string | null;
    display_order: number;
    show_header: boolean;
    is_active: boolean;
  }>;
  generalRank?: number | null;
  mention?: string | null;
  decision?: string | null;
  generalAppreciation?: string | null;
  absenceCount?: number | null;
  lateCount?: number | null;
};

type PedagogicalItemNode = {
  id: string;
  parent_id: string | null;
  item_type: string;
  nom: string;
  display_order: number | null;
  matiere_id: string | null;
};

type TemplatePedagogicalSelection = NonNullable<
  BuildSnapshotArgs["templatePedagogicalItems"]
>[number];

type TemplateSectionConfig = NonNullable<
  BuildSnapshotArgs["templateSections"]
>[number];

function asObjectRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export class BulletinDisplayService {
  constructor(private readonly prisma: PrismaClient) {}

  private getRoundingIncrement(noteRules: PedagogieNoteRules) {
    switch (noteRules.arrondi) {
      case "1":
        return 1;
      case "0.5":
        return 0.5;
      default:
        return 0.25;
    }
  }

  private roundWithNoteRules(value: number, noteRules: PedagogieNoteRules) {
    const increment = this.getRoundingIncrement(noteRules);
    return Math.round(value / increment) * increment;
  }

  private roundToTwo(value: number) {
    return Math.round(value * 100) / 100;
  }

  private getTemplatePrecision(template: PedagogieBulletinConfig) {
    const precision = template.rounding_precision ?? 2;
    if (!Number.isInteger(precision)) return 2;
    return Math.min(4, Math.max(0, precision));
  }

  private roundForConfiguredDisplay(
    value: number,
    noteRules: PedagogieNoteRules,
    template: PedagogieBulletinConfig,
  ) {
    const rounded = this.roundWithNoteRules(value, noteRules);
    const precision = this.getTemplatePrecision(template);
    return Number(rounded.toFixed(precision));
  }

  private roundNumericValue(value: number, template: PedagogieBulletinConfig) {
    const precision = this.getTemplatePrecision(template);
    return Number(value.toFixed(precision));
  }

  private formatConfiguredNumber(
    value: number | null | undefined,
    noteRules: PedagogieNoteRules,
    template: PedagogieBulletinConfig,
  ) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "-";
    }

    const precision = this.getTemplatePrecision(template);
    return this.roundForConfiguredDisplay(value, noteRules, template).toFixed(
      precision,
    );
  }

  private normalizeAssessmentScore(
    score: number,
    noteMax: number,
    typeConfig: PedagogieEvaluationTypeConfig | null,
  ) {
    const targetMax = typeConfig?.note_max ?? 20;
    return (score / noteMax) * targetMax;
  }

  private getAssessmentTypeLabel(
    type: string,
    typeConfigs: Map<string, PedagogieEvaluationTypeConfig>,
  ) {
    const configured = typeConfigs.get(type);
    if (configured?.label?.trim()) {
      return configured.label.trim();
    }

    switch (type) {
      case "DEVOIR":
        return "Devoirs";
      case "EXAMEN":
        return "Compositions / examens";
      case "ORAL":
        return "Oraux";
      default:
        return "Autres";
    }
  }

  private formatAverageCell(
    value: number | null,
    noteRules: PedagogieNoteRules,
    template: PedagogieBulletinConfig,
  ) {
    return this.formatConfiguredNumber(value, noteRules, template);
  }

  private getMentionForAverage(average: number | null) {
    if (average === null) return null;
    if (average >= 16) return "Tres bien";
    if (average >= 14) return "Bien";
    if (average >= 12) return "Assez bien";
    if (average >= 10) return "Passable";
    return "Insuffisant";
  }

  private getAssessmentResultStatusLabel(status: AssessmentResultStatus) {
    switch (status) {
      case AssessmentResultStatus.JUSTIFIED_ABSENCE:
        return "Absence justifiee";
      case AssessmentResultStatus.UNJUSTIFIED_ABSENCE:
        return "Absence non justifiee";
      case AssessmentResultStatus.EXEMPTED:
        return "Dispense";
      case AssessmentResultStatus.NOT_SUBMITTED:
        return "Non rendu";
      case AssessmentResultStatus.NOT_EVALUATED:
        return "Non evalue";
      default:
        return "Note";
    }
  }

  private shouldShowItemType(
    itemType: string | null | undefined,
    template: PedagogieBulletinConfig,
  ) {
    switch (itemType) {
      case "SUBJECT":
        return template.show_subjects;
      case "GROUP":
        return template.show_groups;
      case "DOMAIN":
        return template.show_domains;
      case "SUBDOMAIN":
        return template.show_subdomains;
      case "COMPETENCY":
        return template.show_competencies;
      case "OBJECTIVE":
        return template.show_objectives;
      default:
        return false;
    }
  }

  private shouldShowPedagogicalResult(
    itemType: string | null | undefined,
    template: PedagogieBulletinConfig,
  ) {
    switch (itemType) {
      case "SUBJECT":
        return template.show_subject_summary;
      case "DOMAIN":
        return template.show_domain_summary;
      case "SUBDOMAIN":
        return template.show_subdomain_summary;
      case "COMPETENCY":
      case "OBJECTIVE":
        return template.show_competency_results;
      default:
        return true;
    }
  }

  private getDefaultDepthLimit(template: PedagogieBulletinConfig) {
    if (template.pedagogical_display_mode === "SUBJECTS_ONLY") return 1;
    if (template.pedagogical_display_mode === "SUBJECTS_AND_DOMAINS") return 2;
    if (template.pedagogical_display_mode === "COMPETENCIES_ONLY") {
      return template.show_objectives ? 5 : 4;
    }
    return Math.max(1, template.max_hierarchy_depth);
  }

  private getPedagogicalResultLabel(args: {
    directDetails: BulletinAssessmentDetail[];
    descendantDetails: BulletinAssessmentDetail[];
    template: PedagogieBulletinConfig;
    noteRules: PedagogieNoteRules;
    itemType: string;
    subjectSummaryValue: number | null;
    subjectSummaryDisplayValue?: string | null;
  }) {
    const details = args.directDetails.filter(
      (detail) => detail.visible_in_report_card || !args.template.show_only_evaluated_items,
    );
    const allRelevant = args.descendantDetails.filter(
      (detail) => detail.include_in_average || detail.visible_in_report_card,
    );

    const shouldUseSummary =
      (args.itemType === "SUBJECT" && args.template.show_subject_summary) ||
      (args.itemType === "DOMAIN" && args.template.show_domain_summary) ||
      (args.itemType === "SUBDOMAIN" && args.template.show_subdomain_summary);

    if (args.itemType === "SUBJECT" && shouldUseSummary) {
      if (args.subjectSummaryValue !== null) {
        return this.formatConfiguredNumber(
          args.subjectSummaryValue,
          args.noteRules,
          args.template,
        );
      }

      if (args.subjectSummaryDisplayValue?.trim()) {
        return args.subjectSummaryDisplayValue.trim();
      }
    }

    if (shouldUseSummary) {
      const calculable = allRelevant.filter(
        (detail): detail is BulletinAssessmentDetail & { normalized_score: number } =>
          typeof detail.normalized_score === "number",
      );
      if (calculable.length > 0) {
        const weightedSum = calculable.reduce(
          (sum, detail) => sum + detail.normalized_score * detail.weight,
          0,
        );
        const totalWeight = calculable.reduce((sum, detail) => sum + detail.weight, 0);
        if (totalWeight > 0) {
          return this.formatConfiguredNumber(
            weightedSum / totalWeight,
            args.noteRules,
            args.template,
          );
        }
      }
    }

    if (
      (args.itemType === "COMPETENCY" || args.itemType === "OBJECTIVE") &&
      !args.template.show_competency_results
    ) {
      return null;
    }

    if (details.length === 1) {
      return details[0].display_value?.trim() || null;
    }

    if (details.length > 1) {
      const calculable = details.filter(
        (detail): detail is BulletinAssessmentDetail & { normalized_score: number } =>
          typeof detail.normalized_score === "number",
      );
      if (calculable.length > 0) {
        const weightedSum = calculable.reduce(
          (sum, detail) => sum + detail.normalized_score * detail.weight,
          0,
        );
        const totalWeight = calculable.reduce((sum, detail) => sum + detail.weight, 0);
        if (totalWeight > 0) {
          return this.formatConfiguredNumber(
            weightedSum / totalWeight,
            args.noteRules,
            args.template,
          );
        }
      }

      return details
        .map((detail) => detail.display_value?.trim())
        .filter((value): value is string => Boolean(value))
        .join(" | ");
    }

    return null;
  }

  private getPedagogicalIndent(depth: number) {
    if (depth <= 0) return "";
    return `${"\u00A0".repeat(depth * 4)}↳ `;
  }

  private getSelectionDisplayOrder(
    selection: TemplatePedagogicalSelection | undefined,
    node: PedagogicalItemNode,
    fallback: number,
  ) {
    if (typeof selection?.display_order === "number") {
      return selection.display_order;
    }

    if (typeof node.display_order === "number") {
      return node.display_order;
    }

    return fallback;
  }

  private validateDisplayRules(args: {
    template: PedagogieBulletinConfig;
    lines: BulletinDisplayLine[];
  }) {
    const { template, lines } = args;
    const warnings: string[] = [];

    if (
      template.show_assessment_details &&
      lines.every(
        (line) =>
          !line.assessment_details.some((detail) => detail.visible_in_report_card),
      )
    ) {
      warnings.push(
        "Impossible d'afficher les notes detaillees : aucune evaluation visible n'est disponible.",
      );
    }

    if (template.show_only_final_exam) {
      const missingFinalExam = lines.find(
        (line) =>
          !line.assessment_details.some(
            (detail) =>
              detail.visible_in_report_card && detail.is_final_exam,
          ),
      );

      if (missingFinalExam) {
        warnings.push(
          `Impossible d'afficher l'examen final : aucune evaluation finale n'est definie pour ${missingFinalExam.matiere_nom}.`,
        );
      }
    }

    const lineWithoutCoefficient = lines.find(
      (line) =>
        typeof line.moyenne === "number" &&
        (line.coefficient === null || line.coefficient === undefined),
    );

    if (lineWithoutCoefficient) {
      warnings.push(
        "Impossible de calculer le bulletin : le coefficient d'une matiere est manquant.",
      );
    }

    return warnings;
  }

  private extractInstitutionLogoUrl(raw: unknown) {
    const root = asObjectRecord(raw);
    if (!root) return null;

    const directCandidates = [
      root.logo_url,
      root.logoUrl,
      root.logo,
      root.logo_path,
      root.logoPath,
      root.image_url,
      root.imageUrl,
    ];

    for (const candidate of directCandidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
    }

    const branding = asObjectRecord(root.branding);
    if (branding) {
      const brandingCandidates = [
        branding.logo_url,
        branding.logoUrl,
        branding.logo,
        branding.logo_path,
        branding.logoPath,
        branding.image_url,
        branding.imageUrl,
      ];

      for (const candidate of brandingCandidates) {
        if (typeof candidate === "string" && candidate.trim()) {
          return candidate.trim();
        }
      }
    }

    return null;
  }

  public async buildSnapshot(
    args: BuildSnapshotArgs,
  ): Promise<BulletinDisplaySnapshot> {
    const [
      { config: pedagogieConfig, templateRecord },
      etablissement,
      classe,
      pedagogicalItems,
      courses,
      assessmentResults,
      notes,
    ] =
      await Promise.all([
        loadPedagogieInitialisationConfig(
          this.prisma,
          args.tenantId,
          args.academicYearId,
        ),
        this.prisma.etablissement.findFirst({
          where: {
            id: args.tenantId,
          },
          select: {
            id: true,
            nom: true,
            parametres_json: true,
          },
        }),
        this.prisma.classe.findFirst({
          where: {
            id: args.classeId,
            etablissement_id: args.tenantId,
          },
          select: {
            id: true,
            niveau_scolaire_id: true,
          },
        }),
        this.prisma.pedagogicalItem.findMany({
          where: {
            etablissement_id: args.tenantId,
            annee_scolaire_id: args.academicYearId,
            is_active: true,
          },
          select: {
            id: true,
            parent_id: true,
            item_type: true,
            nom: true,
            display_order: true,
            matiere_id: true,
            niveau_scolaire_id: true,
          },
          orderBy: [{ display_order: "asc" }, { nom: "asc" }],
        }),
        this.prisma.cours.findMany({
          where: {
            classe_id: args.classeId,
            annee_scolaire_id: args.academicYearId,
            etablissement_id: args.tenantId,
          },
          include: {
            matiere: true,
          },
        }),
        this.prisma.assessmentResult.findMany({
          where: {
            student_id: args.eleveId,
            assessment: {
              periode_id: args.periodeId,
              cours: {
                classe_id: args.classeId,
                annee_scolaire_id: args.academicYearId,
              },
            },
          },
          include: {
            scaleLevel: true,
            assessment: {
              include: {
                typeRef: true,
                pedagogicalItem: true,
                gradingScale: {
                  include: {
                    levels: {
                      where: {
                        is_active: true,
                      },
                      orderBy: [{ display_order: "asc" }, { code: "asc" }],
                    },
                  },
                },
                cours: {
                  include: {
                    matiere: true,
                  },
                },
              },
            },
          },
        }),
        this.prisma.note.findMany({
          where: {
            eleve_id: args.eleveId,
            evaluation: {
              periode_id: args.periodeId,
              cours: {
                classe_id: args.classeId,
                annee_scolaire_id: args.academicYearId,
              },
            },
          },
          include: {
            evaluation: {
              include: {
                typeRef: true,
                pedagogicalItem: true,
                gradingScale: {
                  include: {
                    levels: {
                      where: {
                        is_active: true,
                      },
                      orderBy: [{ display_order: "asc" }, { code: "asc" }],
                    },
                  },
                },
                cours: {
                  include: {
                    matiere: true,
                  },
                },
              },
            },
          },
        }),
      ]);

    const programme = classe
      ? await this.prisma.programme.findFirst({
          where: {
            etablissement_id: args.tenantId,
            annee_scolaire_id: args.academicYearId,
            niveau_scolaire_id: classe.niveau_scolaire_id,
          },
          include: {
            matieres: true,
          },
        })
      : null;

    const resolvedTemplate =
      args.templateOverride
        ? normalizeBulletinConfigFromTemplateRecord(
            args.templateOverride as unknown as Record<string, unknown>,
          )
        : pedagogieConfig.bulletin_config;
    const resolvedTemplateId = args.templateOverride?.id ?? templateRecord?.id ?? null;
    let templatePedagogicalSelections = args.templatePedagogicalItems ?? [];
    let templateSections = args.templateSections ?? [];

    if (
      resolvedTemplateId &&
      (
        templatePedagogicalSelections.length === 0 ||
        templatePedagogicalSelections.some(
          (item) =>
            item.section_id === undefined ||
            item.grading_scale_id_override === undefined ||
            item.include_in_general_average_override === undefined,
        ) ||
        templateSections.length === 0
      )
    ) {
      const templateStructure = await this.prisma.reportCardTemplate.findFirst({
        where: {
          id: resolvedTemplateId,
        },
        include: {
          pedagogicalItems: {
            orderBy: [{ display_order: "asc" as const }, { created_at: "asc" as const }],
          },
          sections: {
            where: {
              is_active: true,
            },
            orderBy: [{ display_order: "asc" as const }, { created_at: "asc" as const }],
          },
        } as any,
      });

      if (
        templatePedagogicalSelections.length === 0 ||
        templatePedagogicalSelections.some(
          (item) =>
            item.section_id === undefined ||
            item.grading_scale_id_override === undefined ||
            item.include_in_general_average_override === undefined,
        )
      ) {
        templatePedagogicalSelections =
          ((templateStructure as any)?.pedagogicalItems as
            | Array<Record<string, unknown>>
            | undefined)?.map((item) => ({
            pedagogical_item_id: String(item.pedagogical_item_id ?? ""),
            is_visible: Boolean(item.is_visible),
            section_id:
              typeof item.section_id === "string" && item.section_id.trim()
                ? item.section_id.trim()
                : null,
            custom_label:
              typeof item.custom_label === "string" && item.custom_label.trim()
                ? item.custom_label.trim()
                : null,
            display_order:
              typeof item.display_order === "number" ? item.display_order : 0,
            show_result: item.show_result !== false,
            show_appreciation: Boolean(item.show_appreciation),
            show_children: item.show_children !== false,
            grading_scale_id_override:
              typeof item.grading_scale_id_override === "string" &&
              item.grading_scale_id_override.trim()
                ? item.grading_scale_id_override.trim()
                : null,
            include_in_general_average_override:
              typeof item.include_in_general_average_override === "boolean"
                ? item.include_in_general_average_override
                : null,
          }))?.filter((item) => item.pedagogical_item_id) ?? [];
      }

      if (templateSections.length === 0) {
        templateSections =
          ((templateStructure as any)?.sections as
            | Array<Record<string, unknown>>
            | undefined)?.map((section) => ({
            id: String(section.id ?? ""),
            parent_section_id:
              typeof section.parent_section_id === "string" &&
              section.parent_section_id.trim()
                ? section.parent_section_id.trim()
                : null,
            title:
              typeof section.title === "string" && section.title.trim()
                ? section.title.trim()
                : "Section",
            section_type:
              typeof section.section_type === "string" ? section.section_type : null,
            grading_mode:
              typeof section.grading_mode === "string" ? section.grading_mode : null,
            display_order:
              typeof section.display_order === "number" ? section.display_order : 0,
            show_header: section.show_header !== false,
            is_active: section.is_active !== false,
          }))?.filter((section) => section.id) ?? [];
      }
    }

    const typeConfigs: Map<string, PedagogieEvaluationTypeConfig> = new Map(
      pedagogieConfig.evaluation_types.map((item) => [item.code, item] as const),
    );
    const coefficientByMatiereId = new Map<string, number | null>();
    const matiereNameById = new Map<string, string>();

    courses.forEach((course) => {
      const fallbackCoefficient =
        programme?.matieres?.find((item) => item.matiere_id === course.matiere_id)
          ?.coefficient ?? null;
      coefficientByMatiereId.set(
        course.matiere_id,
        course.coefficient_override ?? fallbackCoefficient,
      );
      matiereNameById.set(course.matiere_id, course.matiere?.nom?.trim() || "Matiere");
    });

    const notesByMatiereId = new Map<string, BulletinAssessmentDetail[]>();
    const assessmentResultByEvaluationId = new Map<string, AssessmentResultForDisplay>();
    const codeLegendMap = new Map<string, BulletinCodeLegendEntry>();

    (assessmentResults as AssessmentResultForDisplay[]).forEach((result) => {
      assessmentResultByEvaluationId.set(result.assessment_id, result);
      const matiereId = result.assessment.cours.matiere_id;
      if (!matiereId) return;

      const typeConfig = typeConfigs.get(result.assessment.type) ?? null;
      const typeLabel =
        result.assessment.typeRef?.nom?.trim() ||
        this.getAssessmentTypeLabel(result.assessment.type, typeConfigs);
      const computedDisplayValue =
        result.display_value?.trim() ||
        result.scaleLevel?.label?.trim() ||
        result.scaleLevel?.code?.trim() ||
        (typeof result.raw_score === "number" &&
        typeof (result.max_score ?? result.assessment.note_max) === "number" &&
        (result.max_score ?? result.assessment.note_max) > 0
          ? `${result.raw_score}/${result.max_score ?? result.assessment.note_max}`
          : this.getAssessmentResultStatusLabel(result.status));
      const detail: BulletinAssessmentDetail = {
        evaluation_id: result.assessment.id,
        pedagogical_item_id: result.assessment.pedagogicalItem?.id ?? null,
        title: result.assessment.titre?.trim() || typeLabel,
        type: result.assessment.type,
        type_label: typeLabel,
        display_value: computedDisplayValue,
        status: result.status,
        score: typeof result.raw_score === "number" ? result.raw_score : null,
        max_score: result.max_score ?? result.assessment.note_max,
        normalized_score:
          typeof result.normalized_score === "number"
            ? this.roundWithNoteRules(result.normalized_score, pedagogieConfig.note_rules)
            : typeof result.raw_score === "number" &&
                Number.isFinite(result.assessment.note_max) &&
                result.assessment.note_max > 0
              ? this.roundWithNoteRules(
                  this.normalizeAssessmentScore(
                    result.raw_score,
                    result.assessment.note_max,
                    typeConfig,
                  ),
                  pedagogieConfig.note_rules,
                )
              : null,
        weight: result.assessment.poids ?? typeConfig?.poids ?? 1,
        include_in_average:
          result.assessment.include_in_average ?? typeConfig?.include_in_average ?? true,
        visible_in_report_card:
          Boolean(result.assessment.est_publiee) &&
          (result.assessment.show_in_report_card ??
            typeConfig?.show_in_report_card ??
            result.assessment.type === "EXAMEN"),
        is_final_exam:
          result.assessment.is_final_exam ??
          typeConfig?.is_final_exam ??
          result.assessment.type === "EXAMEN",
        is_published: Boolean(result.assessment.est_publiee),
      };

      const current = notesByMatiereId.get(matiereId) ?? [];
      current.push(detail);
      notesByMatiereId.set(matiereId, current);
      const gradingScale = result.assessment.gradingScale;
      if (
        gradingScale &&
        (gradingScale.grading_type === "LETTER" ||
          gradingScale.grading_type === "LEVEL" ||
          gradingScale.grading_type === "VALIDATION")
      ) {
        (gradingScale.levels ?? []).forEach((level, index) => {
          if (!level.code?.trim() || !level.label?.trim()) return;
          const legendKey = `${gradingScale.id}::${level.code.trim()}`;
          if (!codeLegendMap.has(legendKey)) {
            codeLegendMap.set(legendKey, {
              grading_scale_id: gradingScale.id,
              code: level.code.trim(),
              label: level.label.trim(),
              numeric_value:
                typeof level.numeric_value === "number" ? level.numeric_value : null,
              display_order:
                typeof level.display_order === "number" ? level.display_order : index,
              color: typeof level.color === "string" ? level.color : null,
            });
          }
        });
      }
      if (!matiereNameById.has(matiereId)) {
        matiereNameById.set(
          matiereId,
          result.assessment.cours.matiere?.nom?.trim() || "Matiere",
        );
      }
    });

    (notes as LegacyNoteForDisplay[]).forEach((note) => {
      if (assessmentResultByEvaluationId.has(note.evaluation.id)) {
        return;
      }

      const matiereId = note.evaluation.cours.matiere_id;
      if (!matiereId) return;

      const typeConfig = typeConfigs.get(note.evaluation.type) ?? null;
      const typeLabel =
        note.evaluation.typeRef?.nom?.trim() ||
        this.getAssessmentTypeLabel(note.evaluation.type, typeConfigs);
      const detail: BulletinAssessmentDetail = {
        evaluation_id: note.evaluation.id,
        pedagogical_item_id: note.evaluation.pedagogicalItem?.id ?? null,
        title: note.evaluation.titre?.trim() || typeLabel,
        type: note.evaluation.type,
        type_label: typeLabel,
        display_value: Number.isFinite(note.score)
          ? `${note.score}/${note.evaluation.note_max}`
          : null,
        status: AssessmentResultStatus.GRADED,
        score: Number.isFinite(note.score) ? note.score : null,
        max_score: note.evaluation.note_max,
        normalized_score:
          Number.isFinite(note.score) &&
          Number.isFinite(note.evaluation.note_max) &&
          note.evaluation.note_max > 0
            ? this.roundWithNoteRules(
                this.normalizeAssessmentScore(
                  note.score,
                  note.evaluation.note_max,
                  typeConfig,
                ),
                pedagogieConfig.note_rules,
              )
            : null,
        weight: note.evaluation.poids ?? typeConfig?.poids ?? 1,
        include_in_average:
          note.evaluation.include_in_average ?? typeConfig?.include_in_average ?? true,
        visible_in_report_card:
          Boolean(note.evaluation.est_publiee) &&
          (note.evaluation.show_in_report_card ??
            typeConfig?.show_in_report_card ??
            note.evaluation.type === "EXAMEN"),
        is_final_exam:
          note.evaluation.is_final_exam ??
          typeConfig?.is_final_exam ??
          note.evaluation.type === "EXAMEN",
        is_published: Boolean(note.evaluation.est_publiee),
      };

      const current = notesByMatiereId.get(matiereId) ?? [];
      current.push(detail);
      notesByMatiereId.set(matiereId, current);
      const gradingScale = note.evaluation.gradingScale;
      if (
        gradingScale &&
        (gradingScale.grading_type === "LETTER" ||
          gradingScale.grading_type === "LEVEL" ||
          gradingScale.grading_type === "VALIDATION")
      ) {
        (gradingScale.levels ?? []).forEach((level, index) => {
          if (!level.code?.trim() || !level.label?.trim()) return;
          const legendKey = `${gradingScale.id}::${level.code.trim()}`;
          if (!codeLegendMap.has(legendKey)) {
            codeLegendMap.set(legendKey, {
              grading_scale_id: gradingScale.id,
              code: level.code.trim(),
              label: level.label.trim(),
              numeric_value:
                typeof level.numeric_value === "number" ? level.numeric_value : null,
              display_order:
                typeof level.display_order === "number" ? level.display_order : index,
              color: typeof level.color === "string" ? level.color : null,
            });
          }
        });
      }
      if (!matiereNameById.has(matiereId)) {
        matiereNameById.set(
          matiereId,
          note.evaluation.cours.matiere?.nom?.trim() || "Matiere",
        );
      }
    });

    const codeLegend = [...codeLegendMap.values()].sort((left, right) => {
      if (left.display_order !== right.display_order) {
        return left.display_order - right.display_order;
      }
      return left.code.localeCompare(right.code, "fr", { sensitivity: "base" });
    });

    const warnings: string[] = [];
    if (resolvedTemplate.show_absences && args.absenceCount === null) {
      warnings.push(
        "Le bulletin est configure pour afficher les absences, mais aucune donnee d'absence n'est disponible.",
      );
    }

    if (resolvedTemplate.show_late_count && args.lateCount === null) {
      warnings.push(
        "Le bulletin est configure pour afficher les retards, mais aucune donnee de retard n'est disponible.",
      );
    }

    const branding: BulletinDisplayBranding = {
      etablissement_name: etablissement?.nom?.trim() || null,
      logo_url: this.extractInstitutionLogoUrl(etablissement?.parametres_json),
    };

    if (resolvedTemplate.show_logo && !branding.logo_url) {
      warnings.push(
        "Le bulletin est configure pour afficher le logo, mais aucun logo d'etablissement n'est disponible.",
      );
    }

    const rootStoredLines = (args.storedLines ?? [])
      .filter((line) => !line.item_type || line.item_type === "SUBJECT")
      .sort((left, right) => {
        const leftOrder = left.display_order ?? 0;
        const rightOrder = right.display_order ?? 0;
        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }
        return left.matiere_id.localeCompare(right.matiere_id, "fr", {
          sensitivity: "base",
        });
      });

    const subjectSummaryLines = rootStoredLines.map((line, index) => {
      const matiereId = line.matiere_id?.trim() || "";
      const allAssessments = notesByMatiereId.get(matiereId) ?? [];
      const visibleAssessments = allAssessments.filter(
        (item) => item.visible_in_report_card,
      );
      const finalExamAssessments = visibleAssessments.filter(
        (item) => item.is_final_exam,
      );
      const coefficient = coefficientByMatiereId.get(matiereId) ?? null;
      const moyenne =
        typeof line.moyenne === "number"
          ? this.roundForConfiguredDisplay(
              line.moyenne,
              pedagogieConfig.note_rules,
              resolvedTemplate,
            )
          : null;
      const classAverage =
        typeof line.class_average === "number"
          ? this.roundForConfiguredDisplay(
              line.class_average,
              pedagogieConfig.note_rules,
              resolvedTemplate,
            )
          : null;
      const averageDisplayValue =
        line.display_value?.trim() ||
        this.formatConfiguredNumber(
          moyenne,
          pedagogieConfig.note_rules,
          resolvedTemplate,
        );
      const points =
        moyenne !== null && coefficient !== null
          ? this.roundNumericValue(moyenne * coefficient, resolvedTemplate)
          : null;

      if (resolvedTemplate.show_subject_points && coefficient === null) {
        warnings.push(
          `Coefficient manquant pour ${matiereNameById.get(matiereId) ?? "une matiere"}.`,
        );
      }

      if (resolvedTemplate.show_only_final_exam && finalExamAssessments.length === 0) {
        warnings.push(
          `Aucune evaluation finale visible pour ${matiereNameById.get(matiereId) ?? "une matiere"}.`,
        );
      }

      const groupedByType = new Map<
        string,
        { label: string; normalizedScores: number[] }
      >();

      visibleAssessments.forEach((assessment) => {
        const current = groupedByType.get(assessment.type) ?? {
          label: assessment.type_label,
          normalizedScores: [],
        };

        if (typeof assessment.normalized_score === "number") {
          current.normalizedScores.push(assessment.normalized_score);
        }

        groupedByType.set(assessment.type, current);
      });

      const displayCells: Record<string, string> = {
        subject:
          (matiereNameById.get(matiereId) ?? line.matiere?.nom?.trim()) ||
          "Matiere",
      };

      if (resolvedTemplate.show_assessment_details) {
        const detailSource = resolvedTemplate.show_only_final_exam
          ? finalExamAssessments
          : visibleAssessments;
        displayCells.assessment_details =
          detailSource.length > 0
            ? detailSource
                .map((assessment) =>
                  assessment.display_value?.trim()
                    ? `${assessment.title}: ${assessment.display_value}`
                    : `${assessment.title}: -`,
                )
                .join(" | ")
            : "-";
      }

      if (resolvedTemplate.show_assessment_type_summary) {
        groupedByType.forEach((group, type) => {
          const average =
            group.normalizedScores.length > 0
              ? this.roundForConfiguredDisplay(
                  group.normalizedScores.reduce((sum, score) => sum + score, 0) /
                    group.normalizedScores.length,
                  pedagogieConfig.note_rules,
                  resolvedTemplate,
                )
              : null;
          displayCells[`type_${type}`] =
            average !== null
              ? this.formatConfiguredNumber(
                  average,
                  pedagogieConfig.note_rules,
                  resolvedTemplate,
                )
              : "-";
        });
      }

      if (resolvedTemplate.show_subject_coefficient) {
        displayCells.coefficient = coefficient !== null ? `${coefficient}` : "-";
      }

      if (resolvedTemplate.show_subject_average) {
        displayCells.average = averageDisplayValue;
      }

      if (resolvedTemplate.show_class_average) {
        displayCells.class_average = this.formatAverageCell(
          classAverage,
          pedagogieConfig.note_rules,
          resolvedTemplate,
        );
      }

      if (resolvedTemplate.show_subject_points) {
        displayCells.points =
          points !== null
            ? this.roundNumericValue(points, resolvedTemplate).toFixed(
                this.getTemplatePrecision(resolvedTemplate),
              )
            : "-";
      }

      if (resolvedTemplate.show_subject_rank) {
        displayCells.rank =
          typeof line.rang === "number" ? `${line.rang}` : "-";
      }

      if (resolvedTemplate.show_teacher_appreciation) {
        displayCells.appreciation = line.commentaire_enseignant?.trim() || "-";
      }

      return {
        row_type: "data",
        row_id: `subject-${matiereId || index}`,
        matiere_id: matiereId,
        matiere_nom:
          (matiereNameById.get(matiereId) ?? line.matiere?.nom?.trim()) ||
          "Matiere",
        pedagogical_item_id: line.pedagogical_item_id ?? null,
        item_type: "SUBJECT",
        grading_mode: line.grading_mode ?? null,
        section_id: null,
        section_title: null,
        section_type: null,
        depth: 0,
        is_summary_line: true,
        numeric_value: line.numeric_value ?? moyenne,
        moyenne,
        class_average: classAverage,
        coefficient,
        points,
        rang: typeof line.rang === "number" ? line.rang : null,
        appreciation: line.commentaire_enseignant?.trim() || null,
        assessment_details: allAssessments,
        display_cells: displayCells,
      } satisfies BulletinDisplayLine;
    });

    const selectionMap = new Map<string, TemplatePedagogicalSelection>(
      templatePedagogicalSelections.map((item) => [item.pedagogical_item_id, item]),
    );

    const scopedPedagogicalItems = (pedagogicalItems ?? []).filter((item) =>
      classe?.niveau_scolaire_id
        ? item.niveau_scolaire_id === classe.niveau_scolaire_id
        : true,
    );

    const pedagogicalNodes = scopedPedagogicalItems.map(
      (item) =>
        ({
          id: item.id,
          parent_id: item.parent_id ?? null,
          item_type: item.item_type,
          nom: item.nom,
          display_order: item.display_order ?? null,
          matiere_id: item.matiere_id ?? null,
        }) satisfies PedagogicalItemNode,
    );
    const pedagogicalNodeById = new Map<string, PedagogicalItemNode>(
      pedagogicalNodes.map((item) => [item.id, item]),
    );
    const childrenByParentId = new Map<string | null, PedagogicalItemNode[]>();

    pedagogicalNodes.forEach((item, index) => {
      const key = item.parent_id ?? null;
      const current = childrenByParentId.get(key) ?? [];
      current.push(item);
      childrenByParentId.set(key, current);
    });

    childrenByParentId.forEach((items) => {
      items.sort((left, right) => {
        const leftSelection = selectionMap.get(left.id);
        const rightSelection = selectionMap.get(right.id);
        const leftOrder = this.getSelectionDisplayOrder(leftSelection, left, 0);
        const rightOrder = this.getSelectionDisplayOrder(rightSelection, right, 0);
        if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        return left.nom.localeCompare(right.nom, "fr", { sensitivity: "base" });
      });
    });

    const subjectItemByMatiereId = new Map<string, PedagogicalItemNode>();
    pedagogicalNodes.forEach((item) => {
      if (item.item_type === "SUBJECT" && item.matiere_id) {
        subjectItemByMatiereId.set(item.matiere_id, item);
      }
    });

    const getRootNodesForSubject = (matiereId: string) => {
      const subjectNode = subjectItemByMatiereId.get(matiereId);
      if (subjectNode) {
        return [subjectNode];
      }

      const subjectScopedNodes = pedagogicalNodes.filter(
        (node) => node.matiere_id === matiereId && node.item_type !== "SUBJECT",
      );
      const subjectScopedNodeIds = new Set(subjectScopedNodes.map((node) => node.id));

      return subjectScopedNodes.filter(
        (node) => !node.parent_id || !subjectScopedNodeIds.has(node.parent_id),
      );
    };

    const activeSections = templateSections
      .filter((section) => section.is_active !== false)
      .sort((left, right) => left.display_order - right.display_order);
    const sectionById = new Map<string, TemplateSectionConfig>(
      activeSections.map((section) => [section.id, section]),
    );
    const getSectionOrder = (sectionId: string | null | undefined) => {
      if (!sectionId) return Number.MAX_SAFE_INTEGER;
      return sectionById.get(sectionId)?.display_order ?? Number.MAX_SAFE_INTEGER;
    };
    const getSectionTitle = (sectionId: string | null | undefined): string | null => {
      if (!sectionId) return null;
      const trail: string[] = [];
      let currentSectionId: string | null = sectionId;

      while (currentSectionId) {
        const current = sectionById.get(currentSectionId);
        if (!current) break;
        trail.unshift(current.title);
        currentSectionId = current.parent_section_id ?? null;
      }

      return trail.length > 0 ? trail.join(" / ") : null;
    };

    const subjectSummaryLinesWithSections = subjectSummaryLines.map((line) => {
      const pedagogicalItemId =
        line.pedagogical_item_id ??
        subjectItemByMatiereId.get(line.matiere_id)?.id ??
        null;
      const sectionId = pedagogicalItemId
        ? selectionMap.get(pedagogicalItemId)?.section_id ?? null
        : null;

      return {
        ...line,
        pedagogical_item_id: pedagogicalItemId,
        section_id: sectionId,
        section_title: getSectionTitle(sectionId),
        section_type: sectionId
          ? sectionById.get(sectionId)?.section_type ?? null
          : null,
      } satisfies BulletinDisplayLine;
    });

    warnings.push(
      ...this.validateDisplayRules({
        template: resolvedTemplate,
        lines: subjectSummaryLinesWithSections,
      }),
    );

    const detailsByPedagogicalItemId = new Map<string, BulletinAssessmentDetail[]>();
    notesByMatiereId.forEach((items) => {
      items.forEach((detail) => {
        if (!detail.pedagogical_item_id) return;
        const current = detailsByPedagogicalItemId.get(detail.pedagogical_item_id) ?? [];
        current.push(detail);
        detailsByPedagogicalItemId.set(detail.pedagogical_item_id, current);
      });
    });

    const descendantDetailsCache = new Map<string, BulletinAssessmentDetail[]>();
    const collectDescendantDetails = (itemId: string): BulletinAssessmentDetail[] => {
      const cached = descendantDetailsCache.get(itemId);
      if (cached) return cached;

      const own = detailsByPedagogicalItemId.get(itemId) ?? [];
      const descendant = [...own];
      const children = childrenByParentId.get(itemId) ?? [];
      children.forEach((child) => {
        descendant.push(...collectDescendantDetails(child.id));
      });
      descendantDetailsCache.set(itemId, descendant);
      return descendant;
    };

    const hasTemplateSelection = selectionMap.size > 0;
    const depthLimit = this.getDefaultDepthLimit(resolvedTemplate);
    const showPedagogicalStructure =
      resolvedTemplate.pedagogical_display_mode !== "SUBJECTS_ONLY" ||
      hasTemplateSelection;
    const hierarchicalLines: BulletinDisplayLine[] = [];

    const buildPedagogicalRows = (
      node: PedagogicalItemNode,
      subjectLine: BulletinDisplayLine,
      depth: number,
      ancestorExplicitlyHidden: boolean,
    ): BulletinDisplayLine[] => {
      if (depth + 1 > depthLimit) {
        return [];
      }

      const selection = selectionMap.get(node.id);
      const typeVisibleByTemplate = this.shouldShowItemType(node.item_type, resolvedTemplate);
      const explicitlyVisible = selection?.is_visible === true;
      const explicitlyHidden = selection?.is_visible === false;
      const visibleByDefault = !ancestorExplicitlyHidden && typeVisibleByTemplate;
      const isVisible = explicitlyHidden
        ? false
        : explicitlyVisible || visibleByDefault;
      const allowChildren = selection?.show_children !== false;
      const directDetails = (detailsByPedagogicalItemId.get(node.id) ?? []).filter(
        (detail) =>
          detail.visible_in_report_card &&
          (!resolvedTemplate.show_only_final_exam || detail.is_final_exam),
      );
      const descendantDetails = collectDescendantDetails(node.id).filter(
        (detail) =>
          detail.visible_in_report_card &&
          (!resolvedTemplate.show_only_final_exam || detail.is_final_exam),
      );
      const hasAnyResult = descendantDetails.length > 0;

      const rows: BulletinDisplayLine[] = [];
      const resultLabel = this.getPedagogicalResultLabel({
        directDetails,
        descendantDetails,
        template: resolvedTemplate,
        noteRules: pedagogieConfig.note_rules,
        itemType: node.item_type,
        subjectSummaryValue: subjectLine.moyenne,
        subjectSummaryDisplayValue: subjectLine.display_cells.average ?? null,
      });

      const shouldHideForMissingResult =
        resolvedTemplate.show_only_evaluated_items && !hasAnyResult;
      const shouldShowResult =
        selection?.show_result !== false &&
        this.shouldShowPedagogicalResult(node.item_type, resolvedTemplate);
      const fallbackLabel =
        shouldShowResult && !resultLabel && resolvedTemplate.show_non_evaluated_items
          ? resolvedTemplate.non_evaluated_label
          : null;

      if (
        isVisible &&
        !shouldHideForMissingResult &&
        (hasAnyResult || fallbackLabel || !shouldShowResult)
      ) {
        const labelPrefix =
          resolvedTemplate.show_hierarchical_indent && resolvedTemplate.group_items_by_parent
            ? this.getPedagogicalIndent(depth)
            : "";

        const displayCells: Record<string, string> = {
          subject: `${labelPrefix}${selection?.custom_label?.trim() || node.nom}`,
        };

        if (
          shouldShowResult &&
          (resolvedTemplate.pedagogical_display_mode !== "SUBJECTS_ONLY" ||
            node.item_type !== "SUBJECT")
        ) {
          displayCells.result = resultLabel?.trim() || fallbackLabel || "-";
        }

        if (resolvedTemplate.show_teacher_appreciation) {
          displayCells.appreciation =
            selection?.show_appreciation && subjectLine.appreciation
              ? subjectLine.appreciation
              : node.item_type === "SUBJECT"
                ? subjectLine.appreciation || "-"
                : "-";
        }

        if (resolvedTemplate.show_subject_average && node.item_type === "SUBJECT") {
          displayCells.average = subjectLine.display_cells.average ?? "-";
        }

        if (resolvedTemplate.show_class_average && node.item_type === "SUBJECT") {
          displayCells.class_average = subjectLine.display_cells.class_average ?? "-";
        }

        if (resolvedTemplate.show_subject_coefficient && node.item_type === "SUBJECT") {
          displayCells.coefficient =
            subjectLine.coefficient !== null ? `${subjectLine.coefficient}` : "-";
        }

        if (resolvedTemplate.show_subject_points && node.item_type === "SUBJECT") {
          displayCells.points = subjectLine.points !== null ? `${subjectLine.points}` : "-";
        }

        if (resolvedTemplate.show_subject_rank && node.item_type === "SUBJECT") {
          displayCells.rank = subjectLine.rang !== null ? `${subjectLine.rang}` : "-";
        }

        rows.push({
          row_id: `pedagogical-${subjectLine.matiere_id}-${node.id}`,
          row_type: "data",
          matiere_id: subjectLine.matiere_id,
          matiere_nom: subjectLine.matiere_nom,
          pedagogical_item_id: node.id,
          item_type: node.item_type,
          grading_mode:
            node.item_type === "SUBJECT" ? subjectLine.grading_mode ?? null : null,
          section_id: selection?.section_id ?? null,
          section_title: getSectionTitle(selection?.section_id),
          section_type: selection?.section_id
            ? sectionById.get(selection.section_id)?.section_type ?? null
            : null,
          depth,
          is_summary_line: node.item_type === "SUBJECT",
          numeric_value:
            node.item_type === "SUBJECT" ? subjectLine.numeric_value ?? subjectLine.moyenne : null,
          moyenne: node.item_type === "SUBJECT" ? subjectLine.moyenne : null,
          class_average:
            node.item_type === "SUBJECT" ? subjectLine.class_average ?? null : null,
          coefficient: node.item_type === "SUBJECT" ? subjectLine.coefficient : null,
          points: node.item_type === "SUBJECT" ? subjectLine.points : null,
          rang: node.item_type === "SUBJECT" ? subjectLine.rang : null,
          appreciation:
            selection?.show_appreciation && subjectLine.appreciation
              ? subjectLine.appreciation
              : node.item_type === "SUBJECT"
                ? subjectLine.appreciation
                : null,
          assessment_details: descendantDetails,
          display_cells: displayCells,
        });
      }

      if (!allowChildren) {
        return rows;
      }

      const children = childrenByParentId.get(node.id) ?? [];
      children.forEach((child) => {
        rows.push(
          ...buildPedagogicalRows(
            child,
            subjectLine,
            depth + 1,
            ancestorExplicitlyHidden || explicitlyHidden,
          ),
        );
      });

      return rows;
    };

    if (showPedagogicalStructure) {
      subjectSummaryLinesWithSections.forEach((subjectLine, index) => {
        const subjectRoots = getRootNodesForSubject(subjectLine.matiere_id);
        if (subjectRoots.length > 0) {
          const subjectHierarchy = subjectRoots.flatMap((rootNode) =>
            buildPedagogicalRows(rootNode, subjectLine, 0, false),
          );

          if (subjectHierarchy.length > 0) {
            hierarchicalLines.push(...subjectHierarchy);
            return;
          }
        }

        const subjectLabel = subjectLine.display_cells.subject ?? subjectLine.matiere_nom;
        const fallbackCells = {
          ...subjectLine.display_cells,
          subject: subjectLabel,
          result:
            subjectLine.display_cells.average ||
            this.formatConfiguredNumber(
              subjectLine.moyenne,
              pedagogieConfig.note_rules,
              resolvedTemplate,
            ),
        };
        hierarchicalLines.push({
          ...subjectLine,
          row_id: `subject-fallback-${subjectLine.matiere_id || index}`,
          display_cells: fallbackCells,
        });
      });
    }

    const baseLines = showPedagogicalStructure
      ? hierarchicalLines.length > 0
        ? hierarchicalLines
        : subjectSummaryLinesWithSections
      : subjectSummaryLinesWithSections;
    const lines =
      resolvedTemplate.show_section_headers && activeSections.length > 0
        ? (() => {
            const sortedLines = baseLines
              .map((line, index) => ({ line, index }))
              .sort((left, right) => {
              const sectionOrderDiff =
                getSectionOrder(left.line.section_id) -
                getSectionOrder(right.line.section_id);
              if (sectionOrderDiff !== 0) return sectionOrderDiff;
              return left.index - right.index;
            })
              .map((entry) => entry.line);

            const rows: BulletinDisplayLine[] = [];
            let currentSectionId: string | null = null;

            sortedLines.forEach((line) => {
              const nextSectionId = line.section_id ?? null;
              const section = nextSectionId ? sectionById.get(nextSectionId) ?? null : null;

              if (
                nextSectionId &&
                nextSectionId !== currentSectionId &&
                section &&
                section?.show_header !== false
              ) {
                rows.push({
                  row_type: "section_header",
                  row_id: `section-${nextSectionId}`,
                  matiere_id: "",
                  matiere_nom: section.title,
                  pedagogical_item_id: null,
                  item_type: null,
                  grading_mode: section.grading_mode ?? null,
                  section_id: nextSectionId,
                  section_title: getSectionTitle(nextSectionId),
                  section_type: section.section_type ?? null,
                  depth: 0,
                  is_summary_line: false,
                  numeric_value: null,
                  moyenne: null,
                  class_average: null,
                  coefficient: null,
                  points: null,
                  rang: null,
                  appreciation: null,
                  assessment_details: [],
                  display_cells: {
                    subject: getSectionTitle(nextSectionId) ?? section.title,
                    result: "",
                    assessment_details: "",
                    coefficient: "",
                    average: "",
                    class_average: "",
                    points: "",
                    rank: "",
                    appreciation: "",
                  },
                });
              }

              rows.push(line);
              currentSectionId = nextSectionId;
            });

            return rows;
          })()
        : baseLines;

    const ranked = subjectSummaryLinesWithSections.flatMap((line) =>
      typeof line.moyenne === "number" &&
      (resolvedTemplate.use_coefficients === false ||
        (typeof line.coefficient === "number" && typeof line.points === "number"))
        ? [
            {
              moyenne: line.moyenne,
              points:
                resolvedTemplate.use_coefficients === false
                  ? line.moyenne
                  : line.points ?? 0,
              coefficient:
                resolvedTemplate.use_coefficients === false
                  ? 1
                  : line.coefficient ?? 1,
            },
          ]
        : [],
    );

    const totalCoefficients = this.roundNumericValue(
      ranked.reduce((sum, line) => sum + line.coefficient, 0),
      resolvedTemplate,
    );
    const totalPoints = this.roundNumericValue(
      ranked.reduce((sum, line) => sum + line.points, 0),
      resolvedTemplate,
    );
    const generalAverage =
      totalCoefficients > 0
        ? this.roundForConfiguredDisplay(
            totalPoints / totalCoefficients,
            pedagogieConfig.note_rules,
            resolvedTemplate,
          )
        : null;
    const rankedClassAverages = subjectSummaryLinesWithSections.flatMap((line) =>
      typeof line.class_average === "number"
        ? [
            {
              class_average: line.class_average,
              coefficient:
                resolvedTemplate.use_coefficients === false
                  ? 1
                  : line.coefficient ?? 1,
            },
          ]
        : [],
    );
    const totalClassCoefficients = this.roundNumericValue(
      rankedClassAverages.reduce((sum, line) => sum + line.coefficient, 0),
      resolvedTemplate,
    );
    const generalClassAverage =
      totalClassCoefficients > 0
        ? this.roundForConfiguredDisplay(
            rankedClassAverages.reduce(
              (sum, line) => sum + line.class_average * line.coefficient,
              0,
            ) / totalClassCoefficients,
            pedagogieConfig.note_rules,
            resolvedTemplate,
          )
        : null;

    const columns: BulletinDisplayColumn[] = [{ key: "subject", label: "Matiere" }];

    const shouldShowPedagogicalResultColumn =
      lines.some((line) => line.item_type && line.item_type !== "SUBJECT") ||
      (resolvedTemplate.pedagogical_display_mode !== "SUBJECTS_ONLY" &&
        !resolvedTemplate.show_assessment_details &&
        !resolvedTemplate.show_assessment_type_summary);

    if (shouldShowPedagogicalResultColumn) {
      columns.push({ key: "result", label: "Resultat" });
    }

    if (resolvedTemplate.show_assessment_details) {
      columns.push({
        key: "assessment_details",
        label: resolvedTemplate.show_only_final_exam
          ? "Composition / examen"
          : "Notes detaillees",
      });
    }

    if (resolvedTemplate.show_assessment_type_summary) {
      const typeKeys = new Map<string, string>();
      lines.forEach((line) => {
        line.assessment_details
          .filter((item) => item.visible_in_report_card)
          .forEach((item) => {
            if (!typeKeys.has(item.type)) {
              typeKeys.set(item.type, item.type_label);
            }
          });
      });

      typeKeys.forEach((label, type) => {
        columns.push({ key: `type_${type}`, label });
      });
    }

    if (resolvedTemplate.show_subject_coefficient) {
      columns.push({ key: "coefficient", label: "Coef" });
    }
    if (resolvedTemplate.show_subject_average) {
      columns.push({ key: "average", label: "Moyenne" });
    }
    if (resolvedTemplate.show_class_average) {
      columns.push({ key: "class_average", label: "Moy. classe" });
    }
    if (resolvedTemplate.show_subject_points) {
      columns.push({ key: "points", label: "Points" });
    }
    if (resolvedTemplate.show_subject_rank) {
      columns.push({ key: "rank", label: "Rang" });
    }
    if (resolvedTemplate.show_teacher_appreciation) {
      columns.push({ key: "appreciation", label: "Appreciation" });
    }

    return {
      template_id: resolvedTemplateId,
      template: resolvedTemplate,
      branding,
      columns,
      lines,
      summary: {
        general_average: generalAverage,
        general_class_average: generalClassAverage,
        total_coefficients: totalCoefficients,
        total_points: totalPoints,
        rank:
          typeof args.generalRank === "number" ? args.generalRank : null,
        mention:
          typeof args.mention === "string" && args.mention.trim()
            ? args.mention.trim()
            : this.getMentionForAverage(generalAverage),
        decision:
          typeof args.decision === "string" && args.decision.trim()
            ? args.decision.trim()
            : null,
        general_appreciation:
          typeof args.generalAppreciation === "string" &&
          args.generalAppreciation.trim()
            ? args.generalAppreciation.trim()
            : null,
        absence_count:
          typeof args.absenceCount === "number" ? args.absenceCount : null,
        late_count:
          typeof args.lateCount === "number" ? args.lateCount : null,
      },
      code_legend: codeLegend,
      warnings: [...new Set(warnings)],
      generated_at: new Date().toISOString(),
    };
  }
}
