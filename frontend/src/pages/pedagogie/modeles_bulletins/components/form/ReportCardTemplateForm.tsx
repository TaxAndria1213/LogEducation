import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FiFileText, FiLayers, FiSettings } from "react-icons/fi";
import Spin from "../../../../../components/anim/Spin";
import { FieldWrapper } from "../../../../../components/Form/fields/FieldWrapper";
import { getInputClassName } from "../../../../../components/Form/fields/inputStyles";
import { useInfo } from "../../../../../hooks/useInfo";
import { useAuth } from "../../../../../hooks/useAuth";
import anneeScolaireService from "../../../../../services/anneeScolaire.service";
import NiveauScolaireService from "../../../../../services/niveau.service";
import PedagogicalItemService, {
  getPedagogicalItemTypeLabel,
  type PedagogicalItemWithRelations,
} from "../../../../../services/pedagogicalItem.service";
import BulletinService, {
  getBulletinDisplayLabel,
  type BulletinDisplaySnapshot,
  type BulletinWithRelations,
} from "../../../../../services/bulletin.service";
import ReportCardTemplateService, {
  getPedagogicalDisplayModeLabel,
  getReportCardTemplateTypeLabel,
  type ReportAverageCalculationModeValue,
  type ReportCardTemplatePedagogicalItemInput,
  type ReportCardTemplatePreviewPayload,
} from "../../../../../services/reportCardTemplate.service";
import { useReportCardTemplateStore } from "../../store/ReportCardTemplateIndexStore";
import type {
  AnneeScolaire,
  NiveauScolaire,
  PedagogicalDisplayMode,
  ReportCardTemplateType,
} from "../../../../../types/models";

type PedagogicalTreeNode = PedagogicalItemWithRelations & {
  enfants?: PedagogicalTreeNode[];
};

type TemplatePedagogicalSelection = ReportCardTemplatePedagogicalItemInput;

type ReportCardTemplateFormValues = {
  nom: string;
  description: string;
  template_type: ReportCardTemplateType;
  pedagogical_display_mode: PedagogicalDisplayMode;
  calculation_mode: ReportAverageCalculationModeValue;
  niveau_scolaire_id: string;
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
  show_subject_average: boolean;
  show_class_average: boolean;
  show_subject_coefficient: boolean;
  show_subject_points: boolean;
  show_subject_rank: boolean;
  show_teacher_appreciation: boolean;
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

const templateSchema = z.object({
  nom: z
    .string()
    .trim()
    .min(2, "Le nom du modele est requis.")
    .max(160, "Le nom est trop long.")
    .transform((value) => value.replace(/\s+/g, " ")),
  description: z.string().max(500).optional().default(""),
  template_type: z.enum([
    "STANDARD",
    "DETAILED",
    "ASSESSMENT_TYPE_SUMMARY",
    "FINAL_EXAM_ONLY",
    "CUSTOM",
  ]),
  pedagogical_display_mode: z.enum([
    "SUBJECTS_ONLY",
    "SUBJECTS_AND_DOMAINS",
    "FULL_HIERARCHY",
    "COMPETENCIES_ONLY",
    "CUSTOM",
  ]),
  calculation_mode: z.enum(["SIMPLE", "HIERARCHICAL", "WEIGHTED", "COEFFICIENT_BASED"]),
  niveau_scolaire_id: z.string().optional().default(""),
  include_code_grades_in_general_average: z.boolean(),
  rounding_precision: z.coerce.number().int().min(0).max(4),
  base_score: z.preprocess(
    (value) => {
      if (value === "" || value === undefined || value === null) return null;
      return Number(value);
    },
    z.number().positive("Le score de base doit etre positif.").nullable(),
  ),
  exclude_non_evaluated_items: z.boolean(),
  minimum_required_results: z.coerce.number().int().min(1).max(50),
  use_weights: z.boolean(),
  use_coefficients: z.boolean(),
  show_assessment_details: z.boolean(),
  show_assessment_type_summary: z.boolean(),
  show_only_final_exam: z.boolean(),
  show_subjects: z.boolean(),
  show_groups: z.boolean(),
  show_domains: z.boolean(),
  show_subdomains: z.boolean(),
  show_competencies: z.boolean(),
  show_objectives: z.boolean(),
  show_only_evaluated_items: z.boolean(),
  show_non_evaluated_items: z.boolean(),
  non_evaluated_label: z.string().max(100).default("Non evalue"),
  group_items_by_parent: z.boolean(),
  show_hierarchical_indent: z.boolean(),
  max_hierarchy_depth: z.coerce.number().int().min(1).max(6),
  show_subject_summary: z.boolean(),
  show_domain_summary: z.boolean(),
  show_subdomain_summary: z.boolean(),
  show_competency_results: z.boolean(),
  show_subject_average: z.boolean(),
  show_class_average: z.boolean(),
  show_subject_coefficient: z.boolean(),
  show_subject_points: z.boolean(),
  show_subject_rank: z.boolean(),
  show_teacher_appreciation: z.boolean(),
  show_general_average: z.boolean(),
  show_general_class_average: z.boolean(),
  show_code_legend: z.boolean(),
  show_section_headers: z.boolean(),
  show_total_coefficients: z.boolean(),
  show_total_points: z.boolean(),
  show_general_rank: z.boolean(),
  show_mention: z.boolean(),
  show_decision: z.boolean(),
  show_general_appreciation: z.boolean(),
  show_absences: z.boolean(),
  show_late_count: z.boolean(),
  show_logo: z.boolean(),
  show_signature: z.boolean(),
  is_default: z.boolean(),
  is_active: z.boolean(),
});

type ReportCardTemplateFormData = z.output<typeof templateSchema>;

function normalizeNumberInputValue(value: unknown, fallback: string | number = "") {
  return typeof value === "number" ? value : fallback;
}

function getTemplateDefaults(
  type: ReportCardTemplateType,
): Partial<ReportCardTemplateFormValues> {
  const standardDefaults: Partial<ReportCardTemplateFormValues> = {
    pedagogical_display_mode: "SUBJECTS_ONLY",
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
  };

  if (type === "STANDARD") {
    return standardDefaults;
  }

  if (type === "DETAILED") {
    return {
      ...standardDefaults,
      pedagogical_display_mode: "SUBJECTS_AND_DOMAINS",
      show_groups: true,
      show_domains: true,
      show_assessment_details: true,
    };
  }

  if (type === "ASSESSMENT_TYPE_SUMMARY") {
    return {
      ...standardDefaults,
      pedagogical_display_mode: "SUBJECTS_AND_DOMAINS",
      show_groups: true,
      show_domains: true,
      show_assessment_type_summary: true,
    };
  }

  if (type === "FINAL_EXAM_ONLY") {
    return {
      ...standardDefaults,
      pedagogical_display_mode: "SUBJECTS_AND_DOMAINS",
      show_groups: true,
      show_domains: true,
      show_assessment_details: true,
      show_only_final_exam: true,
    };
  }

  return {};
}

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "message" in error.response.data &&
    typeof error.response.data.message === "string"
  ) {
    return error.response.data.message;
  }

  return "Le modele de bulletin n'a pas pu etre enregistre.";
}

function formatSummaryValue(
  value: number | string | null | undefined,
  precision = 2,
) {
  if (typeof value === "number") {
    return value.toFixed(Math.max(0, precision));
  }

  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return "-";
}

function flattenPedagogicalTree(
  nodes: PedagogicalTreeNode[],
  depth = 0,
): Array<{ node: PedagogicalTreeNode; depth: number }> {
  return nodes.flatMap((node) => [
    { node, depth },
    ...flattenPedagogicalTree(node.enfants ?? [], depth + 1),
  ]);
}

function ReportCardTemplateForm() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const service = useMemo(() => new ReportCardTemplateService(), []);
  const editingItem = useReportCardTemplateStore((state) => state.editingItem);
  const clearEditingItem = useReportCardTemplateStore((state) => state.clearEditingItem);
  const setRenderedComponent = useReportCardTemplateStore(
    (state) => state.setRenderedComponent,
  );
  const [currentYear, setCurrentYear] = useState<AnneeScolaire | null>(null);
  const [niveaux, setNiveaux] = useState<NiveauScolaire[]>([]);
  const [pedagogicalTree, setPedagogicalTree] = useState<PedagogicalTreeNode[]>([]);
  const [pedagogicalSelections, setPedagogicalSelections] = useState<
    TemplatePedagogicalSelection[]
  >([]);
  const [bulletins, setBulletins] = useState<BulletinWithRelations[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewBulletinId, setPreviewBulletinId] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewSnapshot, setPreviewSnapshot] =
    useState<BulletinDisplaySnapshot | null>(null);
  const hydratedTemplateTypeRef = useRef<ReportCardTemplateType | null>(null);
  const hydratedDisplayModeRef = useRef<PedagogicalDisplayMode | null>(null);

  const defaultValues = useMemo<ReportCardTemplateFormValues>(
    () => ({
      nom: editingItem?.nom ?? "",
      description: editingItem?.description ?? "",
      template_type: editingItem?.template_type ?? "STANDARD",
      pedagogical_display_mode:
        editingItem?.pedagogical_display_mode ?? "SUBJECTS_ONLY",
      calculation_mode: editingItem?.calculation_mode ?? "HIERARCHICAL",
      niveau_scolaire_id: editingItem?.niveau_scolaire_id ?? "",
      include_code_grades_in_general_average:
        editingItem?.include_code_grades_in_general_average ?? false,
      rounding_precision: editingItem?.rounding_precision ?? 2,
      base_score: editingItem?.base_score ?? null,
      exclude_non_evaluated_items:
        editingItem?.exclude_non_evaluated_items ?? true,
      minimum_required_results: editingItem?.minimum_required_results ?? 1,
      use_weights: editingItem?.use_weights ?? true,
      use_coefficients: editingItem?.use_coefficients ?? true,
      show_assessment_details: editingItem?.show_assessment_details ?? false,
      show_assessment_type_summary: editingItem?.show_assessment_type_summary ?? false,
      show_only_final_exam: editingItem?.show_only_final_exam ?? false,
      show_subjects: editingItem?.show_subjects ?? true,
      show_groups: editingItem?.show_groups ?? false,
      show_domains: editingItem?.show_domains ?? false,
      show_subdomains: editingItem?.show_subdomains ?? false,
      show_competencies: editingItem?.show_competencies ?? false,
      show_objectives: editingItem?.show_objectives ?? false,
      show_only_evaluated_items: editingItem?.show_only_evaluated_items ?? false,
      show_non_evaluated_items: editingItem?.show_non_evaluated_items ?? true,
      non_evaluated_label: editingItem?.non_evaluated_label ?? "Non evalue",
      group_items_by_parent: editingItem?.group_items_by_parent ?? true,
      show_hierarchical_indent: editingItem?.show_hierarchical_indent ?? true,
      max_hierarchy_depth: editingItem?.max_hierarchy_depth ?? 4,
      show_subject_summary: editingItem?.show_subject_summary ?? true,
      show_domain_summary: editingItem?.show_domain_summary ?? false,
      show_subdomain_summary: editingItem?.show_subdomain_summary ?? false,
      show_competency_results: editingItem?.show_competency_results ?? true,
      show_subject_average:
        editingItem?.show_subject_average ?? editingItem?.show_student_average ?? true,
      show_class_average: editingItem?.show_class_average ?? true,
      show_subject_coefficient: editingItem?.show_subject_coefficient ?? true,
      show_subject_points: editingItem?.show_subject_points ?? false,
      show_subject_rank: editingItem?.show_subject_rank ?? true,
      show_teacher_appreciation: editingItem?.show_teacher_appreciation ?? true,
      show_general_average:
        editingItem?.show_general_average ??
        editingItem?.show_general_student_average ??
        true,
      show_general_class_average:
        editingItem?.show_general_class_average ?? false,
      show_code_legend: editingItem?.show_code_legend ?? false,
      show_section_headers: editingItem?.show_section_headers ?? true,
      show_total_coefficients: editingItem?.show_total_coefficients ?? true,
      show_total_points: editingItem?.show_total_points ?? false,
      show_general_rank: editingItem?.show_general_rank ?? true,
      show_mention: editingItem?.show_mention ?? true,
      show_decision: editingItem?.show_decision ?? true,
      show_general_appreciation: editingItem?.show_general_appreciation ?? true,
      show_absences: editingItem?.show_absences ?? false,
      show_late_count: editingItem?.show_late_count ?? false,
      show_logo: editingItem?.show_logo ?? true,
      show_signature: editingItem?.show_signature ?? true,
      is_default: editingItem?.is_default ?? false,
      is_active: editingItem?.is_active ?? true,
    }),
    [editingItem],
  );

  const form = useForm<
    z.input<typeof templateSchema>,
    undefined,
    ReportCardTemplateFormData
  >({
    resolver: zodResolver(templateSchema),
    defaultValues,
    mode: "onSubmit",
  });

  useEffect(() => {
    hydratedTemplateTypeRef.current = defaultValues.template_type;
    hydratedDisplayModeRef.current = defaultValues.pedagogical_display_mode;
    form.reset(defaultValues);
  }, [defaultValues, form]);

  useEffect(() => {
    setPedagogicalSelections(
      (editingItem?.pedagogicalItems ?? []).map((item, index) => ({
        section_id: item.section_id ?? null,
        pedagogical_item_id: item.pedagogical_item_id,
        is_visible: item.is_visible,
        custom_label: item.custom_label ?? null,
        display_order:
          typeof item.display_order === "number" ? item.display_order : index,
        show_result: item.show_result,
        show_appreciation: item.show_appreciation,
        show_children: item.show_children,
        grading_scale_id_override: item.grading_scale_id_override ?? null,
        include_in_general_average_override:
          item.include_in_general_average_override ?? null,
      })),
    );
  }, [editingItem]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!etablissement_id) {
        setCurrentYear(null);
        setNiveaux([]);
        return;
      }

      setLoading(true);

      try {
        const niveauService = new NiveauScolaireService();
        const bulletinService = new BulletinService();
        const year = await anneeScolaireService.getCurrent(etablissement_id);
        const currentYearValue = (year as AnneeScolaire | null) ?? null;
        const [niveauxResult, bulletinsResult] = await Promise.allSettled([
          niveauService.getAll({
            where: JSON.stringify({ etablissement_id }),
            orderBy: JSON.stringify([{ ordre: "asc" }, { nom: "asc" }]),
          }),
          bulletinService.getForEtablissement(etablissement_id, {
            take: 100,
            where: JSON.stringify(
              currentYearValue?.id
                ? { periode: { annee_scolaire_id: currentYearValue.id } }
                : {},
            ),
            includeSpec: JSON.stringify({
              eleve: {
                include: {
                  utilisateur: { include: { profil: true } },
                },
              },
              periode: true,
              classe: true,
            }),
            orderBy: JSON.stringify([{ created_at: "desc" }]),
          }),
        ]);

        if (!active) return;
        setCurrentYear(currentYearValue);
        const niveauxResponse =
          niveauxResult.status === "fulfilled" ? niveauxResult.value : null;
        setNiveaux(
          niveauxResponse?.status.success
            ? ((niveauxResponse.data.data as NiveauScolaire[]) ?? [])
            : [],
        );
        const bulletinsResponse =
          bulletinsResult.status === "fulfilled" ? bulletinsResult.value : null;
        const loadedBulletins =
          bulletinsResponse?.status.success
            ? ((bulletinsResponse.data.data as BulletinWithRelations[]) ?? [])
            : [];
        setBulletins(loadedBulletins);
        setPreviewBulletinId((current) =>
          loadedBulletins.some((bulletin) => bulletin.id === current)
            ? current
            : loadedBulletins[0]?.id || "",
        );
      } catch {
        if (!active) return;
        setCurrentYear(null);
        setNiveaux([]);
        setBulletins([]);
        setPreviewBulletinId("");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [etablissement_id]);

  const { control, handleSubmit, formState, reset, watch, setValue } = form;
  const selectedTemplateType = watch("template_type");
  const selectedPedagogicalDisplayMode = watch("pedagogical_display_mode");
  const selectedCalculationMode = watch("calculation_mode");
  const selectedNiveauId = watch("niveau_scolaire_id");
  const activeAcademicYearId =
    currentYear?.id ?? editingItem?.annee_scolaire_id ?? null;
  const activeAcademicYearLabel =
    currentYear?.nom ?? editingItem?.annee?.nom ?? "Aucune annee active";
  const previewDependencies = watch([
    "nom",
    "description",
    "template_type",
    "pedagogical_display_mode",
    "calculation_mode",
    "niveau_scolaire_id",
    "include_code_grades_in_general_average",
    "rounding_precision",
    "base_score",
    "exclude_non_evaluated_items",
    "minimum_required_results",
    "use_weights",
    "use_coefficients",
    "show_assessment_details",
    "show_assessment_type_summary",
    "show_only_final_exam",
    "show_subjects",
    "show_groups",
    "show_domains",
    "show_subdomains",
    "show_competencies",
    "show_objectives",
    "show_only_evaluated_items",
    "show_non_evaluated_items",
    "non_evaluated_label",
    "group_items_by_parent",
    "show_hierarchical_indent",
    "max_hierarchy_depth",
    "show_subject_summary",
    "show_domain_summary",
    "show_subdomain_summary",
    "show_competency_results",
    "show_subject_average",
    "show_class_average",
    "show_subject_coefficient",
    "show_subject_points",
    "show_subject_rank",
    "show_teacher_appreciation",
    "show_general_average",
    "show_general_class_average",
    "show_code_legend",
    "show_section_headers",
    "show_total_coefficients",
    "show_total_points",
    "show_general_rank",
    "show_mention",
    "show_decision",
    "show_general_appreciation",
    "show_absences",
    "show_late_count",
    "show_logo",
    "show_signature",
    "is_default",
    "is_active",
  ]);

  useEffect(() => {
    if (hydratedTemplateTypeRef.current === selectedTemplateType) {
      hydratedTemplateTypeRef.current = null;
      return;
    }

    if (selectedTemplateType === "CUSTOM") return;
    const defaults = getTemplateDefaults(selectedTemplateType);
    Object.entries(defaults).forEach(([key, value]) => {
      setValue(key as keyof ReportCardTemplateFormValues, value as never, {
        shouldDirty: true,
        shouldValidate: false,
      });
    });
  }, [selectedTemplateType, setValue]);

  useEffect(() => {
    if (selectedCalculationMode === "WEIGHTED") {
      setValue("use_weights", true, { shouldDirty: true, shouldValidate: false });
      return;
    }

    if (selectedCalculationMode === "COEFFICIENT_BASED") {
      setValue("use_coefficients", true, {
        shouldDirty: true,
        shouldValidate: false,
      });
    }
  }, [selectedCalculationMode, setValue]);

  useEffect(() => {
    let active = true;

    const loadTree = async () => {
      if (!etablissement_id) {
        setPedagogicalTree([]);
        return;
      }

      try {
        const pedagogicalItemService = new PedagogicalItemService();
        const response = await pedagogicalItemService.getTree({
          niveau_scolaire_id: selectedNiveauId || undefined,
        });

        if (!active) return;

        setPedagogicalTree(
          response?.status?.success
            ? (((response.data as { data?: unknown })?.data ??
                response.data) as PedagogicalTreeNode[]) ?? []
            : [],
        );
      } catch {
        if (!active) return;
        setPedagogicalTree([]);
      }
    };

    void loadTree();
    return () => {
      active = false;
    };
  }, [etablissement_id, selectedNiveauId]);

  useEffect(() => {
    if (hydratedDisplayModeRef.current === selectedPedagogicalDisplayMode) {
      hydratedDisplayModeRef.current = null;
      return;
    }

    if (selectedPedagogicalDisplayMode === "CUSTOM") return;

    if (selectedPedagogicalDisplayMode === "SUBJECTS_ONLY") {
      setValue("show_subjects", true, { shouldDirty: true, shouldValidate: false });
      setValue("show_groups", false, { shouldDirty: true, shouldValidate: false });
      setValue("show_domains", false, { shouldDirty: true, shouldValidate: false });
      setValue("show_subdomains", false, { shouldDirty: true, shouldValidate: false });
      setValue("show_competencies", false, { shouldDirty: true, shouldValidate: false });
      setValue("show_objectives", false, { shouldDirty: true, shouldValidate: false });
      setValue("max_hierarchy_depth", 1, { shouldDirty: true, shouldValidate: false });
      return;
    }

    if (selectedPedagogicalDisplayMode === "SUBJECTS_AND_DOMAINS") {
      setValue("show_subjects", true, { shouldDirty: true, shouldValidate: false });
      setValue("show_groups", true, { shouldDirty: true, shouldValidate: false });
      setValue("show_domains", true, { shouldDirty: true, shouldValidate: false });
      setValue("show_subdomains", false, { shouldDirty: true, shouldValidate: false });
      setValue("show_competencies", false, { shouldDirty: true, shouldValidate: false });
      setValue("show_objectives", false, { shouldDirty: true, shouldValidate: false });
      setValue("max_hierarchy_depth", 2, { shouldDirty: true, shouldValidate: false });
      return;
    }

    if (selectedPedagogicalDisplayMode === "FULL_HIERARCHY") {
      setValue("show_subjects", true, { shouldDirty: true, shouldValidate: false });
      setValue("show_groups", true, { shouldDirty: true, shouldValidate: false });
      setValue("show_domains", true, { shouldDirty: true, shouldValidate: false });
      setValue("show_subdomains", true, { shouldDirty: true, shouldValidate: false });
      setValue("show_competencies", true, { shouldDirty: true, shouldValidate: false });
      setValue("show_objectives", true, { shouldDirty: true, shouldValidate: false });
      if (Number(form.getValues("max_hierarchy_depth") ?? 0) < 5) {
        setValue("max_hierarchy_depth", 5, { shouldDirty: true, shouldValidate: false });
      }
      return;
    }

    if (selectedPedagogicalDisplayMode === "COMPETENCIES_ONLY") {
      setValue("show_subjects", false, { shouldDirty: true, shouldValidate: false });
      setValue("show_groups", false, { shouldDirty: true, shouldValidate: false });
      setValue("show_domains", false, { shouldDirty: true, shouldValidate: false });
      setValue("show_subdomains", false, { shouldDirty: true, shouldValidate: false });
      setValue("show_competencies", true, { shouldDirty: true, shouldValidate: false });
      setValue("show_objectives", true, { shouldDirty: true, shouldValidate: false });
      if (Number(form.getValues("max_hierarchy_depth") ?? 0) < 5) {
        setValue("max_hierarchy_depth", 5, { shouldDirty: true, shouldValidate: false });
      }
    }
  }, [form, selectedPedagogicalDisplayMode, setValue]);

  const buildPreviewPayload = (
    data: ReportCardTemplateFormValues,
  ): ReportCardTemplatePreviewPayload | null => {
    if (!etablissement_id || !activeAcademicYearId || !previewBulletinId) {
      return null;
    }

    return {
      ...data,
      id: editingItem?.id,
      bulletin_id: previewBulletinId,
      etablissement_id,
      annee_scolaire_id: activeAcademicYearId,
      niveau_scolaire_id: data.niveau_scolaire_id || null,
      description: data.description?.trim() || null,
      non_evaluated_label: data.non_evaluated_label.trim() || "Non evalue",
      pedagogical_items: pedagogicalSelections,
      template_sections: editingItem?.sections ?? [],
    };
  };

  const runPreview = async (
    payload: ReportCardTemplatePreviewPayload | null,
    notifySuccess: boolean,
  ) => {
    if (!payload) {
      return;
    }

    setPreviewLoading(true);

    try {
      const response = await service.previewInline(payload);
      setPreviewSnapshot(response.data);
      if (notifySuccess) {
        info("Apercu du bulletin genere avec succes.", "success");
      }
    } catch (error) {
      setPreviewSnapshot(null);
      if (notifySuccess) {
        info(getErrorMessage(error), "error");
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  const handlePreview = async () => {
    const payload = buildPreviewPayload(form.getValues() as ReportCardTemplateFormData);

    if (!payload) {
      info("Choisis un bulletin de reference pour generer l'apercu.", "error");
      return;
    }

    await runPreview(payload, true);
  };

  useEffect(() => {
    if (!previewBulletinId || !etablissement_id || !activeAcademicYearId) {
      setPreviewSnapshot(null);
      return;
    }

    const payload = buildPreviewPayload(form.getValues() as ReportCardTemplateFormData);
    const timer = window.setTimeout(() => {
      void runPreview(payload, false);
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    previewBulletinId,
    etablissement_id,
    activeAcademicYearId,
    pedagogicalSelections,
    form,
    ...previewDependencies,
  ]);

  const previewSummaryCards = useMemo(() => {
    if (!previewSnapshot) return [];
    const configuredPrecision = Math.max(
      0,
      Math.min(4, previewSnapshot.template.rounding_precision ?? 2),
    );

    return [
      previewSnapshot.template.show_general_average
        ? {
            key: "general_average",
            label: "Moyenne generale",
            value: formatSummaryValue(
              previewSnapshot.summary.general_average,
              configuredPrecision,
            ),
          }
        : null,
      previewSnapshot.template.show_general_class_average
        ? {
            key: "general_class_average",
            label: "Moyenne generale classe",
            value: formatSummaryValue(
              previewSnapshot.summary.general_class_average,
              configuredPrecision,
            ),
          }
        : null,
      previewSnapshot.template.show_total_coefficients
        ? {
            key: "total_coefficients",
            label: "Total coefficients",
            value: formatSummaryValue(
              previewSnapshot.summary.total_coefficients,
              configuredPrecision,
            ),
          }
        : null,
      previewSnapshot.template.show_total_points
        ? {
            key: "total_points",
            label: "Total points",
            value: formatSummaryValue(
              previewSnapshot.summary.total_points,
              configuredPrecision,
            ),
          }
        : null,
      previewSnapshot.template.show_general_rank
        ? {
            key: "general_rank",
            label: "Rang general",
            value: formatSummaryValue(previewSnapshot.summary.rank),
          }
        : null,
      previewSnapshot.template.show_mention
        ? {
            key: "mention",
            label: "Mention",
            value: formatSummaryValue(previewSnapshot.summary.mention),
          }
        : null,
      previewSnapshot.template.show_decision
        ? {
            key: "decision",
            label: "Decision",
            value: formatSummaryValue(previewSnapshot.summary.decision),
          }
        : null,
      previewSnapshot.template.show_general_appreciation
        ? {
            key: "general_appreciation",
            label: "Appreciation generale",
            value: formatSummaryValue(
              previewSnapshot.summary.general_appreciation,
            ),
          }
        : null,
      previewSnapshot.template.show_absences
        ? {
            key: "absence_count",
            label: "Absences",
            value: formatSummaryValue(previewSnapshot.summary.absence_count),
          }
        : null,
      previewSnapshot.template.show_late_count
        ? {
            key: "late_count",
            label: "Retards",
            value: formatSummaryValue(previewSnapshot.summary.late_count),
          }
        : null,
    ].filter(
      (
        item,
      ): item is {
        key: string;
        label: string;
        value: string;
      } => Boolean(item),
    );
  }, [previewSnapshot]);

  const flatPedagogicalItems = useMemo(
    () => flattenPedagogicalTree(pedagogicalTree),
    [pedagogicalTree],
  );

  const selectionByItemId = useMemo(
    () =>
      new Map(
        pedagogicalSelections.map((item) => [item.pedagogical_item_id, item] as const),
      ),
    [pedagogicalSelections],
  );

  const upsertPedagogicalSelection = (
    node: PedagogicalTreeNode,
    patch: Partial<TemplatePedagogicalSelection>,
  ) => {
    setPedagogicalSelections((current) => {
      const existing = current.find(
        (item) => item.pedagogical_item_id === node.id,
      );
      const nextItem: TemplatePedagogicalSelection = {
        section_id: existing?.section_id ?? null,
        pedagogical_item_id: node.id,
        is_visible: existing?.is_visible ?? true,
        custom_label: existing?.custom_label ?? null,
        display_order:
          typeof existing?.display_order === "number"
            ? existing.display_order
            : typeof node.display_order === "number"
              ? node.display_order
              : current.length,
        show_result: existing?.show_result ?? true,
        show_appreciation: existing?.show_appreciation ?? false,
        show_children: existing?.show_children ?? true,
        grading_scale_id_override: existing?.grading_scale_id_override ?? null,
        include_in_general_average_override:
          existing?.include_in_general_average_override ?? null,
        ...patch,
      };

      const withoutCurrent = current.filter(
        (item) => item.pedagogical_item_id !== node.id,
      );

      return [...withoutCurrent, nextItem].sort(
        (left, right) => left.display_order - right.display_order,
      );
    });
  };

  const onSubmit = async (data: ReportCardTemplateFormData) => {
    if (!etablissement_id) {
      info("Aucun etablissement actif n'est defini.", "error");
      return;
    }

    if (!activeAcademicYearId) {
      info("Aucune année scolaire courante n’est définie.", "error");
      return;
    }

    try {
      const payload = {
        ...data,
        description: data.description?.trim() || null,
        non_evaluated_label: data.non_evaluated_label.trim() || "Non evalue",
        niveau_scolaire_id: data.niveau_scolaire_id || null,
        etablissement_id,
        annee_scolaire_id: activeAcademicYearId,
        pedagogical_items: pedagogicalSelections,
        template_sections: editingItem?.sections ?? [],
      };

      if (editingItem) {
        await service.update(editingItem.id, payload);
        info("Modele de bulletin mis a jour avec succes.", "success");
      } else {
        await service.create(payload);
        info("Modele de bulletin cree avec succes.", "success");
      }

      clearEditingItem();
      reset({
        ...(getTemplateDefaults("STANDARD") as Partial<ReportCardTemplateFormValues>),
        nom: "",
        description: "",
        template_type: "STANDARD",
        pedagogical_display_mode: "SUBJECTS_ONLY",
        niveau_scolaire_id: "",
        is_default: false,
        is_active: true,
      });
      setPedagogicalSelections([]);
      setRenderedComponent("list");
    } catch (error) {
      info(getErrorMessage(error), "error");
    }
  };

  const toggleFields = [
    [
      "show_assessment_details",
      "Afficher les notes detaillees",
      "Les notes individuelles peuvent apparaitre dans le bulletin.",
    ],
    [
      "show_assessment_type_summary",
      "Afficher le resume par type",
      "Le bulletin regroupe les notes par devoirs, interrogations ou examens.",
    ],
    [
      "show_only_final_exam",
      "Afficher uniquement l'examen final",
      "Le bulletin n'affiche que les compositions ou examens finaux.",
    ],
    [
      "show_subject_average",
      "Afficher la moyenne matiere",
      "La moyenne de chaque matiere est visible.",
    ],
    [
      "show_class_average",
      "Afficher la moyenne de classe",
      "La moyenne de la classe apparait sur les lignes concernees.",
    ],
    [
      "show_subject_coefficient",
      "Afficher le coefficient",
      "Le coefficient de la matiere est visible.",
    ],
    [
      "show_subject_points",
      "Afficher les points",
      "Les points matiere sont visibles sur le bulletin.",
    ],
    [
      "show_subject_rank",
      "Afficher le rang matiere",
      "Le classement par matiere apparait sur le bulletin.",
    ],
    [
      "show_teacher_appreciation",
      "Afficher l'appreciation enseignant",
      "L'appreciation de la matiere apparait sur la ligne.",
    ],
    [
      "show_general_average",
      "Afficher la moyenne generale",
      "Le resume du bulletin affiche la moyenne generale.",
    ],
    [
      "show_general_class_average",
      "Afficher la moyenne generale classe",
      "Le resume compare l'eleve avec la moyenne globale de la classe.",
    ],
    [
      "show_code_legend",
      "Afficher la legende des codes",
      "Les codes de niveau ou de mention affichent aussi leur legende dans le PDF.",
    ],
    [
      "show_section_headers",
      "Afficher les entetes de section",
      "Le tableau du bulletin separe les blocs pedagogiques par section.",
    ],
    [
      "show_total_coefficients",
      "Afficher le total des coefficients",
      "Le total des coefficients est visible.",
    ],
    [
      "show_total_points",
      "Afficher le total des points",
      "Le total des points est visible.",
    ],
    [
      "show_general_rank",
      "Afficher le rang general",
      "Le classement general apparait sur le bulletin.",
    ],
    ["show_mention", "Afficher la mention", "La mention automatique apparait sur le bulletin."],
    ["show_decision", "Afficher la decision", "La decision de fin de periode apparait sur le bulletin."],
    [
      "show_general_appreciation",
      "Afficher l'appreciation generale",
      "L'appreciation generale apparait dans le resume.",
    ],
    ["show_absences", "Afficher les absences", "Le bulletin peut afficher le recapitulatif des absences."],
    ["show_late_count", "Afficher les retards", "Le bulletin peut afficher le nombre de retards."],
    [
      "include_code_grades_in_general_average",
      "Inclure les codes dans les moyennes",
      "Les codes convertibles peuvent etre utilises dans le calcul des moyennes globales.",
    ],
    ["show_logo", "Afficher le logo", "Le logo d'etablissement apparait sur le PDF."],
    ["show_signature", "Afficher la signature", "La zone de signature est visible sur le bulletin."],
    ["is_default", "Definir comme modele par defaut", "Ce modele devient la reference de l'annee courante."],
    ["is_active", "Activer ce modele", "Un modele inactif reste historise mais non propose."],
  ] as const;

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
              <FiFileText />
              {editingItem ? "Edition" : "Nouveau modele"}
            </span>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {editingItem
                  ? "Mettre a jour un modele de bulletin"
                  : "Configurer un modele de bulletin"}
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Les notes detaillees restent calculees par le systeme. Ici, tu regles
                uniquement ce qui doit etre affiche dans le bulletin final.
              </p>
            </div>
          </div>

          {editingItem ? (
            <button
              type="button"
              onClick={() => {
                clearEditingItem();
                setRenderedComponent("list");
              }}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Annuler l'edition
            </button>
          ) : null}
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Chargement des ressources...
        </div>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <FiSettings />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Cadre du modele</h3>
              <p className="text-sm text-slate-500">
                Le modele est toujours rattache a l'annee scolaire courante.
              </p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <FieldWrapper
              id="annee"
              label="Annee courante"
              description="Rattachement automatique au cycle pedagogique actif."
            >
              <input
                id="annee"
                type="text"
                value={activeAcademicYearLabel}
                disabled
                className={getInputClassName(false)}
              />
            </FieldWrapper>

            <Controller
              control={control}
              name="niveau_scolaire_id"
              render={({ field, fieldState }) => (
                <FieldWrapper
                  id="niveau_scolaire_id"
                  label="Niveau cible"
                  error={fieldState.error?.message}
                  description="Optionnel. Laisse vide pour un modele transverse."
                >
                  <select
                    id="niveau_scolaire_id"
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    className={getInputClassName(Boolean(fieldState.error))}
                  >
                    <option value="">Tous les niveaux</option>
                    {niveaux.map((niveau) => (
                      <option key={niveau.id} value={niveau.id}>
                        {niveau.nom}
                      </option>
                    ))}
                  </select>
                </FieldWrapper>
              )}
            />

            <Controller
              control={control}
              name="nom"
              render={({ field, fieldState }) => (
                <FieldWrapper
                  id="nom"
                  label="Nom du modele"
                  required
                  error={fieldState.error?.message}
                >
                  <input
                    id="nom"
                    type="text"
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    placeholder="Ex: Bulletin standard college"
                    className={getInputClassName(Boolean(fieldState.error))}
                  />
                </FieldWrapper>
              )}
            />

            <Controller
              control={control}
              name="template_type"
              render={({ field, fieldState }) => (
                <FieldWrapper
                  id="template_type"
                  label="Type de modele"
                  required
                  error={fieldState.error?.message}
                >
                  <select
                    id="template_type"
                    value={field.value}
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    className={getInputClassName(Boolean(fieldState.error))}
                  >
                    {(
                      [
                        "STANDARD",
                        "DETAILED",
                        "ASSESSMENT_TYPE_SUMMARY",
                        "FINAL_EXAM_ONLY",
                        "CUSTOM",
                      ] as ReportCardTemplateType[]
                    ).map((value) => (
                      <option key={value} value={value}>
                        {getReportCardTemplateTypeLabel(value)}
                      </option>
                    ))}
                  </select>
                </FieldWrapper>
              )}
            />

            <Controller
              control={control}
              name="description"
              render={({ field, fieldState }) => (
                <FieldWrapper
                  id="description"
                  label="Description"
                  error={fieldState.error?.message}
                  className="md:col-span-2"
                >
                  <textarea
                    id="description"
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    rows={3}
                    placeholder="Usage conseille, contexte d'etablissement, niveau vise..."
                    className={getInputClassName(Boolean(fieldState.error))}
                  />
                </FieldWrapper>
              )}
            />
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <FiLayers />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Affichage pedagogique</h3>
              <p className="text-sm text-slate-500">
                Choisis le niveau de detail des matieres, domaines, sous-domaines et competences dans le bulletin.
              </p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <Controller
              control={control}
              name="pedagogical_display_mode"
              render={({ field, fieldState }) => (
                <FieldWrapper
                  id="pedagogical_display_mode"
                  label="Mode pedagogique"
                  required
                  error={fieldState.error?.message}
                  description="Le mode pilote la profondeur d'affichage par defaut."
                >
                  <select
                    id="pedagogical_display_mode"
                    value={field.value}
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    className={getInputClassName(Boolean(fieldState.error))}
                  >
                    {(
                      [
                        "SUBJECTS_ONLY",
                        "SUBJECTS_AND_DOMAINS",
                        "FULL_HIERARCHY",
                        "COMPETENCIES_ONLY",
                        "CUSTOM",
                      ] as PedagogicalDisplayMode[]
                    ).map((value) => (
                      <option key={value} value={value}>
                        {getPedagogicalDisplayModeLabel(value)}
                      </option>
                    ))}
                  </select>
                </FieldWrapper>
              )}
            />

            <Controller
              control={control}
              name="max_hierarchy_depth"
              render={({ field, fieldState }) => (
                <FieldWrapper
                  id="max_hierarchy_depth"
                  label="Profondeur maximale"
                  error={fieldState.error?.message}
                  description="1 = matieres, 2 = groupes/domaines, 3 = sous-domaines, 4 = competences, 5 = objectifs."
                >
                  <input
                    id="max_hierarchy_depth"
                    type="number"
                    min={1}
                    max={6}
                    value={normalizeNumberInputValue(field.value, 1)}
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    className={getInputClassName(Boolean(fieldState.error))}
                  />
                </FieldWrapper>
              )}
            />

            <Controller
              control={control}
              name="calculation_mode"
              render={({ field, fieldState }) => (
                <FieldWrapper
                  id="calculation_mode"
                  label="Mode de calcul"
                  error={fieldState.error?.message}
                  description="Choisit comment les resultats remontent dans la hierarchie et la moyenne generale."
                >
                  <select
                    id="calculation_mode"
                    value={field.value}
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    className={getInputClassName(Boolean(fieldState.error))}
                  >
                    <option value="HIERARCHICAL">Hierarchique</option>
                    <option value="SIMPLE">Simple</option>
                    <option value="WEIGHTED">Pondere par poids</option>
                    <option value="COEFFICIENT_BASED">Base coefficients</option>
                  </select>
                </FieldWrapper>
              )}
            />

            <Controller
              control={control}
              name="non_evaluated_label"
              render={({ field, fieldState }) => (
                <FieldWrapper
                  id="non_evaluated_label"
                  label="Libelle non evalue"
                  error={fieldState.error?.message}
                  description="Texte affiche pour les elements sans resultat."
                >
                  <input
                    id="non_evaluated_label"
                    type="text"
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    className={getInputClassName(Boolean(fieldState.error))}
                  />
                </FieldWrapper>
              )}
            />

            <Controller
              control={control}
              name="rounding_precision"
              render={({ field, fieldState }) => (
                <FieldWrapper
                  id="rounding_precision"
                  label="Precision d'arrondi"
                  error={fieldState.error?.message}
                  description="Nombre de decimales applique au tableau, au resume et a la legende des codes."
                >
                  <input
                    id="rounding_precision"
                    type="number"
                    min={0}
                    max={4}
                    value={normalizeNumberInputValue(field.value, 2)}
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    className={getInputClassName(Boolean(fieldState.error))}
                  />
                </FieldWrapper>
              )}
            />

            <Controller
              control={control}
              name="base_score"
              render={({ field, fieldState }) => (
                <FieldWrapper
                  id="base_score"
                  label="Base de note"
                  error={fieldState.error?.message}
                  description="Optionnel. Convertit les notes sur cette base si aucune echelle ne fixe deja une base."
                >
                  <input
                    id="base_score"
                    type="number"
                    min={1}
                    step="0.5"
                    value={normalizeNumberInputValue(field.value)}
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    className={getInputClassName(Boolean(fieldState.error))}
                    placeholder="Ex: 10 ou 20"
                  />
                </FieldWrapper>
              )}
            />

            <Controller
              control={control}
              name="minimum_required_results"
              render={({ field, fieldState }) => (
                <FieldWrapper
                  id="minimum_required_results"
                  label="Minimum de resultats"
                  error={fieldState.error?.message}
                  description="Nombre minimum de notes calculables requis pour afficher une moyenne."
                >
                  <input
                    id="minimum_required_results"
                    type="number"
                    min={1}
                    max={50}
                    value={normalizeNumberInputValue(field.value, 1)}
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    className={getInputClassName(Boolean(fieldState.error))}
                  />
                </FieldWrapper>
              )}
            />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(
              [
                ["show_subjects", "Afficher les matieres principales"],
                ["show_groups", "Afficher les groupes de matieres"],
                ["show_domains", "Afficher les domaines"],
                ["show_subdomains", "Afficher les sous-domaines"],
                ["show_competencies", "Afficher les competences"],
                ["show_objectives", "Afficher les objectifs"],
                ["show_only_evaluated_items", "Afficher uniquement les elements evalues"],
                ["show_non_evaluated_items", "Afficher les elements non evalues"],
                ["exclude_non_evaluated_items", "Ignorer les non evalues dans les calculs"],
                ["use_weights", "Utiliser les poids des evaluations et elements"],
                ["use_coefficients", "Utiliser les coefficients des matieres"],
                ["group_items_by_parent", "Regrouper les elements sous leur parent"],
                ["show_hierarchical_indent", "Afficher l'indentation hierarchique"],
                ["show_subject_summary", "Afficher le resultat global de chaque matiere"],
                ["show_domain_summary", "Afficher le resultat global de chaque domaine"],
                ["show_subdomain_summary", "Afficher le resultat global des sous-domaines"],
                ["show_competency_results", "Afficher les resultats de competences"],
              ] as const
            ).map(([name, label]) => (
              <Controller
                key={name}
                control={control}
                name={name}
                render={({ field }) => (
                  <label className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(field.value)}
                      onChange={(event) => field.onChange(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                    />
                    <span className="font-medium text-slate-900">{label}</span>
                  </label>
                )}
              />
            ))}
          </div>

          <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h4 className="text-base font-semibold text-slate-900">
                  Arbre pedagogique du modele
                </h4>
                <p className="mt-1 text-sm text-slate-500">
                  Coche les elements a afficher. L'ordre est repris depuis la structure pedagogique et peut etre affine plus tard.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
                <a
                  href="/pedagogie/structure_pedagogique"
                  className="inline-flex shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
                >
                  Ouvrir la structure pedagogique
                </a>
                <div className="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                  {flatPedagogicalItems.length} element(s)
                </div>
              </div>
            </div>

            {flatPedagogicalItems.length > 0 ? (
              <div className="mt-5 space-y-3">
                {flatPedagogicalItems.map(({ node, depth }, index) => {
                  const selection = selectionByItemId.get(node.id);
                  const visible = selection?.is_visible ?? false;

                  return (
                    <div
                      key={node.id}
                      className="rounded-[20px] border border-slate-200 bg-white px-4 py-4"
                      style={{ marginLeft: depth * 16 }}
                    >
                      <div className="flex flex-wrap items-start gap-3">
                        <label className="flex flex-1 items-start gap-3">
                          <input
                            type="checkbox"
                            checked={visible}
                            onChange={(event) =>
                              upsertPedagogicalSelection(node, {
                                is_visible: event.target.checked,
                                display_order:
                                  selection?.display_order ??
                                  (typeof node.display_order === "number"
                                    ? node.display_order
                                    : index),
                              })
                            }
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                          />
                          <span>
                            <span className="block font-semibold text-slate-900">
                              {selection?.custom_label?.trim() || node.nom}
                            </span>
                            <span className="mt-1 block text-xs text-slate-500">
                              {getPedagogicalItemTypeLabel(node.item_type)}
                              {node.parent?.nom ? ` • parent: ${node.parent.nom}` : ""}
                            </span>
                          </span>
                        </label>

                        <div className="grid flex-1 gap-3 md:grid-cols-3">
                          <input
                            type="text"
                            value={selection?.custom_label ?? ""}
                            onChange={(event) =>
                              upsertPedagogicalSelection(node, {
                                custom_label: event.target.value || null,
                              })
                            }
                            placeholder="Libelle personnalise"
                            className={getInputClassName(false)}
                          />
                          <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={selection?.show_result ?? true}
                              onChange={(event) =>
                                upsertPedagogicalSelection(node, {
                                  show_result: event.target.checked,
                                })
                              }
                              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                            />
                            Afficher resultat
                          </label>
                          <label className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={selection?.show_children ?? true}
                              onChange={(event) =>
                                upsertPedagogicalSelection(node, {
                                  show_children: event.target.checked,
                                })
                              }
                              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                            />
                            Afficher enfants
                          </label>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
                Aucun element pedagogique disponible pour ce niveau ou cette annee.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <FiLayers />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Options d'affichage</h3>
              <p className="text-sm text-slate-500">
                Les options sauvegardees ici pilotent directement l'apercu et le rendu du bulletin.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {toggleFields.map(([name, title, description]) => (
              <Controller
                key={name}
                control={control}
                name={name}
                render={({ field }) => (
                  <label className="flex items-start gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(field.value)}
                      onChange={(event) => field.onChange(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                    />
                    <span>
                      <span className="block font-semibold text-slate-900">{title}</span>
                      <span className="mt-1 block text-slate-600">{description}</span>
                    </span>
                  </label>
                )}
              />
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <FiFileText />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Apercu metier</h3>
              <p className="text-sm text-slate-500">
                L'apercu utilise un vrai bulletin existant de l'annee courante pour verifier le rendu final.
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <FieldWrapper
              id="preview_bulletin_id"
              label="Bulletin de reference"
              description="Choisis un bulletin existant pour tester le modele sans le publier."
            >
              <select
                id="preview_bulletin_id"
                value={previewBulletinId}
                onChange={(event) => setPreviewBulletinId(event.target.value)}
                className={getInputClassName(false)}
              >
                <option value="">Selectionner un bulletin</option>
                {bulletins.map((bulletin) => (
                  <option key={bulletin.id} value={bulletin.id}>
                    {getBulletinDisplayLabel(bulletin)}
                  </option>
                ))}
              </select>
            </FieldWrapper>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => void handlePreview()}
                disabled={previewLoading || !previewBulletinId}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {previewLoading ? <Spin inline /> : null}
                <span>Generer l'apercu</span>
              </button>
            </div>
          </div>

          {bulletins.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Aucun bulletin n'est encore disponible pour servir de reference de previsualisation.
            </div>
          ) : null}

          {previewSnapshot ? (
            <div className="mt-6 space-y-4">
              {previewSnapshot.warnings.length > 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {previewSnapshot.warnings.join(" ")}
                </div>
              ) : null}

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {previewSnapshot.columns.map((column) => (
                          <th
                            key={column.key}
                            className="px-4 py-3 text-left font-semibold text-slate-700"
                          >
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {previewSnapshot.lines.map((line) => (
                        <tr
                          key={line.row_id}
                          className={
                            line.row_type === "section_header"
                              ? "bg-slate-100 font-semibold text-slate-900"
                              : undefined
                          }
                        >
                          {previewSnapshot.columns.map((column) => (
                            <td
                              key={`${line.row_id}-${column.key}`}
                              className={`px-4 py-3 align-top ${
                                line.row_type === "section_header"
                                  ? "text-slate-900"
                                  : "text-slate-700"
                              }`}
                            >
                              {line.row_type === "section_header" && column.key !== previewSnapshot.columns[0]?.key
                                ? ""
                                : line.display_cells[column.key] ?? "-"}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {previewSummaryCards.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {previewSummaryCards.map((item) => (
                    <div
                      key={item.key}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {item.label}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  Aucune synthese globale n'est affichee avec la configuration actuelle.
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                {previewSnapshot.template.show_section_headers ? (
                  <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                    Entetes de section actifs
                  </div>
                ) : null}
                {previewSnapshot.template.show_logo ? (
                  <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                    Logo actif
                  </div>
                ) : null}
                {previewSnapshot.template.show_signature ? (
                  <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                    Zone de signature active
                  </div>
                ) : null}
              </div>

              {previewSnapshot.template.show_code_legend &&
              previewSnapshot.code_legend?.length ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Legende des codes
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {previewSnapshot.code_legend.map((legend) => (
                      <div
                        key={`${legend.grading_scale_id ?? "default"}-${legend.code}`}
                        className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                      >
                        <span className="font-semibold text-slate-900">
                          {legend.code}
                        </span>{" "}
                        = {legend.label}
                        {typeof legend.numeric_value === "number"
                          ? ` (${formatSummaryValue(
                              legend.numeric_value,
                              previewSnapshot.template.rounding_precision ?? 2,
                            )})`
                          : ""}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <div className="flex justify-end gap-3">
          {editingItem ? (
            <button
              type="button"
              onClick={() => {
                clearEditingItem();
                setRenderedComponent("list");
              }}
              className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Retour a la liste
            </button>
          ) : null}
          <button
            type="submit"
            disabled={formState.isSubmitting}
            className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {formState.isSubmitting ? <Spin inline /> : null}
            <span>{editingItem ? "Mettre a jour" : "Enregistrer le modele"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

export default ReportCardTemplateForm;
