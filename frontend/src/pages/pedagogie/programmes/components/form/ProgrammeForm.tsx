import React, { useEffect, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FiAlertTriangle,
  FiBookOpen,
  FiClock,
  FiGitBranch,
  FiList,
  FiPlus,
  FiRefreshCw,
  FiSave,
  FiShield,
  FiTrash2,
} from "react-icons/fi";
import ProgrammeService, {
  type ProgrammeImpactAnalysisResponse,
  type ProgrammeLine,
  type ProgrammeWithRelations,
} from "../../../../../services/programme.service";
import { useAuth } from "../../../../../auth/AuthContext";
import {
  type ProgrammeCreateInput,
  type ProgrammeEditorLineInput,
  useProgrammeCreateStore,
} from "../../store/ProgrammeCreateStore";
import Spin from "../../../../../components/anim/Spin";
import { useInfo } from "../../../../../hooks/useInfo";
import { FieldWrapper } from "../../../../../components/Form/fields/FieldWrapper";
import { getInputClassName } from "../../../../../components/Form/fields/inputStyles";

type ProgrammeLineForm = ProgrammeEditorLineInput & {
  heures_annuelles: number | null;
  seances_par_semaine: number | null;
  duree_seance_par_defaut: number | null;
  est_obligatoire: boolean;
  est_visible_bulletin: boolean;
  inclure_moyenne_generale: boolean;
  appreciation_obligatoire: boolean;
  libelle_bulletin: string | null;
  ordre_affichage_bulletin: number | null;
  grading_scale_id: string | null;
  mode_calcul: string;
  statut: string;
};

type ProgrammeFormValues = {
  etablissement_id: string;
  annee_scolaire_id: string;
  niveau_scolaire_id: string;
  nom: string;
  code: string;
  description: string;
  statut: "DRAFT" | "ACTIVE" | "IN_REVISION" | "LOCKED" | "ARCHIVED";
  date_debut: string;
  date_fin: string;
  est_actif: boolean;
  ordre_affichage: number;
  default_grading_scale_id: string;
  reason: string;
  confirm_sensitive_changes: boolean;
  recalculate_draft_report_cards: boolean;
  regenerate_unpublished_bulletins: boolean;
  sync_existing_courses_mode: string;
  matieres: ProgrammeLineForm[];
};

type ChangeLogEntry = {
  id: string;
  entity_type?: string | null;
  action?: string | null;
  field_name?: string | null;
  reason?: string | null;
  changed_at?: string | Date | null;
  old_value_json?: unknown;
  new_value_json?: unknown;
  impact_summary_json?: unknown;
  changedBy?: {
    id: string;
    prenom?: string | null;
    nom?: string | null;
    email?: string | null;
  } | null;
};

type TabId = "general" | "matieres" | "impact" | "historique";

const PROGRAMME_STATUS_OPTIONS = [
  { value: "DRAFT", label: "Brouillon" },
  { value: "ACTIVE", label: "Actif" },
  { value: "IN_REVISION", label: "En revision" },
  { value: "LOCKED", label: "Verrouille" },
  { value: "ARCHIVED", label: "Archive" },
] as const;

const CALCULATION_MODE_OPTIONS = [
  { value: "WEIGHTED_AVERAGE", label: "Moyenne ponderee" },
  { value: "SIMPLE_AVERAGE", label: "Moyenne simple" },
  { value: "NONE", label: "Aucun" },
  { value: "SUM", label: "Somme" },
  { value: "MANUAL", label: "Manuel" },
] as const;

const PROGRAMME_SUBJECT_STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "DISABLED", label: "Desactivee" },
] as const;

const SYNC_MODE_OPTIONS = [
  { value: "", label: "Ne pas synchroniser automatiquement" },
  { value: "PROGRAM_ONLY", label: "Appliquer au programme seulement" },
  { value: "ALL_EXISTING", label: "Mettre a jour tous les cours lies" },
  { value: "COURSES_WITHOUT_NOTES", label: "Seulement les cours sans notes" },
  { value: "NEW_ONLY", label: "Seulement les nouveaux cours" },
] as const;

const FORM_TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: "general", label: "Informations generales", icon: <FiList /> },
  { id: "matieres", label: "Matieres", icon: <FiBookOpen /> },
  { id: "impact", label: "Impact et synchronisation", icon: <FiAlertTriangle /> },
  { id: "historique", label: "Historique", icon: <FiShield /> },
];

const emptyLine: ProgrammeLineForm = {
  matiere_id: "",
  heures_semaine: null,
  heures_annuelles: null,
  seances_par_semaine: null,
  duree_seance_par_defaut: null,
  coefficient: null,
  est_obligatoire: true,
  est_visible_bulletin: true,
  inclure_moyenne_generale: true,
  appreciation_obligatoire: false,
  libelle_bulletin: null,
  ordre_affichage_bulletin: null,
  grading_scale_id: null,
  mode_calcul: "WEIGHTED_AVERAGE",
  statut: "ACTIVE",
};

function asTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseNullableInt(value: unknown) {
  if (value === "" || value === undefined || value === null) return null;
  return Number(value);
}

function normalizeDateInputValue(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function normalizeTextAreaValue(value: string | null | undefined) {
  return value ?? "";
}

function normalizeNumberInputValue(value: unknown, fallback: string | number = "") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === "string") {
    return value;
  }
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function getBooleanImpactClass(value: boolean) {
  return value
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-slate-200 bg-white text-slate-600";
}

function getStatusBadgeClass(status?: string | null) {
  switch (status) {
    case "ACTIVE":
      return "bg-emerald-100 text-emerald-700";
    case "IN_REVISION":
      return "bg-amber-100 text-amber-700";
    case "LOCKED":
      return "bg-rose-100 text-rose-700";
    case "ARCHIVED":
      return "bg-slate-200 text-slate-700";
    default:
      return "bg-sky-100 text-sky-700";
  }
}

function formatChangeActor(entry: ChangeLogEntry) {
  const prenom = entry.changedBy?.prenom?.trim() ?? "";
  const nom = entry.changedBy?.nom?.trim() ?? "";
  const fullName = [prenom, nom].filter(Boolean).join(" ");
  return fullName || entry.changedBy?.email || "Utilisateur systeme";
}

function formatChangeDate(value?: string | Date | null) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatJsonPreview(value: unknown) {
  if (value === undefined || value === null) return "-";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getImpactTotal(impact?: ProgrammeImpactAnalysisResponse["impact"] | null) {
  if (!impact) return 0;
  return (
    impact.classesCount +
    impact.generatedCoursesCount +
    impact.teachersCount +
    impact.studentsCount +
    impact.evaluationsCount +
    impact.notesCount +
    impact.assessmentResultsCount +
    impact.draftReportCardsCount +
    impact.validatedReportCardsCount +
    impact.publishedReportCardsCount
  );
}

function buildImpactConfirmationMessage(analysis: ProgrammeImpactAnalysisResponse) {
  const { impact, changes } = analysis;
  const lines = [
    "Cette modification va impacter :",
    `- ${impact.classesCount} classe(s)`,
    `- ${impact.generatedCoursesCount} cours genere(s)`,
    `- ${impact.teachersCount} enseignant(s)`,
    `- ${impact.studentsCount} eleve(s)`,
    `- ${impact.evaluationsCount} evaluation(s)`,
    `- ${impact.notesCount} note(s)`,
    `- ${impact.draftReportCardsCount} bulletin(s) brouillon(s)`,
    `- ${impact.validatedReportCardsCount} bulletin(s) valide(s)`,
    `- ${impact.publishedReportCardsCount} bulletin(s) publie(s)`,
  ];

  if (changes.length > 0) {
    lines.push("", "Changements sensibles detects :");
    changes.slice(0, 8).forEach((change) => {
      const label = change.fieldName
        ? `${change.entityType} / ${change.fieldName}`
        : change.entityType;
      lines.push(`- ${change.action} (${label})`);
    });
  }

  lines.push("", "Voulez-vous continuer ?");
  return lines.join("\n");
}

function mapProgrammeLine(line?: Partial<ProgrammeLine> | null): ProgrammeLineForm {
  return {
    id: line?.id,
    matiere_id: line?.matiere_id ?? "",
    heures_semaine: line?.heures_semaine ?? null,
    heures_annuelles: line?.heures_annuelles ?? null,
    seances_par_semaine: line?.seances_par_semaine ?? null,
    duree_seance_par_defaut: line?.duree_seance_par_defaut ?? null,
    coefficient: line?.coefficient ?? null,
    est_obligatoire: line?.est_obligatoire ?? true,
    est_visible_bulletin: line?.est_visible_bulletin ?? true,
    inclure_moyenne_generale: line?.inclure_moyenne_generale ?? true,
    appreciation_obligatoire: line?.appreciation_obligatoire ?? false,
    libelle_bulletin: line?.libelle_bulletin ?? null,
    ordre_affichage_bulletin: line?.ordre_affichage_bulletin ?? null,
    grading_scale_id: line?.grading_scale_id ?? null,
    mode_calcul: line?.mode_calcul ?? "WEIGHTED_AVERAGE",
    statut: line?.statut ?? "ACTIVE",
  };
}

function mapProgrammeToFormValues(
  initialData: ProgrammeCreateInput | null | undefined,
  etablissementId: string | null,
): ProgrammeFormValues {
  return {
    etablissement_id: initialData?.etablissement_id ?? etablissementId ?? "",
    annee_scolaire_id: initialData?.annee_scolaire_id ?? "",
    niveau_scolaire_id: initialData?.niveau_scolaire_id ?? "",
    nom: initialData?.nom ?? "",
    code: initialData?.code ?? "",
    description: normalizeTextAreaValue(initialData?.description),
    statut:
      (initialData?.statut as ProgrammeFormValues["statut"] | undefined) ??
      "DRAFT",
    date_debut: normalizeDateInputValue(initialData?.date_debut),
    date_fin: normalizeDateInputValue(initialData?.date_fin),
    est_actif: initialData?.est_actif ?? false,
    ordre_affichage: initialData?.ordre_affichage ?? 0,
    default_grading_scale_id: initialData?.default_grading_scale_id ?? "",
    reason: "",
    confirm_sensitive_changes: false,
    recalculate_draft_report_cards: true,
    regenerate_unpublished_bulletins: false,
    sync_existing_courses_mode: "",
    matieres:
      initialData?.matieres && initialData.matieres.length > 0
        ? initialData.matieres.map((line) => mapProgrammeLine(line))
        : [{ ...emptyLine }],
  };
}

const lineSchema = z.object({
  id: z.string().optional(),
  matiere_id: z.string().min(1, "La matiere est requise."),
  heures_semaine: z.preprocess(
    parseNullableInt,
    z
      .number()
      .int("Le volume horaire doit etre un entier.")
      .min(0, "Le volume horaire doit etre positif ou nul.")
      .max(80, "Le volume horaire semble trop eleve.")
      .nullable(),
  ),
  heures_annuelles: z.preprocess(
    parseNullableInt,
    z
      .number()
      .int("Le volume annuel doit etre un entier.")
      .min(0, "Le volume annuel doit etre positif ou nul.")
      .max(5000, "Le volume annuel semble trop eleve.")
      .nullable(),
  ),
  seances_par_semaine: z.preprocess(
    parseNullableInt,
    z
      .number()
      .int("Le nombre de seances doit etre un entier.")
      .min(0, "Le nombre de seances doit etre positif ou nul.")
      .max(40, "Le nombre de seances semble trop eleve.")
      .nullable(),
  ),
  duree_seance_par_defaut: z.preprocess(
    parseNullableInt,
    z
      .number()
      .int("La duree doit etre un entier.")
      .min(0, "La duree doit etre positive ou nulle.")
      .max(600, "La duree semble trop elevee.")
      .nullable(),
  ),
  coefficient: z.preprocess(
    parseNullableInt,
    z
      .number()
      .min(0, "Le coefficient doit etre positif ou nul.")
      .max(100, "Le coefficient semble trop eleve.")
      .nullable(),
  ),
  est_obligatoire: z.boolean(),
  est_visible_bulletin: z.boolean(),
  inclure_moyenne_generale: z.boolean(),
  appreciation_obligatoire: z.boolean(),
  libelle_bulletin: z.string().max(150, "Le libelle bulletin est trop long.").nullable(),
  ordre_affichage_bulletin: z.preprocess(
    parseNullableInt,
    z
      .number()
      .int("L'ordre doit etre un entier.")
      .min(0, "L'ordre d'affichage doit etre positif ou nul.")
      .max(9999, "L'ordre d'affichage semble trop eleve.")
      .nullable(),
  ),
  grading_scale_id: z.string().nullable(),
  mode_calcul: z.string().min(1, "Le mode de calcul est requis."),
  statut: z.string().min(1, "Le statut de la matiere est requis."),
});

const programmeSchema = z
  .object({
    etablissement_id: z.string().min(1, "L'etablissement est requis."),
    annee_scolaire_id: z.string().min(1, "L'annee scolaire est requise."),
    niveau_scolaire_id: z.string().min(1, "Le niveau scolaire est requis."),
    nom: z
      .string()
      .trim()
      .min(2, "Le nom du programme est requis.")
      .max(120, "Le nom du programme est trop long.")
      .transform((value) => value.replace(/\s+/g, " ")),
    code: z
      .string()
      .trim()
      .max(40, "Le code est trop long.")
      .optional()
      .transform((value) => value ?? ""),
    description: z
      .string()
      .max(2000, "La description est trop longue.")
      .optional()
      .transform((value) => value ?? ""),
    statut: z.enum(["DRAFT", "ACTIVE", "IN_REVISION", "LOCKED", "ARCHIVED"]),
    date_debut: z.string().optional().transform((value) => value ?? ""),
    date_fin: z.string().optional().transform((value) => value ?? ""),
    est_actif: z.boolean(),
    ordre_affichage: z.preprocess(
      (value) => {
        if (value === "" || value === undefined || value === null) return 0;
        return Number(value);
      },
      z
        .number()
        .int("L'ordre d'affichage doit etre un entier.")
        .min(0, "L'ordre d'affichage doit etre positif ou nul.")
        .max(9999, "L'ordre d'affichage semble trop eleve."),
    ),
    default_grading_scale_id: z.string().optional().transform((value) => value ?? ""),
    reason: z
      .string()
      .max(600, "Le motif est trop long.")
      .optional()
      .transform((value) => value ?? ""),
    confirm_sensitive_changes: z.boolean(),
    recalculate_draft_report_cards: z.boolean(),
    regenerate_unpublished_bulletins: z.boolean(),
    sync_existing_courses_mode: z.string().optional().transform((value) => value ?? ""),
    matieres: z.array(lineSchema).min(1, "Ajoute au moins une matiere au programme."),
  })
  .superRefine((value, ctx) => {
    const ids = value.matieres.map((item) => item.matiere_id).filter(Boolean);
    if (new Set(ids).size !== ids.length) {
      value.matieres.forEach((item, index) => {
        if (!item.matiere_id) return;
        if (ids.filter((id) => id === item.matiere_id).length > 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Cette matiere est deja presente dans le programme.",
            path: ["matieres", index, "matiere_id"],
          });
        }
      });
    }

    if (value.date_debut && value.date_fin) {
      const start = new Date(value.date_debut);
      const end = new Date(value.date_fin);
      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end < start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La date de fin doit etre posterieure a la date de debut.",
          path: ["date_fin"],
        });
      }
    }
  });

function ProgrammeForm() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();
  const service = useMemo(() => new ProgrammeService(), []);
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const [impactAnalysis, setImpactAnalysis] =
    useState<ProgrammeImpactAnalysisResponse | null>(null);
  const [isAnalyzingImpact, setIsAnalyzingImpact] = useState(false);
  const [changeLogs, setChangeLogs] = useState<ChangeLogEntry[]>([]);
  const [changeLogsLoading, setChangeLogsLoading] = useState(false);

  const loading = useProgrammeCreateStore((state) => state.loading);
  const errorMessage = useProgrammeCreateStore((state) => state.errorMessage);
  const initialData = useProgrammeCreateStore((state) => state.initialData);
  const setInitialData = useProgrammeCreateStore((state) => state.setInitialData);
  const clearInitialData = useProgrammeCreateStore((state) => state.clearInitialData);
  const anneeScolaireOptions = useProgrammeCreateStore(
    (state) => state.anneeScolaireOptions,
  );
  const niveauOptions = useProgrammeCreateStore((state) => state.niveauOptions);
  const matiereOptions = useProgrammeCreateStore((state) => state.matiereOptions);
  const gradingScaleOptions = useProgrammeCreateStore(
    (state) => state.gradingScaleOptions,
  );
  const getOptions = useProgrammeCreateStore((state) => state.getOptions);

  const isEditMode = Boolean(initialData?.id);
  const currentStatus = (initialData?.statut ?? "DRAFT") as ProgrammeFormValues["statut"];
  const isArchived = currentStatus === "ARCHIVED";

  useEffect(() => {
    if (etablissement_id) {
      void getOptions(etablissement_id);
    }
  }, [etablissement_id, getOptions]);

  useEffect(() => {
    setImpactAnalysis(
      initialData?.impact
        ? {
            impact: initialData.impact,
            changes: [],
            requiresConfirmation: false,
          }
        : null,
    );
  }, [initialData?.id, initialData?.impact]);

  useEffect(() => {
    if (!initialData?.id) {
      setChangeLogs([]);
      return;
    }

    let isMounted = true;
    setChangeLogsLoading(true);
    service
      .getChangeLogs(initialData.id)
      .then((result) => {
        if (!isMounted) return;
        setChangeLogs(Array.isArray(result.data) ? (result.data as ChangeLogEntry[]) : []);
      })
      .catch(() => {
        if (!isMounted) return;
        setChangeLogs([]);
      })
      .finally(() => {
        if (isMounted) {
          setChangeLogsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [initialData?.id, service]);

  const defaultValues = useMemo<ProgrammeFormValues>(
    () => mapProgrammeToFormValues(initialData, etablissement_id),
    [etablissement_id, initialData],
  );

  const form = useForm<z.input<typeof programmeSchema>, undefined, z.output<typeof programmeSchema>>({
    resolver: zodResolver(programmeSchema),
    defaultValues,
    mode: "onSubmit",
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const { control, handleSubmit, formState, reset, watch } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: "matieres",
  });

  const lines = watch("matieres");
  const watchedStatus = watch("statut");
  const watchedReason = watch("reason");
  const watchedSyncMode = watch("sync_existing_courses_mode");
  const watchedRecalculateDrafts = watch("recalculate_draft_report_cards");
  const watchedRegenerateUnpublished = watch("regenerate_unpublished_bulletins");
  const currentImpact = impactAnalysis?.impact ?? initialData?.impact ?? null;
  const impactTotal = getImpactTotal(currentImpact);
  const hasUsage = impactTotal > 0;
  const disableAcademicYear = isEditMode && hasUsage;
  const disableLevel = isEditMode && (currentImpact?.generatedCoursesCount ?? 0) > 0;

  const resetCreateForm = React.useCallback(() => {
    const nextValues = mapProgrammeToFormValues(
      {
        etablissement_id: etablissement_id ?? "",
        annee_scolaire_id:
          defaultValues.annee_scolaire_id || initialData?.annee_scolaire_id || "",
      } as Partial<ProgrammeWithRelations>,
      etablissement_id,
    );
    reset(nextValues);
    clearInitialData();
    setImpactAnalysis(null);
    setChangeLogs([]);
    setActiveTab("general");
  }, [
    clearInitialData,
    defaultValues.annee_scolaire_id,
    etablissement_id,
    initialData?.annee_scolaire_id,
    reset,
  ]);

  const buildPayload = (data: ProgrammeFormValues) => ({
    etablissement_id: data.etablissement_id,
    annee_scolaire_id: data.annee_scolaire_id,
    niveau_scolaire_id: data.niveau_scolaire_id,
    nom: data.nom,
    code: asTrimmedString(data.code) || null,
    description: asTrimmedString(data.description) || null,
    statut: data.statut,
    date_debut: asTrimmedString(data.date_debut) || null,
    date_fin: asTrimmedString(data.date_fin) || null,
    est_actif: data.est_actif,
    ordre_affichage: data.ordre_affichage ?? 0,
    default_grading_scale_id: asTrimmedString(data.default_grading_scale_id) || null,
    reason: asTrimmedString(data.reason) || null,
    confirm_sensitive_changes: data.confirm_sensitive_changes,
    recalculate_draft_report_cards: data.recalculate_draft_report_cards,
    regenerate_unpublished_bulletins: data.regenerate_unpublished_bulletins,
    sync_existing_courses_mode: asTrimmedString(data.sync_existing_courses_mode) || null,
    matieres: data.matieres.map((line) => ({
      id: line.id,
      matiere_id: line.matiere_id,
      heures_semaine: line.heures_semaine,
      heures_annuelles: line.heures_annuelles,
      seances_par_semaine: line.seances_par_semaine,
      duree_seance_par_defaut: line.duree_seance_par_defaut,
      coefficient: line.coefficient,
      est_obligatoire: line.est_obligatoire,
      est_visible_bulletin: line.est_visible_bulletin,
      inclure_moyenne_generale: line.inclure_moyenne_generale,
      appreciation_obligatoire: line.appreciation_obligatoire,
      libelle_bulletin: asTrimmedString(line.libelle_bulletin ?? "") || null,
      ordre_affichage_bulletin: line.ordre_affichage_bulletin,
      grading_scale_id: asTrimmedString(line.grading_scale_id ?? "") || null,
      mode_calcul: line.mode_calcul,
      statut: line.statut,
    })),
  });

  const refreshChangeLogs = React.useCallback(async (programmeId: string) => {
    setChangeLogsLoading(true);
    try {
      const result = await service.getChangeLogs(programmeId);
      setChangeLogs(Array.isArray(result.data) ? (result.data as ChangeLogEntry[]) : []);
    } catch {
      setChangeLogs([]);
    } finally {
      setChangeLogsLoading(false);
    }
  }, [service]);

  const refreshProgrammeAfterUpdate = React.useCallback(
    async (programmeId: string) => {
      const result = await service.get(programmeId);
      const programme = result.data as ProgrammeWithRelations;
      setInitialData({
        ...programme,
        matieres: (programme.matieres ?? []).map((line) => mapProgrammeLine(line)),
      });
      setImpactAnalysis(
        programme.impact
          ? {
              impact: programme.impact,
              changes: [],
              requiresConfirmation: false,
            }
          : null,
      );
      await refreshChangeLogs(programmeId);
    },
    [refreshChangeLogs, service, setInitialData],
  );

  const runImpactAnalysis = React.useCallback(
    async (values?: ProgrammeFormValues) => {
      if (!initialData?.id) return null;
      const currentValues = (values ?? form.getValues()) as ProgrammeFormValues;
      const payload = buildPayload(currentValues);
      setIsAnalyzingImpact(true);
      try {
        const result = await service.analyzeImpact(initialData.id, payload);
        const analysis = result.data as ProgrammeImpactAnalysisResponse;
        setImpactAnalysis(analysis);
        setActiveTab("impact");
        return analysis;
      } catch {
        info("Analyse d'impact indisponible pour le moment.", "error");
        return null;
      } finally {
        setIsAnalyzingImpact(false);
      }
    },
    [buildPayload, form, info, initialData?.id, service],
  );

  const onSubmit = async (data: ProgrammeFormValues) => {
    if (isArchived) {
      info("Ce programme est archive et disponible uniquement en lecture.", "warning");
      return;
    }

    const payload = buildPayload(data);

    try {
      if (isEditMode && initialData?.id) {
        const analysis = await runImpactAnalysis(data);
        if (!analysis) return;
        const requiresConfirmation = analysis?.requiresConfirmation ?? false;

        if (requiresConfirmation && !asTrimmedString(data.reason)) {
          setActiveTab("impact");
          info("Veuillez indiquer un motif pour cette modification.", "warning");
          return;
        }

        if (requiresConfirmation) {
          const confirmed = window.confirm(buildImpactConfirmationMessage(analysis));
          if (!confirmed) return;
        }

        await service.patch(initialData.id, {
          ...payload,
          confirm_sensitive_changes: requiresConfirmation || data.confirm_sensitive_changes,
        });

        await refreshProgrammeAfterUpdate(initialData.id);
        info("Programme modifie avec succes.", "success");
        return;
      }

      await service.create(payload);
      info("Programme cree avec succes !", "success");
      reset({
        ...mapProgrammeToFormValues(
          {
            etablissement_id: etablissement_id ?? "",
            annee_scolaire_id: defaultValues.annee_scolaire_id,
          } as Partial<ProgrammeWithRelations>,
          etablissement_id,
        ),
        nom: "",
        code: "",
        description: "",
        matieres: [{ ...emptyLine }],
      });
      setImpactAnalysis(null);
      setChangeLogs([]);
      setActiveTab("general");
    } catch (error) {
      console.log(error);
      info(
        isEditMode ? "Programme non modifie." : "Programme non cree.",
        "error",
      );
    }
  };

  return (
    <div className="w-[100%]">
      {loading ? (
        <Spin label="Chargement des ressources..." showLabel />
      ) : (
        <div className="space-y-5">
          {errorMessage ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {errorMessage}
            </div>
          ) : null}

          {(isArchived || watchedStatus === "LOCKED" || hasUsage) && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
              <div className="flex items-start gap-3">
                <FiAlertTriangle className="mt-0.5 text-slate-500" />
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900">
                    {isArchived
                      ? "Programme archive"
                      : watchedStatus === "LOCKED"
                        ? "Programme verrouille"
                        : "Programme deja utilise"}
                  </p>
                  <p>
                    {isArchived
                      ? "Le formulaire passe en lecture seule. Les changements sensibles doivent etre forces par une permission speciale cote serveur."
                      : watchedStatus === "LOCKED"
                        ? "Les modifications restent controlees. Le backend peut les bloquer si votre role ne permet pas de forcer ce changement."
                        : "Certaines modifications, comme le niveau, l'annee scolaire ou les coefficients, peuvent impacter des cours, notes et bulletins deja existants."}
                  </p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {isEditMode ? "Edition du programme" : "Nouveau programme"}
                    </h3>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(currentStatus)}`}
                    >
                      {currentStatus}
                    </span>
                  </div>
                  <p className="text-sm leading-6 text-slate-500">
                    {isEditMode
                      ? "Modifie les informations generales, les matieres et les regles qui structurent ce programme scolaire."
                      : "Definis le cadre du programme puis compose sa liste de matieres, avec les coefficients et volumes utiles."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {isEditMode ? (
                    <button
                      type="button"
                      onClick={() => void runImpactAnalysis()}
                      disabled={isAnalyzingImpact || formState.isSubmitting}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isAnalyzingImpact ? <Spin inline /> : <FiRefreshCw />}
                      <span>Analyser l'impact</span>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={resetCreateForm}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    Reinitialiser
                  </button>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {FORM_TABS.map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                        active
                          ? "bg-slate-900 text-white"
                          : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </section>

            {activeTab === "general" ? (
              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 space-y-2">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Informations generales
                  </h3>
                  <p className="text-sm leading-6 text-slate-500">
                    Cadre principal du programme pour l'annee scolaire courante.
                  </p>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <Controller
                    control={control}
                    name="nom"
                    render={({ field, fieldState }) => (
                      <FieldWrapper
                        id="nom"
                        label="Nom du programme"
                        required
                        error={fieldState.error?.message}
                        className="md:col-span-2"
                        description="Exemple: Programme fondamental, Programme scientifique ou Tronc commun."
                      >
                        <input
                          id="nom"
                          type="text"
                          value={field.value ?? ""}
                          onChange={(event) => field.onChange(event.target.value)}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          placeholder="Ex: Programme du college"
                          disabled={isArchived}
                          className={getInputClassName(Boolean(fieldState.error))}
                        />
                      </FieldWrapper>
                    )}
                  />

                  <Controller
                    control={control}
                    name="code"
                    render={({ field, fieldState }) => (
                      <FieldWrapper
                        id="code"
                        label="Code du programme"
                        error={fieldState.error?.message}
                        description="Unique dans l'annee scolaire de l'etablissement."
                      >
                        <input
                          id="code"
                          type="text"
                          value={field.value ?? ""}
                          onChange={(event) => field.onChange(event.target.value)}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          placeholder="Ex: PROG-COL-2026"
                          disabled={isArchived || currentStatus === "LOCKED"}
                          className={getInputClassName(Boolean(fieldState.error))}
                        />
                      </FieldWrapper>
                    )}
                  />

                  <Controller
                    control={control}
                    name="statut"
                    render={({ field, fieldState }) => (
                      <FieldWrapper
                        id="statut"
                        label="Statut"
                        required
                        error={fieldState.error?.message}
                        description="Le statut pilote le niveau de controle des modifications."
                      >
                        <select
                          id="statut"
                          value={field.value}
                          onChange={(event) =>
                            field.onChange(event.target.value as ProgrammeFormValues["statut"])
                          }
                          onBlur={field.onBlur}
                          ref={field.ref}
                          disabled={isArchived}
                          className={getInputClassName(Boolean(fieldState.error))}
                        >
                          {PROGRAMME_STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </FieldWrapper>
                    )}
                  />

                  <Controller
                    control={control}
                    name="annee_scolaire_id"
                    render={({ field, fieldState }) => (
                      <FieldWrapper
                        id="annee_scolaire_id"
                        label="Annee scolaire"
                        required
                        error={fieldState.error?.message}
                        description={
                          disableAcademicYear
                            ? "L'annee scolaire est verrouillee car le programme est deja utilise."
                            : "L'annee active est preselectionnee quand elle existe."
                        }
                      >
                        <select
                          id="annee_scolaire_id"
                          value={field.value ?? ""}
                          onChange={(event) => field.onChange(event.target.value)}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          disabled={isArchived || disableAcademicYear}
                          className={getInputClassName(Boolean(fieldState.error))}
                        >
                          <option value="">Selectionner une annee</option>
                          {anneeScolaireOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </FieldWrapper>
                    )}
                  />

                  <Controller
                    control={control}
                    name="niveau_scolaire_id"
                    render={({ field, fieldState }) => (
                      <FieldWrapper
                        id="niveau_scolaire_id"
                        label="Niveau scolaire"
                        required
                        error={fieldState.error?.message}
                        description={
                          disableLevel
                            ? "Le niveau est bloque car des cours lies existent deja."
                            : "Le niveau structure ensuite les classes, cours et evaluations."
                        }
                      >
                        <select
                          id="niveau_scolaire_id"
                          value={field.value ?? ""}
                          onChange={(event) => field.onChange(event.target.value)}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          disabled={isArchived || disableLevel}
                          className={getInputClassName(Boolean(fieldState.error))}
                        >
                          <option value="">Selectionner un niveau</option>
                          {niveauOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </FieldWrapper>
                    )}
                  />

                  <Controller
                    control={control}
                    name="date_debut"
                    render={({ field, fieldState }) => (
                      <FieldWrapper
                        id="date_debut"
                        label="Date de debut"
                        error={fieldState.error?.message}
                      >
                        <input
                          id="date_debut"
                          type="date"
                          value={field.value ?? ""}
                          onChange={(event) => field.onChange(event.target.value)}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          disabled={isArchived}
                          className={getInputClassName(Boolean(fieldState.error))}
                        />
                      </FieldWrapper>
                    )}
                  />

                  <Controller
                    control={control}
                    name="date_fin"
                    render={({ field, fieldState }) => (
                      <FieldWrapper
                        id="date_fin"
                        label="Date de fin"
                        error={fieldState.error?.message}
                      >
                        <input
                          id="date_fin"
                          type="date"
                          value={field.value ?? ""}
                          onChange={(event) => field.onChange(event.target.value)}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          disabled={isArchived}
                          className={getInputClassName(Boolean(fieldState.error))}
                        />
                      </FieldWrapper>
                    )}
                  />

                  <Controller
                    control={control}
                    name="ordre_affichage"
                    render={({ field, fieldState }) => (
                      <FieldWrapper
                        id="ordre_affichage"
                        label="Ordre d'affichage"
                        error={fieldState.error?.message}
                      >
                        <input
                          id="ordre_affichage"
                          type="number"
                          min={0}
                          step={1}
                          value={normalizeNumberInputValue(field.value, 0)}
                          onChange={(event) => field.onChange(event.target.value)}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          disabled={isArchived}
                          className={getInputClassName(Boolean(fieldState.error))}
                        />
                      </FieldWrapper>
                    )}
                  />

                  <Controller
                    control={control}
                    name="default_grading_scale_id"
                    render={({ field, fieldState }) => (
                      <FieldWrapper
                        id="default_grading_scale_id"
                        label="Echelle de notation par defaut"
                        error={fieldState.error?.message}
                        description="Peut ensuite etre surchargee par matiere."
                      >
                        <select
                          id="default_grading_scale_id"
                          value={field.value ?? ""}
                          onChange={(event) => field.onChange(event.target.value)}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          disabled={isArchived}
                          className={getInputClassName(Boolean(fieldState.error))}
                        >
                          <option value="">Aucune echelle par defaut</option>
                          {gradingScaleOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
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
                          rows={4}
                          value={field.value ?? ""}
                          onChange={(event) => field.onChange(event.target.value)}
                          onBlur={field.onBlur}
                          ref={field.ref}
                          disabled={isArchived}
                          placeholder="Description, objectifs ou remarques generales du programme."
                          className={getInputClassName(Boolean(fieldState.error))}
                        />
                      </FieldWrapper>
                    )}
                  />

                  <Controller
                    control={control}
                    name="est_actif"
                    render={({ field }) => (
                      <label
                        className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium ${getBooleanImpactClass(field.value)}`}
                      >
                        <div className="pr-3">
                          <p className="font-semibold">Programme actif</p>
                          <p className="mt-1 text-xs font-normal opacity-80">
                            Le programme pourra etre privilegie dans les ecrans pedagogiques.
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={Boolean(field.value)}
                          onChange={(event) => field.onChange(event.target.checked)}
                          disabled={isArchived}
                          className="h-4 w-4"
                        />
                      </label>
                    )}
                  />
                </div>
              </section>
            ) : null}

            {activeTab === "matieres" ? (
              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      Matieres du programme
                    </h3>
                    <p className="text-sm text-slate-500">
                      Gere les coefficients, volumes horaires, regles bulletin et regles de calcul de chaque matiere.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => append({ ...emptyLine })}
                    disabled={isArchived}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <FiPlus />
                    Ajouter une matiere
                  </button>
                </div>

                <div className="mt-5 space-y-4">
                  {fields.map((item, index) => {
                    const selectedIds = lines
                      ?.map((line, lineIndex) =>
                        lineIndex === index ? null : line?.matiere_id,
                      )
                      .filter((value): value is string => Boolean(value));
                    const lineError = formState.errors.matieres?.[index];

                    return (
                      <article
                        key={item.id}
                        className="rounded-[24px] border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                            <FiBookOpen />
                            Matiere {index + 1}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (fields.length === 1) {
                                form.setValue("matieres.0", { ...emptyLine });
                                return;
                              }
                              remove(index);
                            }}
                            disabled={isArchived}
                            className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            <FiTrash2 />
                            Retirer
                          </button>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                          <Controller
                            control={control}
                            name={`matieres.${index}.matiere_id`}
                            render={({ field, fieldState }) => (
                              <FieldWrapper
                                id={`matieres.${index}.matiere_id`}
                                label="Matiere"
                                required
                                error={fieldState.error?.message}
                                className="xl:col-span-2"
                                description="Chaque matiere ne peut apparaitre qu'une seule fois dans le programme."
                              >
                                <select
                                  id={`matieres.${index}.matiere_id`}
                                  value={normalizeNumberInputValue(field.value)}
                                  onChange={(event) => field.onChange(event.target.value)}
                                  onBlur={field.onBlur}
                                  ref={field.ref}
                                  disabled={isArchived}
                                  className={getInputClassName(Boolean(fieldState.error))}
                                >
                                  <option value="">Selectionner une matiere</option>
                                  {matiereOptions.map((option) => (
                                    <option
                                      key={option.value}
                                      value={option.value}
                                      disabled={selectedIds?.includes(option.value)}
                                    >
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </FieldWrapper>
                            )}
                          />

                          <Controller
                            control={control}
                            name={`matieres.${index}.statut`}
                            render={({ field, fieldState }) => (
                              <FieldWrapper
                                id={`matieres.${index}.statut`}
                                label="Statut"
                                error={fieldState.error?.message}
                              >
                                <select
                                  id={`matieres.${index}.statut`}
                                  value={field.value ?? "ACTIVE"}
                                  onChange={(event) => field.onChange(event.target.value)}
                                  onBlur={field.onBlur}
                                  ref={field.ref}
                                  disabled={isArchived}
                                  className={getInputClassName(Boolean(fieldState.error))}
                                >
                                  {PROGRAMME_SUBJECT_STATUS_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </FieldWrapper>
                            )}
                          />

                          <Controller
                            control={control}
                            name={`matieres.${index}.mode_calcul`}
                            render={({ field, fieldState }) => (
                              <FieldWrapper
                                id={`matieres.${index}.mode_calcul`}
                                label="Mode de calcul"
                                error={fieldState.error?.message}
                              >
                                <select
                                  id={`matieres.${index}.mode_calcul`}
                                  value={field.value ?? "WEIGHTED_AVERAGE"}
                                  onChange={(event) => field.onChange(event.target.value)}
                                  onBlur={field.onBlur}
                                  ref={field.ref}
                                  disabled={isArchived}
                                  className={getInputClassName(Boolean(fieldState.error))}
                                >
                                  {CALCULATION_MODE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </FieldWrapper>
                            )}
                          />

                          <Controller
                            control={control}
                            name={`matieres.${index}.heures_semaine`}
                            render={({ field, fieldState }) => (
                              <FieldWrapper
                                id={`matieres.${index}.heures_semaine`}
                                label="Heures / semaine"
                                error={fieldState.error?.message}
                              >
                                <input
                                  id={`matieres.${index}.heures_semaine`}
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={normalizeNumberInputValue(field.value)}
                                  onChange={(event) => field.onChange(event.target.value)}
                                  onBlur={field.onBlur}
                                  ref={field.ref}
                                  disabled={isArchived}
                                  placeholder="Ex: 4"
                                  className={getInputClassName(Boolean(fieldState.error))}
                                />
                              </FieldWrapper>
                            )}
                          />

                          <Controller
                            control={control}
                            name={`matieres.${index}.heures_annuelles`}
                            render={({ field, fieldState }) => (
                              <FieldWrapper
                                id={`matieres.${index}.heures_annuelles`}
                                label="Heures annuelles"
                                error={fieldState.error?.message}
                              >
                                <input
                                  id={`matieres.${index}.heures_annuelles`}
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={normalizeNumberInputValue(field.value)}
                                  onChange={(event) => field.onChange(event.target.value)}
                                  onBlur={field.onBlur}
                                  ref={field.ref}
                                  disabled={isArchived}
                                  placeholder="Ex: 120"
                                  className={getInputClassName(Boolean(fieldState.error))}
                                />
                              </FieldWrapper>
                            )}
                          />

                          <Controller
                            control={control}
                            name={`matieres.${index}.seances_par_semaine`}
                            render={({ field, fieldState }) => (
                              <FieldWrapper
                                id={`matieres.${index}.seances_par_semaine`}
                                label="Seances / semaine"
                                error={fieldState.error?.message}
                              >
                                <input
                                  id={`matieres.${index}.seances_par_semaine`}
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={normalizeNumberInputValue(field.value)}
                                  onChange={(event) => field.onChange(event.target.value)}
                                  onBlur={field.onBlur}
                                  ref={field.ref}
                                  disabled={isArchived}
                                  placeholder="Ex: 2"
                                  className={getInputClassName(Boolean(fieldState.error))}
                                />
                              </FieldWrapper>
                            )}
                          />

                          <Controller
                            control={control}
                            name={`matieres.${index}.duree_seance_par_defaut`}
                            render={({ field, fieldState }) => (
                              <FieldWrapper
                                id={`matieres.${index}.duree_seance_par_defaut`}
                                label="Duree seance (min)"
                                error={fieldState.error?.message}
                              >
                                <input
                                  id={`matieres.${index}.duree_seance_par_defaut`}
                                  type="number"
                                  min={0}
                                  step={5}
                                  value={normalizeNumberInputValue(field.value)}
                                  onChange={(event) => field.onChange(event.target.value)}
                                  onBlur={field.onBlur}
                                  ref={field.ref}
                                  disabled={isArchived}
                                  placeholder="Ex: 55"
                                  className={getInputClassName(Boolean(fieldState.error))}
                                />
                              </FieldWrapper>
                            )}
                          />

                          <Controller
                            control={control}
                            name={`matieres.${index}.coefficient`}
                            render={({ field, fieldState }) => (
                              <FieldWrapper
                                id={`matieres.${index}.coefficient`}
                                label="Coefficient"
                                error={fieldState.error?.message}
                              >
                                <input
                                  id={`matieres.${index}.coefficient`}
                                  type="number"
                                  min={0}
                                  step={0.5}
                                  value={normalizeNumberInputValue(field.value)}
                                  onChange={(event) => field.onChange(event.target.value)}
                                  onBlur={field.onBlur}
                                  ref={field.ref}
                                  disabled={isArchived}
                                  placeholder="Ex: 4"
                                  className={getInputClassName(Boolean(fieldState.error))}
                                />
                              </FieldWrapper>
                            )}
                          />

                          <Controller
                            control={control}
                            name={`matieres.${index}.ordre_affichage_bulletin`}
                            render={({ field, fieldState }) => (
                              <FieldWrapper
                                id={`matieres.${index}.ordre_affichage_bulletin`}
                                label="Ordre bulletin"
                                error={fieldState.error?.message}
                              >
                                <input
                                  id={`matieres.${index}.ordre_affichage_bulletin`}
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={normalizeNumberInputValue(field.value)}
                                  onChange={(event) => field.onChange(event.target.value)}
                                  onBlur={field.onBlur}
                                  ref={field.ref}
                                  disabled={isArchived}
                                  placeholder="Ex: 1"
                                  className={getInputClassName(Boolean(fieldState.error))}
                                />
                              </FieldWrapper>
                            )}
                          />

                          <Controller
                            control={control}
                            name={`matieres.${index}.grading_scale_id`}
                            render={({ field, fieldState }) => (
                              <FieldWrapper
                                id={`matieres.${index}.grading_scale_id`}
                                label="Echelle de notation"
                                error={fieldState.error?.message}
                                className="xl:col-span-2"
                              >
                                <select
                                  id={`matieres.${index}.grading_scale_id`}
                                  value={field.value ?? ""}
                                  onChange={(event) => field.onChange(event.target.value)}
                                  onBlur={field.onBlur}
                                  ref={field.ref}
                                  disabled={isArchived}
                                  className={getInputClassName(Boolean(fieldState.error))}
                                >
                                  <option value="">Echelle par defaut du programme</option>
                                  {gradingScaleOptions.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </FieldWrapper>
                            )}
                          />

                          <Controller
                            control={control}
                            name={`matieres.${index}.libelle_bulletin`}
                            render={({ field, fieldState }) => (
                              <FieldWrapper
                                id={`matieres.${index}.libelle_bulletin`}
                                label="Libelle bulletin"
                                error={fieldState.error?.message}
                                className="xl:col-span-2"
                              >
                                <input
                                  id={`matieres.${index}.libelle_bulletin`}
                                  type="text"
                                  value={field.value ?? ""}
                                  onChange={(event) => field.onChange(event.target.value)}
                                  onBlur={field.onBlur}
                                  ref={field.ref}
                                  disabled={isArchived}
                                  placeholder="Ex: Mathematiques"
                                  className={getInputClassName(Boolean(fieldState.error))}
                                />
                              </FieldWrapper>
                            )}
                          />
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <Controller
                            control={control}
                            name={`matieres.${index}.est_obligatoire`}
                            render={({ field }) => (
                              <label
                                className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium ${getBooleanImpactClass(field.value)}`}
                              >
                                <span>Matiere obligatoire</span>
                                <input
                                  type="checkbox"
                                  checked={Boolean(field.value)}
                                  onChange={(event) => field.onChange(event.target.checked)}
                                  disabled={isArchived}
                                  className="h-4 w-4"
                                />
                              </label>
                            )}
                          />

                          <Controller
                            control={control}
                            name={`matieres.${index}.est_visible_bulletin`}
                            render={({ field }) => (
                              <label
                                className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium ${getBooleanImpactClass(field.value)}`}
                              >
                                <span>Visible dans le bulletin</span>
                                <input
                                  type="checkbox"
                                  checked={Boolean(field.value)}
                                  onChange={(event) => field.onChange(event.target.checked)}
                                  disabled={isArchived}
                                  className="h-4 w-4"
                                />
                              </label>
                            )}
                          />

                          <Controller
                            control={control}
                            name={`matieres.${index}.inclure_moyenne_generale`}
                            render={({ field }) => (
                              <label
                                className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium ${getBooleanImpactClass(field.value)}`}
                              >
                                <span>Inclure dans la moyenne generale</span>
                                <input
                                  type="checkbox"
                                  checked={Boolean(field.value)}
                                  onChange={(event) => field.onChange(event.target.checked)}
                                  disabled={isArchived}
                                  className="h-4 w-4"
                                />
                              </label>
                            )}
                          />

                          <Controller
                            control={control}
                            name={`matieres.${index}.appreciation_obligatoire`}
                            render={({ field }) => (
                              <label
                                className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium ${getBooleanImpactClass(field.value)}`}
                              >
                                <span>Appreciation obligatoire</span>
                                <input
                                  type="checkbox"
                                  checked={Boolean(field.value)}
                                  onChange={(event) => field.onChange(event.target.checked)}
                                  disabled={isArchived}
                                  className="h-4 w-4"
                                />
                              </label>
                            )}
                          />
                        </div>

                        {lineError &&
                        !lineError.matiere_id &&
                        !lineError.heures_semaine &&
                        !lineError.coefficient ? (
                          <p className="mt-3 text-sm text-rose-600">
                            Ligne incomplete ou invalide.
                          </p>
                        ) : null}
                      </article>
                    );
                  })}
                </div>

                {typeof formState.errors.matieres?.message === "string" ? (
                  <p className="mt-4 text-sm font-medium text-rose-600">
                    {formState.errors.matieres.message}
                  </p>
                ) : null}
              </section>
            ) : null}

            {activeTab === "impact" ? (
              <section className="space-y-6">
                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">
                        Analyse d'impact
                      </h3>
                      <p className="text-sm text-slate-500">
                        Mesure les classes, cours, evaluations, notes et bulletins touches avant une modification sensible.
                      </p>
                    </div>
                    {isEditMode ? (
                      <button
                        type="button"
                        onClick={() => void runImpactAnalysis()}
                        disabled={isAnalyzingImpact || formState.isSubmitting}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {isAnalyzingImpact ? <Spin inline /> : <FiRefreshCw />}
                        <span>Actualiser l'impact</span>
                      </button>
                    ) : null}
                  </div>

                  {currentImpact ? (
                    <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                      {[
                        { label: "Classes", value: currentImpact.classesCount },
                        {
                          label: "Cours generes",
                          value: currentImpact.generatedCoursesCount,
                        },
                        { label: "Enseignants", value: currentImpact.teachersCount },
                        { label: "Eleves", value: currentImpact.studentsCount },
                        {
                          label: "Evaluations",
                          value: currentImpact.evaluationsCount,
                        },
                        { label: "Notes", value: currentImpact.notesCount },
                        {
                          label: "Resultats",
                          value: currentImpact.assessmentResultsCount,
                        },
                        {
                          label: "Bulletins brouillons",
                          value: currentImpact.draftReportCardsCount,
                        },
                        {
                          label: "Bulletins valides",
                          value: currentImpact.validatedReportCardsCount,
                        },
                        {
                          label: "Bulletins publies",
                          value: currentImpact.publishedReportCardsCount,
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
                        >
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {item.label}
                          </p>
                          <p className="mt-2 text-2xl font-semibold text-slate-900">
                            {item.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                      Aucune analyse d'impact disponible pour le moment. Lance l'analyse avant une modification sensible.
                    </div>
                  )}

                  {impactAnalysis?.changes?.length ? (
                    <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-800">
                        <FiAlertTriangle />
                        Changements sensibles detectes
                      </div>
                      <ul className="space-y-2 text-sm text-amber-900">
                        {impactAnalysis.changes.slice(0, 10).map((change, index) => (
                          <li key={`${change.action}-${change.fieldName ?? index}`}>
                            <span className="font-semibold">{change.action}</span>
                            {change.fieldName ? ` sur ${change.fieldName}` : ""}
                            {" · "}
                            <span className="opacity-80">{change.entityType}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </section>

                <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5 space-y-2">
                    <h3 className="text-lg font-semibold text-slate-900">
                      Synchronisation et recalcul
                    </h3>
                    <p className="text-sm text-slate-500">
                      Choisis comment propager la modification aux cours deja generes et aux bulletins non publies.
                    </p>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <Controller
                      control={control}
                      name="sync_existing_courses_mode"
                      render={({ field, fieldState }) => (
                        <FieldWrapper
                          id="sync_existing_courses_mode"
                          label="Synchronisation des cours"
                          error={fieldState.error?.message}
                          description="Applique les nouvelles heures et nouveaux coefficients selon le perimetre choisi."
                        >
                          <select
                            id="sync_existing_courses_mode"
                            value={field.value ?? ""}
                            onChange={(event) => field.onChange(event.target.value)}
                            onBlur={field.onBlur}
                            ref={field.ref}
                            disabled={isArchived}
                            className={getInputClassName(Boolean(fieldState.error))}
                          >
                            {SYNC_MODE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </FieldWrapper>
                      )}
                    />

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                      <div className="mb-2 inline-flex items-center gap-2 font-semibold text-slate-800">
                        <FiClock />
                        Resume d'application
                      </div>
                      <p>
                        {watchedSyncMode
                          ? "Les changements horaires et coefficients pourront etre reportes selon l'option choisie."
                          : "Le programme sera mis a jour sans synchronisation automatique des cours existants."}
                      </p>
                    </div>

                    <Controller
                      control={control}
                      name="recalculate_draft_report_cards"
                      render={({ field }) => (
                        <label
                          className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium ${getBooleanImpactClass(field.value)}`}
                        >
                          <div className="pr-3">
                            <p className="font-semibold">Recalculer les bulletins brouillons</p>
                            <p className="mt-1 text-xs font-normal opacity-80">
                              Recommandé si coefficients ou inclusion moyenne generale changent.
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            checked={Boolean(field.value)}
                            onChange={(event) => field.onChange(event.target.checked)}
                            disabled={isArchived}
                            className="h-4 w-4"
                          />
                        </label>
                      )}
                    />

                    <Controller
                      control={control}
                      name="regenerate_unpublished_bulletins"
                      render={({ field }) => (
                        <label
                          className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium ${getBooleanImpactClass(field.value)}`}
                        >
                          <div className="pr-3">
                            <p className="font-semibold">Regenerer les bulletins non publies</p>
                            <p className="mt-1 text-xs font-normal opacity-80">
                              Les bulletins publies restent proteges et ne doivent jamais etre modifies automatiquement.
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            checked={Boolean(field.value)}
                            onChange={(event) => field.onChange(event.target.checked)}
                            disabled={isArchived}
                            className="h-4 w-4"
                          />
                        </label>
                      )}
                    />
                  </div>

                  <div className="mt-5 grid gap-5 md:grid-cols-[1.2fr_0.8fr]">
                    <Controller
                      control={control}
                      name="reason"
                      render={({ field, fieldState }) => (
                        <FieldWrapper
                          id="reason"
                          label="Motif de la modification"
                          error={fieldState.error?.message}
                          description="Obligatoire pour les changements sensibles detectes a l'analyse d'impact."
                        >
                          <textarea
                            id="reason"
                            rows={4}
                            value={field.value ?? ""}
                            onChange={(event) => field.onChange(event.target.value)}
                            onBlur={field.onBlur}
                            ref={field.ref}
                            disabled={isArchived}
                            placeholder="Ex: Ajustement du coefficient de mathematiques suite a la nouvelle grille pedagogique."
                            className={getInputClassName(Boolean(fieldState.error))}
                          />
                        </FieldWrapper>
                      )}
                    />

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                      <div className="mb-2 inline-flex items-center gap-2 font-semibold text-slate-800">
                        <FiGitBranch />
                        Conseils
                      </div>
                      <ul className="space-y-2">
                        <li>Un changement de coefficient ou de mode de calcul peut necessiter un recalcul.</li>
                        <li>Un changement d'heures avec emploi du temps deja genere doit etre synchronise avec prudence.</li>
                        <li>Les bulletins publies restent figes, meme si le programme evolue.</li>
                        <li>Le motif saisi sera conserve dans l'historique.</li>
                      </ul>
                    </div>
                  </div>

                  {watchedReason && impactAnalysis?.requiresConfirmation ? (
                    <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                      Le motif est renseigne. La sauvegarde pourra etre confirmee apres l'analyse d'impact.
                    </div>
                  ) : null}

                  {(watchedRecalculateDrafts || watchedRegenerateUnpublished) &&
                  currentImpact ? (
                    <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                      La propagation choisie sera limitee aux bulletins non publies et au perimetre de synchronisation selectionne.
                    </div>
                  ) : null}
                </section>
              </section>
            ) : null}

            {activeTab === "historique" ? (
              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      Historique des modifications
                    </h3>
                    <p className="text-sm text-slate-500">
                      Toutes les modifications sensibles journalisees sur ce programme.
                    </p>
                  </div>
                  {isEditMode ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (initialData?.id) {
                          void refreshChangeLogs(initialData.id);
                        }
                      }}
                      disabled={changeLogsLoading}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {changeLogsLoading ? <Spin inline /> : <FiRefreshCw />}
                      <span>Actualiser</span>
                    </button>
                  ) : null}
                </div>

                {!isEditMode ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                    L'historique sera disponible apres la creation du programme.
                  </div>
                ) : changeLogsLoading ? (
                  <Spin label="Chargement de l'historique..." showLabel />
                ) : changeLogs.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                    Aucune modification sensible journalisee pour le moment.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {changeLogs.map((entry) => (
                      <article
                        key={entry.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="inline-flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900">
                                {entry.action ?? "Modification"}
                              </span>
                              <span className="rounded-full bg-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700">
                                {entry.entity_type ?? "programme"}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-slate-500">
                              {entry.field_name
                                ? `Champ: ${entry.field_name}`
                                : "Modification sans champ unique cible"}
                            </p>
                          </div>
                          <div className="text-right text-xs text-slate-500">
                            <p>{formatChangeDate(entry.changed_at)}</p>
                            <p>{formatChangeActor(entry)}</p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Ancienne valeur
                            </p>
                            <p className="mt-2 break-words text-sm text-slate-700">
                              {formatJsonPreview(entry.old_value_json)}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Nouvelle valeur
                            </p>
                            <p className="mt-2 break-words text-sm text-slate-700">
                              {formatJsonPreview(entry.new_value_json)}
                            </p>
                          </div>
                        </div>

                        {entry.reason ? (
                          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Motif
                            </p>
                            <p className="mt-2 text-sm text-slate-700">{entry.reason}</p>
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={resetCreateForm}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
              >
                Annuler
              </button>

              <button
                type="submit"
                disabled={formState.isSubmitting || isArchived}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {formState.isSubmitting ? <Spin inline /> : <FiSave />}
                <span>
                  {isEditMode ? "Enregistrer les modifications" : "Enregistrer le programme"}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default ProgrammeForm;
