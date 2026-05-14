import { Application, NextFunction, Request, Response as R, Router } from "express";
import {
  Prisma,
  PrismaClient,
  ReportCardTemplateType,
  type ReportCardTemplate,
} from "@prisma/client";
import Response from "../../../common/app/response";
import ReportCardTemplateModel from "../models/report_card_template.model";
import { getAllPaginated } from "../../../common/utils/functions";
import { parseJSON } from "../../../common/utils/query";
import { prisma } from "../../../service/prisma";
import { getRequiredActiveAcademicYear } from "../../pedagogie_shared/utils/academicScope";
import { BulletinDisplayService } from "../../bulletin/application/bulletin_display.service";

type PedagogicalDisplayModeValue =
  | "SUBJECTS_ONLY"
  | "SUBJECTS_AND_DOMAINS"
  | "FULL_HIERARCHY"
  | "COMPETENCIES_ONLY"
  | "CUSTOM";

type ReportAverageCalculationModeValue =
  | "SIMPLE"
  | "HIERARCHICAL"
  | "WEIGHTED"
  | "COEFFICIENT_BASED";

type ReportCardTemplatePayload = {
  etablissement_id: string;
  annee_scolaire_id: string;
  niveau_scolaire_id: string | null;
  nom: string;
  description: string | null;
  template_type: ReportCardTemplateType;
  pedagogical_display_mode: PedagogicalDisplayModeValue;
  calculation_mode: ReportAverageCalculationModeValue;
  include_code_grades_in_general_average: boolean;
  rounding_precision: number;
  base_score: number | null;
  exclude_non_evaluated_items: boolean;
  minimum_required_results: number;
  use_weights: boolean;
  use_coefficients: boolean;
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
  show_student_average: boolean;
  show_subject_average: boolean;
  show_class_average: boolean;
  show_subject_coefficient: boolean;
  show_subject_points: boolean;
  show_subject_rank: boolean;
  show_teacher_appreciation: boolean;
  show_general_student_average: boolean;
  show_general_average: boolean;
  show_general_class_average: boolean;
  show_code_legend: boolean;
  show_section_headers: boolean;
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
};

type ReportCardTemplatePedagogicalItemPayload = {
  section_id?: string | null;
  pedagogical_item_id: string;
  is_visible: boolean;
  custom_label: string | null;
  display_order: number;
  show_result: boolean;
  show_appreciation: boolean;
  show_children: boolean;
  grading_scale_id_override?: string | null;
  include_in_general_average_override?: boolean | null;
};

type ReportCardTemplateSectionPayload = {
  id: string;
  parent_section_id?: string | null;
  title: string;
  section_type?: string | null;
  grading_mode?: string | null;
  display_order: number;
  show_header: boolean;
  is_active: boolean;
};

const TEMPLATE_TYPES: ReportCardTemplateType[] = [
  "STANDARD",
  "DETAILED",
  "ASSESSMENT_TYPE_SUMMARY",
  "FINAL_EXAM_ONLY",
  "CUSTOM",
];

const PEDAGOGICAL_DISPLAY_MODES: PedagogicalDisplayModeValue[] = [
  "SUBJECTS_ONLY",
  "SUBJECTS_AND_DOMAINS",
  "FULL_HIERARCHY",
  "COMPETENCIES_ONLY",
  "CUSTOM",
];

const REPORT_AVERAGE_CALCULATION_MODES: ReportAverageCalculationModeValue[] = [
  "SIMPLE",
  "HIERARCHICAL",
  "WEIGHTED",
  "COEFFICIENT_BASED",
];

class ReportCardTemplateApp {
  public app: Application;
  public router: Router;
  private reportCardTemplate: ReportCardTemplateModel;
  private prisma: PrismaClient;
  private displayService: BulletinDisplayService;

  constructor(app: Application) {
    this.app = app;
    this.router = Router();
    this.reportCardTemplate = new ReportCardTemplateModel();
    this.prisma = prisma;
    this.displayService = new BulletinDisplayService(this.prisma);
    this.routes();
  }

  public routes(): Router {
    this.router.post("/preview", this.previewInline.bind(this));
    this.router.post("/", this.create.bind(this));
    this.router.get("/", this.getAll.bind(this));
    this.router.get("/:id", this.getOne.bind(this));
    this.router.delete("/:id", this.delete.bind(this));
    this.router.put("/:id", this.update.bind(this));
    this.router.post("/:id/set-default", this.setDefault.bind(this));
    this.router.post("/:id/preview", this.preview.bind(this));
    return this.router;
  }

  private resolveTenantId(req: Request): string {
    const requestTenant = (req as Request & { tenantId?: string }).tenantId;
    const bodyTenant =
      typeof req.body?.etablissement_id === "string"
        ? req.body.etablissement_id.trim()
        : undefined;
    const queryWhere = parseJSON<Record<string, unknown>>(req.query.where, {});
    const queryTenant =
      typeof queryWhere?.etablissement_id === "string"
        ? queryWhere.etablissement_id.trim()
        : undefined;

    const tenantCandidates = [requestTenant, bodyTenant, queryTenant].filter(
      (value): value is string => Boolean(value),
    );

    if (tenantCandidates.length === 0) {
      throw new Error("Aucun etablissement actif n'a ete fourni.");
    }

    if (new Set(tenantCandidates).size > 1) {
      throw new Error("Conflit d'etablissement detecte pour le modele de bulletin.");
    }

    return tenantCandidates[0];
  }

  private normalizeBoolean(value: unknown, fallback: boolean) {
    return typeof value === "boolean" ? value : fallback;
  }

  private normalizeDisplayOrder(value: unknown, fallback = 0) {
    const parsed =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim()
          ? Number(value)
          : fallback;

    if (!Number.isInteger(parsed) || parsed < 0) {
      return fallback;
    }

    return parsed;
  }

  private normalizePositiveNumber(value: unknown, fallback: number | null) {
    const parsed =
      typeof value === "number"
        ? value
        : typeof value === "string" && value.trim()
          ? Number(value)
          : Number.NaN;

    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  private harmonizeTemplateType(
    payload: Omit<
      ReportCardTemplatePayload,
      "etablissement_id" | "annee_scolaire_id" | "niveau_scolaire_id" | "nom" | "description"
    >,
  ): Omit<
    ReportCardTemplatePayload,
    "etablissement_id" | "annee_scolaire_id" | "niveau_scolaire_id" | "nom" | "description"
  > {
    return payload;
  }

  private normalizePedagogicalItems(
    raw: unknown,
  ): ReportCardTemplatePedagogicalItemPayload[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    const items = raw
      .map((item) => {
        if (typeof item !== "object" || item === null) return null;
        const source = item as Record<string, unknown>;
        const pedagogical_item_id =
          typeof source.pedagogical_item_id === "string" &&
          source.pedagogical_item_id.trim()
            ? source.pedagogical_item_id.trim()
            : "";

        if (!pedagogical_item_id) {
          return null;
        }

        return {
          section_id:
            typeof source.section_id === "string" && source.section_id.trim()
              ? source.section_id.trim()
              : null,
          pedagogical_item_id,
          is_visible: this.normalizeBoolean(source.is_visible, true),
          custom_label:
            typeof source.custom_label === "string" && source.custom_label.trim()
              ? source.custom_label.trim()
              : null,
          display_order: this.normalizeDisplayOrder(source.display_order, 0),
          show_result: this.normalizeBoolean(source.show_result, true),
          show_appreciation: this.normalizeBoolean(source.show_appreciation, false),
          show_children: this.normalizeBoolean(source.show_children, true),
          grading_scale_id_override:
            typeof source.grading_scale_id_override === "string" &&
            source.grading_scale_id_override.trim()
              ? source.grading_scale_id_override.trim()
              : null,
          include_in_general_average_override:
            typeof source.include_in_general_average_override === "boolean"
              ? source.include_in_general_average_override
              : null,
        } satisfies ReportCardTemplatePedagogicalItemPayload;
      })
      .filter(Boolean) as ReportCardTemplatePedagogicalItemPayload[];

    const uniqueById = new Map<string, ReportCardTemplatePedagogicalItemPayload>();
    items.forEach((item) => {
      uniqueById.set(item.pedagogical_item_id, item);
    });

    return [...uniqueById.values()].sort(
      (left, right) => left.display_order - right.display_order,
    );
  }

  private normalizeTemplateSections(raw: unknown): ReportCardTemplateSectionPayload[] {
    if (!Array.isArray(raw)) {
      return [];
    }

    const sections = raw
      .map((item) => {
        if (typeof item !== "object" || item === null) return null;
        const source = item as Record<string, unknown>;
        const id =
          typeof source.id === "string" && source.id.trim() ? source.id.trim() : "";
        const title =
          typeof source.title === "string" && source.title.trim()
            ? source.title.trim()
            : "";

        if (!id || !title) {
          return null;
        }

        return {
          id,
          parent_section_id:
            typeof source.parent_section_id === "string" &&
            source.parent_section_id.trim()
              ? source.parent_section_id.trim()
              : null,
          title,
          section_type:
            typeof source.section_type === "string" && source.section_type.trim()
              ? source.section_type.trim()
              : null,
          grading_mode:
            typeof source.grading_mode === "string" && source.grading_mode.trim()
              ? source.grading_mode.trim()
              : null,
          display_order: this.normalizeDisplayOrder(source.display_order, 0),
          show_header: this.normalizeBoolean(source.show_header, true),
          is_active: this.normalizeBoolean(source.is_active, true),
        } satisfies ReportCardTemplateSectionPayload;
      })
      .filter(Boolean) as ReportCardTemplateSectionPayload[];

    const uniqueById = new Map<string, ReportCardTemplateSectionPayload>();
    sections.forEach((section) => {
      uniqueById.set(section.id, section);
    });

    return [...uniqueById.values()].sort(
      (left, right) => left.display_order - right.display_order,
    );
  }

  private normalizePayload(
    raw: Partial<Record<string, unknown>>,
    tenantId: string,
    activeYearId: string,
  ): ReportCardTemplatePayload {
    const normalizedName =
      typeof raw.nom === "string" ? raw.nom.trim().replace(/\s+/g, " ") : "";

    if (!normalizedName) {
      throw new Error("Le nom du modele de bulletin est requis.");
    }

    const rawTemplateType =
      typeof raw.template_type === "string"
        ? raw.template_type.trim().toUpperCase()
        : String(raw.template_type ?? "STANDARD").trim().toUpperCase();

    if (!TEMPLATE_TYPES.includes(rawTemplateType as ReportCardTemplateType)) {
      throw new Error("Le type de modele de bulletin est invalide.");
    }

    const rawPedagogicalDisplayMode =
      typeof raw.pedagogical_display_mode === "string"
        ? raw.pedagogical_display_mode.trim().toUpperCase()
        : String(raw.pedagogical_display_mode ?? "SUBJECTS_ONLY")
            .trim()
            .toUpperCase();

    if (
      !PEDAGOGICAL_DISPLAY_MODES.includes(
        rawPedagogicalDisplayMode as PedagogicalDisplayModeValue,
      )
    ) {
      throw new Error("Le mode d'affichage pedagogique du bulletin est invalide.");
    }

    const rawCalculationMode =
      typeof raw.calculation_mode === "string"
        ? raw.calculation_mode.trim().toUpperCase()
        : "HIERARCHICAL";
    const calculationMode = REPORT_AVERAGE_CALCULATION_MODES.includes(
      rawCalculationMode as ReportAverageCalculationModeValue,
    )
      ? (rawCalculationMode as ReportAverageCalculationModeValue)
      : "HIERARCHICAL";

    const requestedYearId =
      typeof raw.annee_scolaire_id === "string" && raw.annee_scolaire_id.trim()
        ? raw.annee_scolaire_id.trim()
        : activeYearId;

    if (requestedYearId !== activeYearId) {
      throw new Error(
        "Le modele de bulletin doit appartenir a l'annee scolaire courante.",
      );
    }

    const normalizedNiveauId =
      typeof raw.niveau_scolaire_id === "string" && raw.niveau_scolaire_id.trim()
        ? raw.niveau_scolaire_id.trim()
        : null;

    const basePayload: Omit<
      ReportCardTemplatePayload,
      "etablissement_id" | "annee_scolaire_id" | "niveau_scolaire_id" | "nom" | "description"
    > = {
      template_type: rawTemplateType as ReportCardTemplateType,
      pedagogical_display_mode:
        rawPedagogicalDisplayMode as PedagogicalDisplayModeValue,
      calculation_mode: calculationMode,
      include_code_grades_in_general_average: this.normalizeBoolean(
        raw.include_code_grades_in_general_average,
        false,
      ),
      rounding_precision: Math.max(
        0,
        this.normalizeDisplayOrder(raw.rounding_precision, 2),
      ),
      base_score: this.normalizePositiveNumber(raw.base_score, null),
      exclude_non_evaluated_items: this.normalizeBoolean(
        raw.exclude_non_evaluated_items,
        true,
      ),
      minimum_required_results: Math.max(
        1,
        this.normalizeDisplayOrder(raw.minimum_required_results, 1),
      ),
      use_weights: this.normalizeBoolean(
        raw.use_weights,
        calculationMode === "WEIGHTED" || calculationMode === "HIERARCHICAL",
      ),
      use_coefficients: this.normalizeBoolean(
        raw.use_coefficients,
        calculationMode === "COEFFICIENT_BASED",
      ),
      show_assessment_details: this.normalizeBoolean(raw.show_assessment_details, false),
      show_assessment_type_summary: this.normalizeBoolean(
        raw.show_assessment_type_summary,
        false,
      ),
      show_only_final_exam: this.normalizeBoolean(raw.show_only_final_exam, false),
      show_subjects: this.normalizeBoolean(raw.show_subjects, true),
      show_groups: this.normalizeBoolean(raw.show_groups, false),
      show_domains: this.normalizeBoolean(raw.show_domains, false),
      show_subdomains: this.normalizeBoolean(raw.show_subdomains, false),
      show_competencies: this.normalizeBoolean(raw.show_competencies, false),
      show_objectives: this.normalizeBoolean(raw.show_objectives, false),
      show_only_evaluated_items: this.normalizeBoolean(
        raw.show_only_evaluated_items,
        false,
      ),
      show_non_evaluated_items: this.normalizeBoolean(
        raw.show_non_evaluated_items,
        true,
      ),
      non_evaluated_label:
        typeof raw.non_evaluated_label === "string" && raw.non_evaluated_label.trim()
          ? raw.non_evaluated_label.trim()
          : "Non evalue",
      group_items_by_parent: this.normalizeBoolean(raw.group_items_by_parent, true),
      show_hierarchical_indent: this.normalizeBoolean(
        raw.show_hierarchical_indent,
        true,
      ),
      max_hierarchy_depth: Math.max(
        1,
        this.normalizeDisplayOrder(raw.max_hierarchy_depth, 4),
      ),
      show_subject_summary: this.normalizeBoolean(raw.show_subject_summary, true),
      show_domain_summary: this.normalizeBoolean(raw.show_domain_summary, false),
      show_subdomain_summary: this.normalizeBoolean(
        raw.show_subdomain_summary,
        false,
      ),
      show_competency_results: this.normalizeBoolean(
        raw.show_competency_results,
        true,
      ),
      show_student_average: this.normalizeBoolean(
        raw.show_student_average ?? raw.show_subject_average,
        true,
      ),
      show_subject_average: this.normalizeBoolean(
        raw.show_subject_average ?? raw.show_student_average,
        true,
      ),
      show_class_average: this.normalizeBoolean(raw.show_class_average, true),
      show_subject_coefficient: this.normalizeBoolean(raw.show_subject_coefficient, true),
      show_subject_points: this.normalizeBoolean(raw.show_subject_points, false),
      show_subject_rank: this.normalizeBoolean(raw.show_subject_rank, true),
      show_teacher_appreciation: this.normalizeBoolean(
        raw.show_teacher_appreciation,
        true,
      ),
      show_general_student_average: this.normalizeBoolean(
        raw.show_general_student_average ?? raw.show_general_average,
        true,
      ),
      show_general_average: this.normalizeBoolean(
        raw.show_general_average ?? raw.show_general_student_average,
        true,
      ),
      show_general_class_average: this.normalizeBoolean(
        raw.show_general_class_average,
        false,
      ),
      show_code_legend: this.normalizeBoolean(raw.show_code_legend, false),
      show_section_headers: this.normalizeBoolean(raw.show_section_headers, true),
      show_total_coefficients: this.normalizeBoolean(raw.show_total_coefficients, true),
      show_total_points: this.normalizeBoolean(raw.show_total_points, false),
      show_general_rank: this.normalizeBoolean(raw.show_general_rank, true),
      show_mention: this.normalizeBoolean(raw.show_mention, true),
      show_decision: this.normalizeBoolean(raw.show_decision, true),
      show_general_appreciation: this.normalizeBoolean(
        raw.show_general_appreciation,
        true,
      ),
      show_absences: this.normalizeBoolean(raw.show_absences, false),
      show_late_count: this.normalizeBoolean(raw.show_late_count, false),
      show_logo: this.normalizeBoolean(raw.show_logo, true),
      show_signature: this.normalizeBoolean(raw.show_signature, true),
      is_default: this.normalizeBoolean(raw.is_default, false),
      is_active: this.normalizeBoolean(raw.is_active, true),
    };

    const harmonizedPayload = this.harmonizeTemplateType(basePayload);

    return {
      etablissement_id: tenantId,
      annee_scolaire_id: activeYearId,
      niveau_scolaire_id: normalizedNiveauId,
      nom: normalizedName,
      description:
        typeof raw.description === "string" && raw.description.trim()
          ? raw.description.trim()
          : null,
      ...harmonizedPayload,
    };
  }

  private async validateNiveau(
    niveauId: string | null,
    tenantId: string,
  ): Promise<void> {
    if (!niveauId) return;

    const niveau = await this.prisma.niveauScolaire.findFirst({
      where: {
        id: niveauId,
        etablissement_id: tenantId,
      },
      select: { id: true },
    });

    if (!niveau) {
      throw new Error(
        "Le niveau scolaire selectionne n'appartient pas a l'etablissement actif.",
      );
    }
  }

  private async validatePedagogicalItems(
    items: ReportCardTemplatePedagogicalItemPayload[],
    tenantId: string,
    activeYearId: string,
    niveauId: string | null,
  ) {
    if (items.length === 0) return [];

    const rows = await this.prisma.pedagogicalItem.findMany({
      where: {
        id: {
          in: items.map((item) => item.pedagogical_item_id),
        },
        etablissement_id: tenantId,
        annee_scolaire_id: activeYearId,
        ...(niveauId ? { niveau_scolaire_id: niveauId } : {}),
      },
      select: {
        id: true,
      },
    });

    const existingIds = new Set(rows.map((item) => item.id));
    const missing = items.find((item) => !existingIds.has(item.pedagogical_item_id));

    if (missing) {
      throw new Error(
        "Un ou plusieurs elements pedagogiques selectionnes sont invalides pour ce modele.",
      );
    }

    return rows;
  }

  private validateTemplateSections(
    sections: ReportCardTemplateSectionPayload[],
    items: ReportCardTemplatePedagogicalItemPayload[],
  ) {
    if (sections.length === 0) {
      const itemWithSection = items.find((item) => item.section_id);
      if (itemWithSection) {
        throw new Error(
          "Les sections du modele sont manquantes alors que certains elements pedagogiques y sont rattaches.",
        );
      }
      return;
    }

    const sectionIds = new Set(sections.map((section) => section.id));

    sections.forEach((section) => {
      if (section.parent_section_id && !sectionIds.has(section.parent_section_id)) {
        throw new Error(
          `La section parente ${section.parent_section_id} est introuvable dans ce modele.`,
        );
      }
    });

    const invalidItem = items.find(
      (item) => item.section_id && !sectionIds.has(item.section_id),
    );
    if (invalidItem?.section_id) {
      throw new Error(
        `La section ${invalidItem.section_id} referencee par un element pedagogique est introuvable.`,
      );
    }
  }

  private async ensureUniqueTemplate(
    data: ReportCardTemplatePayload,
    excludeId?: string,
  ) {
    const duplicate = await this.prisma.reportCardTemplate.findFirst({
      where: {
        id: excludeId ? { not: excludeId } : undefined,
        annee_scolaire_id: data.annee_scolaire_id,
        nom: data.nom,
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new Error(
        "Un modele de bulletin avec ce nom existe deja pour l'annee courante.",
      );
    }
  }

  private async applyDefaultFlag(
    id: string,
    data: ReportCardTemplatePayload,
  ) {
    if (!data.is_default) return;

    await this.prisma.reportCardTemplate.updateMany({
      where: {
        annee_scolaire_id: data.annee_scolaire_id,
        id: { not: id },
        is_default: true,
      },
      data: {
        is_default: false,
      },
    });
  }

  private buildScopedWhere(
    existingWhere: Record<string, unknown>,
    tenantId: string,
    activeYearId: string,
  ): Record<string, unknown> {
    const scopeWhere = {
      etablissement_id: tenantId,
      annee_scolaire_id: activeYearId,
    };

    if (!existingWhere || Object.keys(existingWhere).length === 0) {
      return scopeWhere;
    }

    return {
      AND: [existingWhere, scopeWhere],
    };
  }

  private getDetailInclude() {
    return {
      annee: true,
      niveau: true,
      sections: {
        orderBy: [{ display_order: "asc" as const }, { created_at: "asc" as const }],
      },
      pedagogicalItems: {
        include: {
          pedagogicalItem: {
            include: {
              parent: true,
              matiere: true,
            },
          },
        },
        orderBy: [{ display_order: "asc" as const }, { created_at: "asc" as const }],
      },
    } as any;
  }

  private async getScopedBulletinForPreview(
    bulletinId: string,
    tenantId: string,
    activeYearId: string,
  ) {
    return this.prisma.bulletin.findFirst({
      where: {
        id: bulletinId,
        classe: {
          etablissement_id: tenantId,
          annee_scolaire_id: activeYearId,
        },
        periode: {
          annee_scolaire_id: activeYearId,
        },
      },
      include: {
        lignes: {
          include: {
            matiere: true,
          },
        },
        periode: {
          select: {
            annee_scolaire_id: true,
          },
        },
      },
    });
  }

  private readPreviewBulletinId(req: Request) {
    return typeof req.body?.bulletin_id === "string" && req.body.bulletin_id.trim()
      ? req.body.bulletin_id.trim()
      : "";
  }

  private async buildPreviewSnapshot(args: {
    bulletinId: string;
    tenantId: string;
    activeYearId: string;
    templateOverride?: ReportCardTemplate | null;
    templatePedagogicalItems?: ReportCardTemplatePedagogicalItemPayload[];
    templateSections?: ReportCardTemplateSectionPayload[];
  }) {
    const bulletin = await this.getScopedBulletinForPreview(
      args.bulletinId,
      args.tenantId,
      args.activeYearId,
    );

    if (!bulletin) {
      throw new Error("Le bulletin de reference est introuvable pour cet etablissement.");
    }

    return this.displayService.buildSnapshot({
      tenantId: args.tenantId,
      eleveId: bulletin.eleve_id,
      periodeId: bulletin.periode_id,
      classeId: bulletin.classe_id,
      academicYearId: bulletin.periode?.annee_scolaire_id ?? args.activeYearId,
      storedLines: bulletin.lignes,
      templateOverride: args.templateOverride,
      templatePedagogicalItems: args.templatePedagogicalItems ?? [],
      templateSections: args.templateSections ?? [],
      generalRank:
        typeof bulletin.general_rank === "number" ? bulletin.general_rank : null,
      mention:
        typeof bulletin.mention === "string" ? bulletin.mention : null,
      decision:
        typeof bulletin.decision === "string" ? bulletin.decision : null,
      generalAppreciation:
        typeof bulletin.general_appreciation === "string"
          ? bulletin.general_appreciation
          : null,
    });
  }

  private async createTemplatePedagogicalItems(
    tx: PrismaClient | Prisma.TransactionClient,
    templateId: string,
    items: ReportCardTemplatePedagogicalItemPayload[],
  ) {
    if (items.length === 0) return;

    await (tx as any).reportCardTemplatePedagogicalItem.createMany({
      data: items.map((item) => ({
        template_id: templateId,
        section_id: item.section_id ?? null,
        pedagogical_item_id: item.pedagogical_item_id,
        is_visible: item.is_visible,
        custom_label: item.custom_label,
        display_order: item.display_order,
        show_result: item.show_result,
        show_appreciation: item.show_appreciation,
        show_children: item.show_children,
        grading_scale_id_override: item.grading_scale_id_override ?? null,
        include_in_general_average_override:
          item.include_in_general_average_override ?? null,
      })),
    });
  }

  private async syncTemplateSections(
    tx: PrismaClient | Prisma.TransactionClient,
    templateId: string,
    sections: ReportCardTemplateSectionPayload[],
  ) {
    await (tx as any).reportCardTemplateSection.deleteMany({
      where: {
        template_id: templateId,
      },
    });

    if (sections.length === 0) return;

    await (tx as any).reportCardTemplateSection.createMany({
      data: sections.map((section) => ({
        id: section.id,
        template_id: templateId,
        parent_section_id: section.parent_section_id ?? null,
        title: section.title,
        section_type: section.section_type ?? null,
        grading_mode: section.grading_mode ?? null,
        display_order: section.display_order,
        show_header: section.show_header,
        is_active: section.is_active,
      })),
    });
  }

  private async create(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);
      const data = this.normalizePayload(req.body, tenantId, activeYear.id);
      const pedagogicalItems = this.normalizePedagogicalItems(
        (req.body as { pedagogical_items?: unknown }).pedagogical_items,
      );
      const templateSections = this.normalizeTemplateSections(
        (req.body as { template_sections?: unknown }).template_sections,
      );

      await this.validateNiveau(data.niveau_scolaire_id, tenantId);
      await this.validatePedagogicalItems(
        pedagogicalItems,
        tenantId,
        activeYear.id,
        data.niveau_scolaire_id,
      );
      this.validateTemplateSections(templateSections, pedagogicalItems);
      await this.ensureUniqueTemplate(data);

      const result = await this.prisma.$transaction(async (tx) => {
        const created = await tx.reportCardTemplate.create({ data });
        await this.syncTemplateSections(tx, created.id, templateSections);
        await this.createTemplatePedagogicalItems(tx, created.id, pedagogicalItems);

        if (data.is_default) {
          await tx.reportCardTemplate.updateMany({
            where: {
              annee_scolaire_id: data.annee_scolaire_id,
              id: { not: created.id },
              is_default: true,
            },
            data: {
              is_default: false,
            },
          });
        }

        return tx.reportCardTemplate.findUnique({
          where: { id: created.id },
          include: this.getDetailInclude(),
        });
      });

      Response.success(res, "Modele de bulletin cree avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la creation du modele de bulletin",
        400,
        error as Error,
      );
    }
  }

  private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);
      const where = parseJSON<Record<string, unknown>>(req.query.where, {});
      const scopedQuery = {
        ...req.query,
        where: JSON.stringify(this.buildScopedWhere(where, tenantId, activeYear.id)),
        orderBy:
          req.query.orderBy ??
          JSON.stringify([
            { is_default: "desc" },
            { is_active: "desc" },
            { created_at: "desc" },
          ]),
      };

      const result = await getAllPaginated(
        scopedQuery as typeof req.query,
        this.reportCardTemplate,
      );
      Response.success(res, "Liste des modeles de bulletin recuperee.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation des modeles de bulletin",
        400,
        error as Error,
      );
    }
  }

  private async getOne(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);
      const id = req.params.id;

      const result = await this.prisma.reportCardTemplate.findFirst({
        where: {
          id,
          etablissement_id: tenantId,
          annee_scolaire_id: activeYear.id,
        },
        include: this.getDetailInclude(),
      });

      if (!result) {
        throw new Error("Modele de bulletin introuvable pour cet etablissement.");
      }

      Response.success(res, "Detail du modele de bulletin.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la recuperation du modele de bulletin",
        404,
        error as Error,
      );
    }
  }

  private async delete(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);
      const id = req.params.id;

      const existing = await this.prisma.reportCardTemplate.findFirst({
        where: {
          id,
          etablissement_id: tenantId,
          annee_scolaire_id: activeYear.id,
        },
        include: {
          _count: {
            select: {
              bulletins: true,
            },
          },
        },
      });

      if (!existing) {
        throw new Error("Modele de bulletin introuvable pour cet etablissement.");
      }

      if (existing._count.bulletins > 0) {
        throw new Error(
          `Suppression impossible: ce modele est deja rattache a ${existing._count.bulletins} bulletin(s).`,
        );
      }

      const result = await this.reportCardTemplate.delete(id);
      Response.success(res, "Modele de bulletin supprime avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la suppression du modele de bulletin",
        400,
        error as Error,
      );
    }
  }

  private async update(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);
      const id = req.params.id;

      const existing = await this.prisma.reportCardTemplate.findFirst({
        where: {
          id,
          etablissement_id: tenantId,
          annee_scolaire_id: activeYear.id,
        },
      });

      if (!existing) {
        throw new Error("Modele de bulletin introuvable pour cet etablissement.");
      }

      const data = this.normalizePayload(req.body, tenantId, activeYear.id);
      const pedagogicalItems = this.normalizePedagogicalItems(
        (req.body as { pedagogical_items?: unknown }).pedagogical_items,
      );
      const templateSections = this.normalizeTemplateSections(
        (req.body as { template_sections?: unknown }).template_sections,
      );
      await this.validateNiveau(data.niveau_scolaire_id, tenantId);
      await this.validatePedagogicalItems(
        pedagogicalItems,
        tenantId,
        activeYear.id,
        data.niveau_scolaire_id,
      );
      this.validateTemplateSections(templateSections, pedagogicalItems);
      await this.ensureUniqueTemplate(data, id);

      const result = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.reportCardTemplate.update({
          where: { id },
          data,
        });
        await (tx as any).reportCardTemplatePedagogicalItem.deleteMany({
          where: {
            template_id: id,
          },
        });
        await this.syncTemplateSections(tx, id, templateSections);
        await this.createTemplatePedagogicalItems(tx, id, pedagogicalItems);

        if (data.is_default) {
          await tx.reportCardTemplate.updateMany({
            where: {
              annee_scolaire_id: data.annee_scolaire_id,
              id: { not: id },
              is_default: true,
            },
            data: {
              is_default: false,
            },
          });
        }

        return tx.reportCardTemplate.findUnique({
          where: { id: updated.id },
          include: this.getDetailInclude(),
        });
      });

      Response.success(res, "Modele de bulletin mis a jour avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la mise a jour du modele de bulletin",
        400,
        error as Error,
      );
    }
  }

  private async setDefault(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);
      const id = req.params.id;

      const existing = await this.prisma.reportCardTemplate.findFirst({
        where: {
          id,
          etablissement_id: tenantId,
          annee_scolaire_id: activeYear.id,
        },
      });

      if (!existing) {
        throw new Error("Modele de bulletin introuvable pour cet etablissement.");
      }

      const result = await this.prisma.$transaction(async (tx) => {
        await tx.reportCardTemplate.updateMany({
          where: {
            annee_scolaire_id: activeYear.id,
            is_default: true,
          },
          data: {
            is_default: false,
          },
        });

        return tx.reportCardTemplate.update({
          where: { id },
          data: {
            is_default: true,
            is_active: true,
          },
        });
      });

      Response.success(res, "Modele de bulletin defini par defaut.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la definition du modele par defaut",
        400,
        error as Error,
      );
    }
  }

  private async preview(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);
      const id = req.params.id;
      const bulletinId = this.readPreviewBulletinId(req);

      if (!bulletinId) {
        throw new Error("Un bulletin de reference est requis pour la previsualisation.");
      }

      const template = await this.prisma.reportCardTemplate.findFirst({
        where: {
          id,
          etablissement_id: tenantId,
          annee_scolaire_id: activeYear.id,
        },
        include: {
          sections: {
            orderBy: [{ display_order: "asc" }, { created_at: "asc" }],
          },
          pedagogicalItems: {
            orderBy: [{ display_order: "asc" }, { created_at: "asc" }],
          },
        } as any,
      });

      if (!template) {
        throw new Error("Modele de bulletin introuvable pour cet etablissement.");
      }

      const result = await this.buildPreviewSnapshot({
        bulletinId,
        tenantId,
        activeYearId: activeYear.id,
        templatePedagogicalItems:
        ((template as any).pedagogicalItems as Array<Record<string, any>> | undefined)?.map((item) => ({
            section_id: item.section_id ?? null,
            pedagogical_item_id: item.pedagogical_item_id,
            is_visible: item.is_visible,
            custom_label: item.custom_label,
            display_order: item.display_order,
            show_result: item.show_result,
            show_appreciation: item.show_appreciation,
            show_children: item.show_children,
            grading_scale_id_override: item.grading_scale_id_override ?? null,
            include_in_general_average_override:
              item.include_in_general_average_override ?? null,
          })) ?? [],
        templateSections:
          ((template as any).sections as Array<Record<string, any>> | undefined)?.map((section) => ({
            id: String(section.id ?? ""),
            parent_section_id:
              typeof section.parent_section_id === "string"
                ? section.parent_section_id
                : null,
            title: String(section.title ?? ""),
            section_type:
              typeof section.section_type === "string" ? section.section_type : null,
            grading_mode:
              typeof section.grading_mode === "string" ? section.grading_mode : null,
            display_order:
              typeof section.display_order === "number" ? section.display_order : 0,
            show_header: section.show_header !== false,
            is_active: section.is_active !== false,
          })) ?? [],
        templateOverride: template,
      });

      Response.success(res, "Apercu du bulletin genere avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la previsualisation du modele de bulletin",
        400,
        error as Error,
      );
    }
  }

  private async previewInline(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const tenantId = this.resolveTenantId(req);
      const activeYear = await getRequiredActiveAcademicYear(this.prisma, tenantId);
      const bulletinId = this.readPreviewBulletinId(req);

      if (!bulletinId) {
        throw new Error("Un bulletin de reference est requis pour la previsualisation.");
      }

      const templatePayload = this.normalizePayload(req.body, tenantId, activeYear.id);
      const pedagogicalItems = this.normalizePedagogicalItems(
        (req.body as { pedagogical_items?: unknown }).pedagogical_items,
      );
      const templateSections = this.normalizeTemplateSections(
        (req.body as { template_sections?: unknown }).template_sections,
      );
      await this.validateNiveau(templatePayload.niveau_scolaire_id, tenantId);
      await this.validatePedagogicalItems(
        pedagogicalItems,
        tenantId,
        activeYear.id,
        templatePayload.niveau_scolaire_id,
      );
      this.validateTemplateSections(templateSections, pedagogicalItems);

      const result = await this.buildPreviewSnapshot({
        bulletinId,
        tenantId,
        activeYearId: activeYear.id,
        templatePedagogicalItems: pedagogicalItems,
        templateSections,
        templateOverride: {
          id:
            typeof req.body?.id === "string" && req.body.id.trim()
              ? req.body.id.trim()
              : "preview-inline",
          created_at: new Date(),
          updated_at: new Date(),
          ...templatePayload,
        } as ReportCardTemplate,
      });

      Response.success(res, "Apercu du bulletin genere avec succes.", result);
    } catch (error) {
      Response.error(
        res,
        "Erreur lors de la previsualisation du modele de bulletin",
        400,
        error as Error,
      );
    }
  }
}

export default ReportCardTemplateApp;
