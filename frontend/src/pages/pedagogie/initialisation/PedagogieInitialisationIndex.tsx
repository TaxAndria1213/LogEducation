import { useEffect, useMemo, useState } from "react";
import {
  FiBookOpen,
  FiCheck,
  FiChevronRight,
  FiClipboard,
  FiEdit3,
  FiLayers,
  FiRefreshCw,
  FiSettings,
  FiUsers,
} from "react-icons/fi";
import ERPPage from "../../../components/page/ERPPage";
import Spin from "../../../components/anim/Spin";
import { getInputClassName } from "../../../components/Form/fields/inputStyles";
import { useAuth } from "../../../auth/AuthContext";
import { useInfo } from "../../../hooks/useInfo";
import AnneeScolaireService from "../../../services/anneeScolaire.service";
import ClasseService from "../../../services/classe.service";
import CoursService, {
  getTeacherDisplayLabel,
  type CoursWithRelations,
  type EnseignantWithRelations,
} from "../../../services/cours.service";
import EnseignantService from "../../../services/enseignant.service";
import MatiereService, {
  type MatiereWithRelations,
} from "../../../services/matiere.service";
import NiveauScolaireService from "../../../services/niveau.service";
import PeriodeService from "../../../services/periode.service";
import ProgrammeService, {
  type ProgrammeLine,
  type ProgrammeWithRelations,
} from "../../../services/programme.service";
import PedagogieInitialisationService, {
  DEFAULT_NOTE_RULES,
  type PedagogieBulletinConfig,
  type PedagogieInitialisationConfigRecord,
  type PedagogieInitialisationConfigResponse,
  type PedagogieEvaluationTypeConfig,
  type PedagogieNoteRules,
  type ReportCardTemplateType,
  normalizePedagogieNoteRules,
} from "../../../services/pedagogieInitialisation.service";
import type {
  AnneeScolaire,
  Classe,
  NiveauScolaire,
  Periode,
} from "../../../types/models";

type WizardMode = "RAPIDE" | "AVANCE";
type PeriodMode = "TRIMESTRE" | "SEMESTRE" | "PERSONNALISE";

type PeriodDraft = {
  nom: string;
  date_debut: string;
  date_fin: string;
  ordre: number;
};

type SubjectDraft = {
  code: string;
  nom: string;
  heures_semaine: number;
  coefficient: number;
  selected: boolean;
};

type LevelSubjectSetting = {
  active: boolean;
  heures_semaine: number;
  coefficient: number;
};

type LevelSubjectSettings = Record<string, Record<string, LevelSubjectSetting>>;
type TeacherAssignments = Record<string, Record<string, string>>;
type ExistingTeacherAssignmentMap = Record<string, Record<string, string>>;
type ExistingTeacherConflictMap = Record<string, Record<string, string[]>>;
type PersistedPedagogieConfig = {
  mode_initialisation?: unknown;
  default_teacher_id?: unknown;
  teacher_assignments?: unknown;
  evaluation_types?: unknown;
  note_rules?: unknown;
  bulletin_config?: unknown;
};

type EvaluationTypeDraft = {
  code: "DEVOIR" | "EXAMEN" | "ORAL" | "AUTRE";
  label: string;
  poids: number;
  note_max: number;
  include_in_average: boolean;
  show_in_report_card: boolean;
  is_final_exam: boolean;
};

type NoteRulesDraft = PedagogieNoteRules;

type BulletinConfigDraft = PedagogieBulletinConfig;

type InitSummary = {
  periodesCreated: number;
  periodesSkipped: number;
  matieresCreated: number;
  matieresReused: number;
  programmesCreated: number;
  programmesUpdated: number;
  programmesSkipped: number;
  coursCreated: number;
  coursSkipped: number;
  coursWithoutTeacher: number;
  configCreated: boolean;
  configUpdated: boolean;
};

const STEP_DEFINITIONS = [
  "Annee courante",
  "Mode",
  "Periodes",
  "Matieres",
  "Programmes",
  "Associations",
  "Cours",
  "Enseignants",
  "Evaluations",
  "Regles notes",
  "Bulletin",
  "Resume",
  "Validation",
] as const;

const DEFAULT_SUBJECTS: SubjectDraft[] = [
  { code: "MLG", nom: "Malagasy", heures_semaine: 4, coefficient: 2, selected: true },
  { code: "FR", nom: "Francais", heures_semaine: 5, coefficient: 3, selected: true },
  { code: "MATH", nom: "Mathematiques", heures_semaine: 5, coefficient: 4, selected: true },
  { code: "HG", nom: "Histoire-Geographie", heures_semaine: 3, coefficient: 2, selected: true },
  { code: "SVT", nom: "Sciences de la Vie et de la Terre", heures_semaine: 3, coefficient: 2, selected: true },
  { code: "PC", nom: "Physique-Chimie", heures_semaine: 3, coefficient: 2, selected: true },
  { code: "ANG", nom: "Anglais", heures_semaine: 3, coefficient: 2, selected: true },
  { code: "EPS", nom: "Education Physique et Sportive", heures_semaine: 2, coefficient: 1, selected: true },
  { code: "INFO", nom: "Informatique", heures_semaine: 2, coefficient: 1, selected: true },
  { code: "EC", nom: "Education civique", heures_semaine: 1, coefficient: 1, selected: true },
  { code: "ART", nom: "Arts plastiques", heures_semaine: 1, coefficient: 1, selected: false },
  { code: "PHILO", nom: "Philosophie", heures_semaine: 4, coefficient: 3, selected: false },
];

const DEFAULT_EVALUATION_TYPES: EvaluationTypeDraft[] = [
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

const DEFAULT_BULLETIN_CONFIG: BulletinConfigDraft = {
  template_type: "STANDARD",
  description: null,
  show_assessment_details: false,
  show_assessment_type_summary: false,
  show_only_final_exam: false,
  show_subject_average: true,
  show_subject_coefficient: true,
  show_subject_points: false,
  show_subject_rank: true,
  show_teacher_appreciation: true,
  show_general_average: true,
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

function normalizeEvaluationTypeDraft(
  item: unknown,
  fallback?: EvaluationTypeDraft,
): EvaluationTypeDraft | null {
  if (!isPlainObject(item)) return null;

  const code =
    item.code === "EXAMEN" ||
    item.code === "ORAL" ||
    item.code === "AUTRE"
      ? item.code
      : "DEVOIR";

  const fallbackDraft =
    fallback ?? DEFAULT_EVALUATION_TYPES.find((entry) => entry.code === code);

  return {
    code,
    label:
      typeof item.label === "string" && item.label.trim()
        ? item.label.trim()
        : fallbackDraft?.label ?? "Evaluation",
    poids:
      typeof item.poids === "number" && Number.isFinite(item.poids)
        ? item.poids
        : fallbackDraft?.poids ?? 1,
    note_max:
      typeof item.note_max === "number" && Number.isFinite(item.note_max)
        ? item.note_max
        : fallbackDraft?.note_max ?? 20,
    include_in_average:
      typeof item.include_in_average === "boolean"
        ? item.include_in_average
        : fallbackDraft?.include_in_average ?? true,
    show_in_report_card:
      typeof item.show_in_report_card === "boolean"
        ? item.show_in_report_card
        : fallbackDraft?.show_in_report_card ?? code === "EXAMEN",
    is_final_exam:
      typeof item.is_final_exam === "boolean"
        ? item.is_final_exam
        : fallbackDraft?.is_final_exam ?? code === "EXAMEN",
  };
}

function normalizeBulletinConfigDraft(raw: unknown): BulletinConfigDraft {
  const source = isPlainObject(raw) ? raw : {};
  const templateType: ReportCardTemplateType =
    source.template_type === "DETAILED" ||
    source.template_type === "ASSESSMENT_TYPE_SUMMARY" ||
    source.template_type === "FINAL_EXAM_ONLY" ||
    source.template_type === "CUSTOM"
      ? source.template_type
      : "STANDARD";

  const config: BulletinConfigDraft = {
    ...DEFAULT_BULLETIN_CONFIG,
    template_type: templateType,
    description:
      typeof source.description === "string" && source.description.trim()
        ? source.description.trim()
        : null,
    show_assessment_details:
      typeof source.show_assessment_details === "boolean"
        ? source.show_assessment_details
        : DEFAULT_BULLETIN_CONFIG.show_assessment_details,
    show_assessment_type_summary:
      typeof source.show_assessment_type_summary === "boolean"
        ? source.show_assessment_type_summary
        : DEFAULT_BULLETIN_CONFIG.show_assessment_type_summary,
    show_only_final_exam:
      typeof source.show_only_final_exam === "boolean"
        ? source.show_only_final_exam
        : DEFAULT_BULLETIN_CONFIG.show_only_final_exam,
    show_subject_average:
      typeof source.show_subject_average === "boolean"
        ? source.show_subject_average
        : DEFAULT_BULLETIN_CONFIG.show_subject_average,
    show_subject_coefficient:
      typeof source.show_subject_coefficient === "boolean"
        ? source.show_subject_coefficient
        : DEFAULT_BULLETIN_CONFIG.show_subject_coefficient,
    show_subject_points:
      typeof source.show_subject_points === "boolean"
        ? source.show_subject_points
        : DEFAULT_BULLETIN_CONFIG.show_subject_points,
    show_subject_rank:
      typeof source.show_subject_rank === "boolean"
        ? source.show_subject_rank
        : DEFAULT_BULLETIN_CONFIG.show_subject_rank,
    show_teacher_appreciation:
      typeof source.show_teacher_appreciation === "boolean"
        ? source.show_teacher_appreciation
        : DEFAULT_BULLETIN_CONFIG.show_teacher_appreciation,
    show_general_average:
      typeof source.show_general_average === "boolean"
        ? source.show_general_average
        : DEFAULT_BULLETIN_CONFIG.show_general_average,
    show_total_coefficients:
      typeof source.show_total_coefficients === "boolean"
        ? source.show_total_coefficients
        : DEFAULT_BULLETIN_CONFIG.show_total_coefficients,
    show_total_points:
      typeof source.show_total_points === "boolean"
        ? source.show_total_points
        : DEFAULT_BULLETIN_CONFIG.show_total_points,
    show_general_rank:
      typeof source.show_general_rank === "boolean"
        ? source.show_general_rank
        : DEFAULT_BULLETIN_CONFIG.show_general_rank,
    show_mention:
      typeof source.show_mention === "boolean"
        ? source.show_mention
        : DEFAULT_BULLETIN_CONFIG.show_mention,
    show_decision:
      typeof source.show_decision === "boolean"
        ? source.show_decision
        : DEFAULT_BULLETIN_CONFIG.show_decision,
    show_general_appreciation:
      typeof source.show_general_appreciation === "boolean"
        ? source.show_general_appreciation
        : DEFAULT_BULLETIN_CONFIG.show_general_appreciation,
    show_absences:
      typeof source.show_absences === "boolean"
        ? source.show_absences
        : DEFAULT_BULLETIN_CONFIG.show_absences,
    show_late_count:
      typeof source.show_late_count === "boolean"
        ? source.show_late_count
        : DEFAULT_BULLETIN_CONFIG.show_late_count,
    show_logo:
      typeof source.show_logo === "boolean"
        ? source.show_logo
        : DEFAULT_BULLETIN_CONFIG.show_logo,
    show_signature:
      typeof source.show_signature === "boolean"
        ? source.show_signature
        : DEFAULT_BULLETIN_CONFIG.show_signature,
    publier_par_defaut:
      typeof source.publier_par_defaut === "boolean"
        ? source.publier_par_defaut
        : DEFAULT_BULLETIN_CONFIG.publier_par_defaut,
  };

  if (templateType === "STANDARD") {
    config.show_assessment_details = false;
    config.show_assessment_type_summary = false;
    config.show_only_final_exam = false;
  }

  if (templateType === "DETAILED") {
    config.show_assessment_details = true;
    config.show_assessment_type_summary = false;
    config.show_only_final_exam = false;
  }

  if (templateType === "ASSESSMENT_TYPE_SUMMARY") {
    config.show_assessment_details = false;
    config.show_assessment_type_summary = true;
    config.show_only_final_exam = false;
  }

  if (templateType === "FINAL_EXAM_ONLY") {
    config.show_assessment_details = true;
    config.show_assessment_type_summary = false;
    config.show_only_final_exam = true;
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

function normalizeText(value?: string | null) {
  return (value ?? "").trim().replace(/\s+/g, " ").toUpperCase();
}

function toDateInput(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(value?: string | Date | null) {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("fr-FR");
}

function buildProgrammeName(niveau: NiveauScolaire) {
  return `Programme ${niveau.nom}`;
}

function splitYearIntoPeriods(year: AnneeScolaire | null, count: number, prefix: string): PeriodDraft[] {
  if (!year?.date_debut || !year.date_fin) return [];

  const start = new Date(year.date_debut);
  const end = new Date(year.date_fin);
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const chunk = Math.floor(totalDays / count);

  return Array.from({ length: count }, (_, index) => {
    const periodStart = index === 0 ? start : addDays(start, chunk * index);
    const periodEnd = index === count - 1 ? end : addDays(start, chunk * (index + 1) - 1);
    return {
      nom: `${prefix} ${index + 1}`,
      date_debut: toDateInput(periodStart),
      date_fin: toDateInput(periodEnd),
      ordre: index + 1,
    };
  });
}

function mergeProgrammeLines(
  existingLines: ProgrammeLine[] | null | undefined,
  selectedSubjects: SubjectDraft[],
  matiereByCode: Map<string, MatiereWithRelations>,
) {
  const byMatiereId = new Map<string, ProgrammeLine>();

  (existingLines ?? []).forEach((line) => {
    if (!line.matiere_id) return;
    byMatiereId.set(line.matiere_id, {
      matiere_id: line.matiere_id,
      heures_semaine: line.heures_semaine ?? null,
      coefficient: line.coefficient ?? null,
    });
  });

  selectedSubjects.forEach((subject) => {
    const matiere = matiereByCode.get(normalizeText(subject.code));
    if (!matiere?.id || byMatiereId.has(matiere.id)) return;

    byMatiereId.set(matiere.id, {
      matiere_id: matiere.id,
      heures_semaine: Math.max(0, Math.trunc(Number(subject.heures_semaine) || 0)),
      coefficient: Math.max(0, Number(subject.coefficient) || 0),
    });
  });

  return [...byMatiereId.values()];
}

function getClasseLabel(classe: Classe & { niveau?: { nom?: string | null } | null }) {
  return [classe.nom, classe.niveau?.nom].filter(Boolean).join(" - ");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePersistedTeacherAssignments(value: unknown): TeacherAssignments {
  if (!isPlainObject(value)) return {};

  const parsed: TeacherAssignments = {};

  Object.entries(value).forEach(([levelId, subjects]) => {
    if (!isPlainObject(subjects)) return;

    const subjectAssignments: Record<string, string> = {};

    Object.entries(subjects).forEach(([subjectCode, teacherId]) => {
      if (typeof teacherId !== "string" || !teacherId.trim()) return;
      subjectAssignments[subjectCode] = teacherId.trim();
    });

    if (Object.keys(subjectAssignments).length > 0) {
      parsed[levelId] = subjectAssignments;
    }
  });

  return parsed;
}

function readPersistedPedagogieConfig(raw: unknown): PersistedPedagogieConfig | null {
  return isPlainObject(raw) ? (raw as PersistedPedagogieConfig) : null;
}

function buildExistingTeacherAssignmentMaps(
  courses: CoursWithRelations[],
): {
  assignments: ExistingTeacherAssignmentMap;
  conflicts: ExistingTeacherConflictMap;
} {
  const teacherNames = new Map<string, string>();
  const buckets = new Map<string, Set<string>>();

  courses.forEach((course) => {
    const levelId = course.classe?.niveau?.id ?? null;
    const subjectCode = normalizeText(course.matiere?.code);
    const teacherId = course.enseignant_id?.trim() || course.enseignant?.id?.trim() || "";

    if (!levelId || !subjectCode || !teacherId) return;

    teacherNames.set(teacherId, getTeacherDisplayLabel(course.enseignant));

    const bucketKey = `${levelId}::${subjectCode}`;
    const current = buckets.get(bucketKey) ?? new Set<string>();
    current.add(teacherId);
    buckets.set(bucketKey, current);
  });

  const assignments: ExistingTeacherAssignmentMap = {};
  const conflicts: ExistingTeacherConflictMap = {};

  buckets.forEach((teacherIds, bucketKey) => {
    const [levelId, subjectCode] = bucketKey.split("::");
    if (!levelId || !subjectCode) return;

    if (teacherIds.size === 1) {
      const teacherId = [...teacherIds][0];
      assignments[levelId] = {
        ...(assignments[levelId] ?? {}),
        [subjectCode]: teacherId,
      };
      return;
    }

    conflicts[levelId] = {
      ...(conflicts[levelId] ?? {}),
      [subjectCode]: [...teacherIds].map(
        (teacherId) => teacherNames.get(teacherId) ?? teacherId,
      ),
    };
  });

  return { assignments, conflicts };
}

export default function PedagogieInitialisationIndex() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();

  const matiereService = useMemo(() => new MatiereService(), []);
  const niveauService = useMemo(() => new NiveauScolaireService(), []);
  const programmeService = useMemo(() => new ProgrammeService(), []);
  const classeService = useMemo(() => new ClasseService(), []);
  const coursService = useMemo(() => new CoursService(), []);
  const enseignantService = useMemo(() => new EnseignantService(), []);

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [activeYear, setActiveYear] = useState<AnneeScolaire | null>(null);
  const [periodes, setPeriodes] = useState<Periode[]>([]);
  const [niveaux, setNiveaux] = useState<NiveauScolaire[]>([]);
  const [classes, setClasses] = useState<Array<Classe & { niveau?: { nom?: string | null } | null }>>([]);
  const [matieres, setMatieres] = useState<MatiereWithRelations[]>([]);
  const [programmes, setProgrammes] = useState<ProgrammeWithRelations[]>([]);
  const [cours, setCours] = useState<CoursWithRelations[]>([]);
  const [enseignants, setEnseignants] = useState<EnseignantWithRelations[]>([]);
  const [existingConfig, setExistingConfig] =
    useState<PedagogieInitialisationConfigRecord | null>(null);

  const [wizardMode, setWizardMode] = useState<WizardMode>("RAPIDE");
  const [periodMode, setPeriodMode] = useState<PeriodMode>("TRIMESTRE");
  const [periodDrafts, setPeriodDrafts] = useState<PeriodDraft[]>([]);
  const [subjects, setSubjects] = useState<SubjectDraft[]>(DEFAULT_SUBJECTS);
  const [selectedLevelIds, setSelectedLevelIds] = useState<string[]>([]);
  const [programmeNames, setProgrammeNames] = useState<Record<string, string>>({});
  const [levelSubjectSettings, setLevelSubjectSettings] =
    useState<LevelSubjectSettings>({});
  const [generateCourses, setGenerateCourses] = useState(true);
  const [defaultTeacherId, setDefaultTeacherId] = useState("");
  const [teacherByLevelSubject, setTeacherByLevelSubject] =
    useState<TeacherAssignments>({});
  const [evaluationTypes, setEvaluationTypes] = useState<EvaluationTypeDraft[]>(DEFAULT_EVALUATION_TYPES);
  const [noteRules, setNoteRules] = useState<NoteRulesDraft>(DEFAULT_NOTE_RULES);
  const [bulletinConfig, setBulletinConfig] =
    useState<BulletinConfigDraft>(DEFAULT_BULLETIN_CONFIG);
  const [summary, setSummary] = useState<InitSummary | null>(null);

  const selectedSubjects = useMemo(
    () => subjects.filter((subject) => subject.selected),
    [subjects],
  );

  const selectedLevels = useMemo(
    () => niveaux.filter((niveau) => selectedLevelIds.includes(niveau.id)),
    [niveaux, selectedLevelIds],
  );

  const activeYearProgrammes = useMemo(
    () => programmes.filter((programme) => programme.annee_scolaire_id === activeYear?.id),
    [activeYear?.id, programmes],
  );

  const activeYearClasses = useMemo(
    () => classes.filter((classe) => classe.annee_scolaire_id === activeYear?.id),
    [activeYear?.id, classes],
  );

  const activeYearCours = useMemo(
    () => cours.filter((item) => item.annee_scolaire_id === activeYear?.id),
    [activeYear?.id, cours],
  );

  const existingTeacherAssignments = useMemo(
    () => buildExistingTeacherAssignmentMaps(activeYearCours),
    [activeYearCours],
  );

  const existingSubjectCodes = useMemo(
    () => new Set(matieres.map((item) => normalizeText(item.code))),
    [matieres],
  );

  const loadData = async () => {
    if (!etablissement_id) {
      setActiveYear(null);
      setPeriodes([]);
      setNiveaux([]);
      setClasses([]);
      setMatieres([]);
      setProgrammes([]);
      setCours([]);
      setEnseignants([]);
      setExistingConfig(null);
      return;
    }

    setLoading(true);
    try {
      const year = (await AnneeScolaireService.getCurrent(etablissement_id)) as AnneeScolaire | null;

      const [
        periodesResult,
        niveauxResult,
        classesResult,
        matieresResult,
        programmesResult,
        coursResult,
        enseignantsResult,
      ] = await Promise.all([
        PeriodeService.getAll({
          take: 1000,
          where: JSON.stringify(year?.id ? { annee_scolaire_id: year.id } : {}),
          orderBy: JSON.stringify([{ ordre: "asc" }, { date_debut: "asc" }]),
        }),
        niveauService.getAll({
          take: 1000,
          where: JSON.stringify({ etablissement_id }),
          orderBy: JSON.stringify([{ ordre: "asc" }, { nom: "asc" }]),
        }),
        classeService.getAll({
          take: 1000,
          where: JSON.stringify(year?.id ? { etablissement_id, annee_scolaire_id: year.id } : { etablissement_id }),
          includeSpec: JSON.stringify({ niveau: true, site: true }),
          orderBy: JSON.stringify([{ nom: "asc" }]),
        }),
        matiereService.getForEtablissement(etablissement_id, {
          take: 1000,
          includeSpec: JSON.stringify({ departement: true }),
          orderBy: JSON.stringify([{ nom: "asc" }]),
        }),
        programmeService.getForEtablissement(etablissement_id, {
          take: 1000,
          includeSpec: JSON.stringify({
            annee: true,
            niveau: true,
            matieres: { include: { matiere: true } },
          }),
          orderBy: JSON.stringify([{ created_at: "desc" }]),
        }),
        coursService.getForEtablissement(etablissement_id, {
          take: 3000,
          includeSpec: JSON.stringify({
            classe: { include: { niveau: true } },
            matiere: true,
            enseignant: { include: { personnel: { include: { utilisateur: { include: { profil: true } } } } } },
          }),
          orderBy: JSON.stringify([{ created_at: "desc" }]),
        }),
        enseignantService.getAll({
          take: 1000,
          where: JSON.stringify({ personnel: { etablissement_id } }),
          includeSpec: JSON.stringify({
            departement: true,
            personnel: { include: { utilisateur: { include: { profil: true } } } },
          }),
        }),
      ]);

      const configResponse = await PedagogieInitialisationService.getConfig(
        etablissement_id,
        year?.id ?? null,
      );
      const persistedConfig =
        ((configResponse.data as PedagogieInitialisationConfigResponse | null)
          ?.config as PedagogieInitialisationConfigRecord | null) ?? null;

      const loadedNiveaux = niveauxResult?.status.success
        ? ((niveauxResult.data.data as NiveauScolaire[]) ?? [])
        : [];

      setActiveYear(year ?? null);
      setPeriodes(periodesResult?.status.success ? ((periodesResult.data.data as Periode[]) ?? []) : []);
      setNiveaux(loadedNiveaux);
      setClasses(classesResult?.status.success ? ((classesResult.data.data as Array<Classe & { niveau?: { nom?: string | null } | null }>) ?? []) : []);
      setMatieres(matieresResult?.status.success ? ((matieresResult.data.data as MatiereWithRelations[]) ?? []) : []);
      setProgrammes(programmesResult?.status.success ? ((programmesResult.data.data as ProgrammeWithRelations[]) ?? []) : []);
      setCours(coursResult?.status.success ? ((coursResult.data.data as CoursWithRelations[]) ?? []) : []);
      setEnseignants(enseignantsResult?.status.success ? ((enseignantsResult.data.data as EnseignantWithRelations[]) ?? []) : []);
      setExistingConfig(persistedConfig);

      setSelectedLevelIds((current) => (current.length > 0 ? current : loadedNiveaux.map((niveau) => niveau.id)));
      setProgrammeNames((current) => {
        const next = { ...current };
        loadedNiveaux.forEach((niveau) => {
          if (!next[niveau.id]) next[niveau.id] = buildProgrammeName(niveau);
        });
        return next;
      });
    } catch (error) {
      info(error, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [etablissement_id]);

  useEffect(() => {
    if (!activeYear) return;

    if (periodes.length > 0) {
      setPeriodDrafts([]);
      return;
    }

    if (periodMode === "TRIMESTRE") {
      setPeriodDrafts(splitYearIntoPeriods(activeYear, 3, "Trimestre"));
      return;
    }
    if (periodMode === "SEMESTRE") {
      setPeriodDrafts(splitYearIntoPeriods(activeYear, 2, "Semestre"));
      return;
    }
    if (periodDrafts.length === 0) {
      setPeriodDrafts(splitYearIntoPeriods(activeYear, 1, "Periode"));
    }
  }, [activeYear, periodes.length, periodMode]);

  useEffect(() => {
    setLevelSubjectSettings((current) => {
      const next: LevelSubjectSettings = { ...current };

      niveaux.forEach((niveau) => {
        const levelSettings = { ...(next[niveau.id] ?? {}) };

        subjects.forEach((subject) => {
          if (!levelSettings[subject.code]) {
            levelSettings[subject.code] = {
              active: subject.selected,
              heures_semaine: subject.heures_semaine,
              coefficient: subject.coefficient,
            };
          }
        });

        next[niveau.id] = levelSettings;
      });

      return next;
    });
  }, [niveaux, subjects]);

  useEffect(() => {
    const persistedConfig = readPersistedPedagogieConfig(existingConfig?.regle_json);
    if (!persistedConfig) return;

    if (
      persistedConfig.mode_initialisation === "RAPIDE" ||
      persistedConfig.mode_initialisation === "AVANCE"
    ) {
      setWizardMode(persistedConfig.mode_initialisation);
    }

    setDefaultTeacherId(
      typeof persistedConfig.default_teacher_id === "string"
        ? persistedConfig.default_teacher_id.trim()
        : "",
    );

    const persistedAssignments = parsePersistedTeacherAssignments(
      persistedConfig.teacher_assignments,
    );
    setTeacherByLevelSubject(() => persistedAssignments);

    if (Array.isArray(persistedConfig.evaluation_types)) {
      const parsedEvaluationTypes = persistedConfig.evaluation_types
        .map((item) => normalizeEvaluationTypeDraft(item))
        .filter((item): item is EvaluationTypeDraft => Boolean(item));

      if (parsedEvaluationTypes.length > 0) {
        setEvaluationTypes(parsedEvaluationTypes);
      }
    }

    setNoteRules(normalizePedagogieNoteRules(persistedConfig.note_rules));

    if (isPlainObject(persistedConfig.bulletin_config)) {
      setBulletinConfig(
        normalizeBulletinConfigDraft(persistedConfig.bulletin_config),
      );
    }
  }, [existingConfig]);

  useEffect(() => {
    setTeacherByLevelSubject((current) => {
      let hasChanges = false;
      const next: TeacherAssignments = { ...current };

      selectedLevels.forEach((niveau) => {
        const inferredForLevel =
          existingTeacherAssignments.assignments[niveau.id] ?? {};

        getSelectedSubjectsForLevel(niveau.id).forEach((subject) => {
          const subjectCode = normalizeText(subject.code);
          const inferredTeacherId = inferredForLevel[subjectCode];

          if (!inferredTeacherId) return;
          if (current[niveau.id]?.[subject.code]) return;

          next[niveau.id] = {
            ...(next[niveau.id] ?? {}),
            [subject.code]: inferredTeacherId,
          };
          hasChanges = true;
        });
      });

      return hasChanges ? next : current;
    });
  }, [
    existingTeacherAssignments.assignments,
    levelSubjectSettings,
    selectedLevels,
    subjects,
  ]);

  const goToStep = (index: number) => {
    setStep(Math.max(0, Math.min(STEP_DEFINITIONS.length - 1, index)));
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const validateCurrentStep = () => {
    if (step === 0 && !activeYear?.id) return "Aucune année scolaire courante n’est définie.";
    if (step === 2 && periodes.length === 0 && periodDrafts.length === 0) return "Aucune periode pedagogique n'est disponible pour l'annee active.";
    if (step === 3 && selectedSubjects.length === 0) return "Selectionne au moins une matiere.";
    if (step === 4 && selectedLevels.length === 0) return "Selectionne au moins un niveau.";
    if (step === 5 && selectedLevels.some((niveau) => getSelectedSubjectsForLevel(niveau.id).length === 0)) return "Chaque niveau selectionne doit garder au moins une matiere active.";
    if (step === 6 && generateCourses && activeYearClasses.length === 0) return "Aucune classe n'existe sur l'annee active.";
    if (step === 7 && generateCourses && enseignants.length === 0) return "Aucun enseignant n'est disponible pour generer les cours.";
    if (step === 7 && generateCourses && enseignants.length > 0 && missingTeacherAssignments.length > 0) {
      return "Definis un enseignant par defaut ou complete les affectations niveau par niveau pour continuer.";
    }
    return "";
  };

  const goNext = () => {
    const error = validateCurrentStep();
    if (error) {
      info(error, "error");
      return;
    }
    goToStep(step + 1);
  };

  const updateSubject = (code: string, patch: Partial<SubjectDraft>) => {
    setSubjects((current) =>
      current.map((subject) =>
        subject.code === code ? { ...subject, ...patch } : subject,
      ),
    );
  };

  const getLevelSubjectSetting = (levelId: string, subject: SubjectDraft): LevelSubjectSetting => {
    return levelSubjectSettings[levelId]?.[subject.code] ?? {
      active: subject.selected,
      heures_semaine: subject.heures_semaine,
      coefficient: subject.coefficient,
    };
  };

  const updateLevelSubjectSetting = (
    levelId: string,
    subject: SubjectDraft,
    patch: Partial<LevelSubjectSetting>,
  ) => {
    setLevelSubjectSettings((current) => {
      const currentLevel = current[levelId] ?? {};
      const currentSetting = currentLevel[subject.code] ?? getLevelSubjectSetting(levelId, subject);

      return {
        ...current,
        [levelId]: {
          ...currentLevel,
          [subject.code]: {
            ...currentSetting,
            ...patch,
          },
        },
      };
    });
  };

  const getSelectedSubjectsForLevel = (levelId: string) => {
    return selectedSubjects
      .filter((subject) => getLevelSubjectSetting(levelId, subject).active)
      .map((subject) => {
        const setting = getLevelSubjectSetting(levelId, subject);
        return {
          ...subject,
          heures_semaine: setting.heures_semaine,
          coefficient: setting.coefficient,
        };
      });
  };

  const updatePeriod = (index: number, patch: Partial<PeriodDraft>) => {
    setPeriodDrafts((current) =>
      current.map((period, currentIndex) =>
        currentIndex === index ? { ...period, ...patch } : period,
      ),
    );
  };

  const updateEvaluationType = (index: number, patch: Partial<EvaluationTypeDraft>) => {
    setEvaluationTypes((current) =>
      current.map((item, currentIndex) =>
        currentIndex === index ? { ...item, ...patch } : item,
      ),
    );
  };

  const updateBulletinConfig = (patch: Partial<BulletinConfigDraft>) => {
    setBulletinConfig((current) =>
      normalizeBulletinConfigDraft({
        ...current,
        ...patch,
      }),
    );
  };

  const getTeacherAssignment = (levelId: string, subjectCode: string) =>
    teacherByLevelSubject[levelId]?.[subjectCode] ?? "";

  const updateTeacherAssignment = (
    levelId: string,
    subjectCode: string,
    teacherId: string,
  ) => {
    setTeacherByLevelSubject((current) => ({
      ...current,
      [levelId]: {
        ...(current[levelId] ?? {}),
        [subjectCode]: teacherId,
      },
    }));
  };

  const missingTeacherAssignments = useMemo(
    () =>
      selectedLevels.flatMap((niveau) =>
        getSelectedSubjectsForLevel(niveau.id)
          .filter(
            (subject) =>
              !defaultTeacherId && !getTeacherAssignment(niveau.id, subject.code),
          )
          .map((subject) => `${niveau.nom} - ${subject.nom}`),
      ),
    [defaultTeacherId, selectedLevels, teacherByLevelSubject, levelSubjectSettings, subjects],
  );

  const conflictingTeacherAssignments = useMemo(
    () =>
      selectedLevels.flatMap((niveau) =>
        getSelectedSubjectsForLevel(niveau.id)
          .map((subject) => ({
            levelName: niveau.nom,
            subjectName: subject.nom,
            teachers:
              existingTeacherAssignments.conflicts[niveau.id]?.[
                normalizeText(subject.code)
              ] ?? [],
          }))
          .filter((entry) => entry.teachers.length > 1),
      ),
    [
      existingTeacherAssignments.conflicts,
      levelSubjectSettings,
      selectedLevels,
      subjects,
    ],
  );

  const commitInitialization = async () => {
    if (!etablissement_id) {
      info("Aucun etablissement actif n'est disponible.", "error");
      return;
    }
    if (!activeYear?.id) {
      info("Aucune année scolaire courante n’est définie.", "error");
      return;
    }
    if (selectedSubjects.length === 0 || selectedLevels.length === 0) {
      info("Les matieres et les niveaux sont requis pour valider l'initialisation.", "error");
      return;
    }
    if (selectedLevels.some((niveau) => getSelectedSubjectsForLevel(niveau.id).length === 0)) {
      info("Chaque niveau selectionne doit avoir au moins une matiere active.", "error");
      return;
    }
    if (generateCourses && enseignants.length > 0 && missingTeacherAssignments.length > 0) {
      info(
        "Renseigne un enseignant par defaut ou complete les affectations par niveau et par matiere avant de generer les cours.",
        "error",
      );
      return;
    }

    setCommitting(true);
    try {
      const result: InitSummary = {
        periodesCreated: 0,
        periodesSkipped: 0,
        matieresCreated: 0,
        matieresReused: 0,
        programmesCreated: 0,
        programmesUpdated: 0,
        programmesSkipped: 0,
        coursCreated: 0,
        coursSkipped: 0,
        coursWithoutTeacher: 0,
        configCreated: false,
        configUpdated: false,
      };

      if (periodes.length > 0) {
        result.periodesSkipped = periodes.length;
      } else {
        const existingPeriodNames = new Set(periodes.map((period) => normalizeText(period.nom)));
        for (const period of periodDrafts) {
          if (existingPeriodNames.has(normalizeText(period.nom))) {
            result.periodesSkipped += 1;
            continue;
          }
          await PeriodeService.create({
            annee_scolaire_id: activeYear.id,
            nom: period.nom,
            date_debut: period.date_debut,
            date_fin: period.date_fin,
            ordre: period.ordre,
          });
          result.periodesCreated += 1;
        }
      }

      const matiereByCode = new Map<string, MatiereWithRelations>();
      const matiereByName = new Map<string, MatiereWithRelations>();
      matieres.forEach((matiere) => {
        if (matiere.code) matiereByCode.set(normalizeText(matiere.code), matiere);
        matiereByName.set(normalizeText(matiere.nom), matiere);
      });

      for (const subject of selectedSubjects) {
        const existing = matiereByCode.get(normalizeText(subject.code)) ?? matiereByName.get(normalizeText(subject.nom));
        if (existing) {
          matiereByCode.set(normalizeText(subject.code), existing);
          result.matieresReused += 1;
          continue;
        }

        const created = await matiereService.create({
          etablissement_id,
          code: subject.code,
          nom: subject.nom,
          departement_id: null,
        });
        const createdMatiere = created.data as MatiereWithRelations;
        matiereByCode.set(normalizeText(subject.code), createdMatiere);
        matiereByName.set(normalizeText(subject.nom), createdMatiere);
        result.matieresCreated += 1;
      }

      const programmeByLevelId = new Map(
        activeYearProgrammes.map((programme) => [programme.niveau_scolaire_id, programme] as const),
      );

      for (const niveau of selectedLevels) {
        const existingProgramme = programmeByLevelId.get(niveau.id) ?? null;
        const levelSubjects = getSelectedSubjectsForLevel(niveau.id);
        const mergedLines = mergeProgrammeLines(existingProgramme?.matieres, levelSubjects, matiereByCode);
        const programmeName = programmeNames[niveau.id]?.trim() || buildProgrammeName(niveau);

        if (existingProgramme) {
          const beforeCount = existingProgramme.matieres?.length ?? 0;
          if (mergedLines.length <= beforeCount && existingProgramme.nom === programmeName) {
            result.programmesSkipped += 1;
            continue;
          }
          await programmeService.update(existingProgramme.id, {
            etablissement_id,
            annee_scolaire_id: activeYear.id,
            niveau_scolaire_id: niveau.id,
            nom: programmeName,
            matieres: mergedLines,
          });
          result.programmesUpdated += 1;
          continue;
        }

        await programmeService.create({
          etablissement_id,
          annee_scolaire_id: activeYear.id,
          niveau_scolaire_id: niveau.id,
          nom: programmeName,
          matieres: mergedLines,
        });
        result.programmesCreated += 1;
      }

      if (generateCourses) {
        const existingCoursKeys = new Set(
          activeYearCours.map((item) => `${item.classe_id}::${item.matiere_id}`),
        );

        for (const classe of activeYearClasses) {
          if (!selectedLevelIds.includes(classe.niveau_scolaire_id)) continue;
          for (const subject of getSelectedSubjectsForLevel(classe.niveau_scolaire_id)) {
            const matiere = matiereByCode.get(normalizeText(subject.code));
            if (!matiere?.id) continue;
            const key = `${classe.id}::${matiere.id}`;
            if (existingCoursKeys.has(key)) {
              result.coursSkipped += 1;
              continue;
            }

            const teacherId =
              getTeacherAssignment(classe.niveau_scolaire_id, subject.code) ||
              defaultTeacherId;
            if (!teacherId) {
              result.coursWithoutTeacher += 1;
              continue;
            }

            await coursService.create({
              etablissement_id,
              annee_scolaire_id: activeYear.id,
              classe_id: classe.id,
              matiere_id: matiere.id,
              enseignant_id: teacherId,
              coefficient_override: subject.coefficient,
            });
            existingCoursKeys.add(key);
            result.coursCreated += 1;
          }
        }
      }

      const reglePayload = {
        mode_initialisation: wizardMode,
        annee_scolaire_id: activeYear.id,
        default_teacher_id: defaultTeacherId || null,
        teacher_assignments: Object.fromEntries(
          selectedLevels
            .map((niveau) => {
              const assignments = Object.fromEntries(
                getSelectedSubjectsForLevel(niveau.id)
                  .map((subject) => [subject.code, getTeacherAssignment(niveau.id, subject.code)] as const)
                  .filter(([, teacherId]) => Boolean(teacherId)),
              );

              return [niveau.id, assignments] as const;
            })
            .filter(([, assignments]) => Object.keys(assignments).length > 0),
        ),
        evaluation_types: evaluationTypes,
        note_rules: noteRules,
        bulletin_config: bulletinConfig,
        updated_at: new Date().toISOString(),
      };

      const configSaveResponse = await PedagogieInitialisationService.saveConfig({
        etablissement_id,
        annee_scolaire_id: activeYear.id,
        mode_initialisation: wizardMode,
        default_teacher_id: defaultTeacherId || null,
        teacher_assignments:
          (reglePayload.teacher_assignments as Record<string, Record<string, string>>) ??
          {},
        evaluation_types: evaluationTypes as PedagogieEvaluationTypeConfig[],
        note_rules: noteRules,
        bulletin_config: bulletinConfig,
      });

      const persistedConfig =
        ((configSaveResponse.data as PedagogieInitialisationConfigResponse | null)
          ?.config as PedagogieInitialisationConfigRecord | null) ?? null;
      setExistingConfig(persistedConfig);
      result.configUpdated = Boolean(existingConfig?.id);
      result.configCreated = !existingConfig?.id;

      setSummary(result);
      await loadData();
      info("Initialisation pedagogique validee pour l'annee scolaire courante.", "success");
      goToStep(12);
    } catch (error) {
      info(error, "error");
    } finally {
      setCommitting(false);
    }
  };

  const renderStepContent = () => {
    if (loading) {
      return <Spin label="Chargement du contexte pedagogique..." showLabel />;
    }

    switch (step) {
      case 0:
        return (
          <div className="grid min-w-0 gap-4 md:grid-cols-3">
            <InfoCard title="Annee active" value={activeYear?.nom ?? "Non definie"} helper={`${formatDate(activeYear?.date_debut)} - ${formatDate(activeYear?.date_fin)}`} />
            <InfoCard title="Niveaux" value={String(niveaux.length)} helper="Niveaux disponibles pour les programmes" />
            <InfoCard title="Classes" value={String(activeYearClasses.length)} helper="Classes de l'annee courante" />
            {!activeYear ? (
              <div className="md:col-span-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                Aucune année scolaire courante n’est définie.
              </div>
            ) : null}
          </div>
        );

      case 1:
        return (
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            {(["RAPIDE", "AVANCE"] as WizardMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setWizardMode(mode)}
                className={`rounded-[26px] border p-5 text-left transition ${wizardMode === mode ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
              >
                <p className="text-lg font-semibold text-slate-900">
                  {mode === "RAPIDE" ? "Initialisation rapide" : "Initialisation avancee"}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {mode === "RAPIDE"
                    ? "Utilise des valeurs scolaires standards pour aller vite."
                    : "Permet de personnaliser les periodes, les matieres, les coefficients et les regles."}
                </p>
              </button>
            ))}
          </div>
        );

      case 2:
        return (
          <div className="space-y-5">
            {periodes.length > 0 ? (
              <>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
                  Les periodes de l'annee active sont deja configurees dans
                  l'initialisation globale. Le wizard pedagogique va les reutiliser
                  pour les evaluations et les bulletins, sans les recreer.
                </div>
                <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {periodes.map((period) => (
                    <div key={period.id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="break-words font-semibold text-slate-900">{period.nom}</p>
                      <p className="mt-2 text-sm text-slate-500">
                        {formatDate(period.date_debut)} - {formatDate(period.date_fin)}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">Ordre {period.ordre ?? "-"}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                  Aucune periode n'a ete trouvee pour l'annee active. Cette
                  configuration devrait normalement venir de l'initialisation
                  globale de l'etablissement. Tu peux generer un secours ici si
                  necessaire.
                </div>
                <div className="grid min-w-0 gap-4 md:grid-cols-3">
                  {(["TRIMESTRE", "SEMESTRE", "PERSONNALISE"] as PeriodMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPeriodMode(mode)}
                      className={`rounded-2xl border p-4 text-left transition ${periodMode === mode ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                    >
                      <p className="font-semibold text-slate-900">{mode.toLowerCase()}</p>
                    </button>
                  ))}
                </div>
                <div className="space-y-3">
                  {periodDrafts.map((period, index) => (
                    <div key={`${period.nom}-${index}`} className="grid min-w-0 gap-3 rounded-2xl border border-slate-200 p-4 lg:grid-cols-[minmax(180px,1fr)_minmax(145px,180px)_minmax(145px,180px)_90px]">
                      <input className={getInputClassName(false)} value={period.nom} onChange={(event) => updatePeriod(index, { nom: event.target.value })} />
                      <input type="date" className={getInputClassName(false)} value={period.date_debut} onChange={(event) => updatePeriod(index, { date_debut: event.target.value })} />
                      <input type="date" className={getInputClassName(false)} value={period.date_fin} onChange={(event) => updatePeriod(index, { date_fin: event.target.value })} />
                      <input type="number" className={getInputClassName(false)} value={period.ordre} onChange={(event) => updatePeriod(index, { ordre: Number(event.target.value) })} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Les matieres cochees seront creees si elles n'existent pas. Les heures et coefficients affiches ici servent de valeurs de depart avant l'ajustement par niveau.
            </p>
            <div className="grid min-w-0 gap-3 2xl:grid-cols-2">
              {subjects.map((subject) => (
                <div key={subject.code} className={`min-w-0 rounded-2xl border p-4 ${subject.selected ? "border-sky-200 bg-sky-50" : "border-slate-200 bg-white"}`}>
                  <div className="flex min-w-0 items-start gap-3">
                    <input type="checkbox" checked={subject.selected} onChange={(event) => updateSubject(subject.code, { selected: event.target.checked })} className="mt-3 h-4 w-4 shrink-0" />
                    <div className="grid min-w-0 flex-1 gap-3 lg:grid-cols-[minmax(82px,105px)_minmax(160px,1fr)_minmax(110px,130px)_minmax(100px,120px)]">
                      <label className="min-w-0">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Code
                        </span>
                        <input aria-label="Code matiere" className={getInputClassName(false)} value={subject.code} onChange={(event) => updateSubject(subject.code, { code: event.target.value.toUpperCase() })} />
                      </label>
                      <label className="min-w-0">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Matiere
                        </span>
                        <input aria-label="Nom matiere" className={getInputClassName(false)} value={subject.nom} onChange={(event) => updateSubject(subject.code, { nom: event.target.value })} />
                      </label>
                      <label className="min-w-0">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Heures / sem.
                        </span>
                        <input aria-label="Heures par semaine" type="number" min={0} className={getInputClassName(false)} value={subject.heures_semaine} onChange={(event) => updateSubject(subject.code, { heures_semaine: Number(event.target.value) })} />
                      </label>
                      <label className="min-w-0">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Coef.
                        </span>
                        <input aria-label="Coefficient" type="number" min={0} step="0.5" className={getInputClassName(false)} value={subject.coefficient} onChange={(event) => updateSubject(subject.code, { coefficient: Number(event.target.value) })} />
                      </label>
                    </div>
                  </div>
                  {existingSubjectCodes.has(normalizeText(subject.code)) ? (
                    <p className="mt-3 text-xs font-semibold text-emerald-700">Matiere deja disponible</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            {niveaux.map((niveau) => (
              <div key={niveau.id} className="grid min-w-0 gap-3 rounded-2xl border border-slate-200 p-4 lg:grid-cols-[40px_minmax(140px,1fr)_minmax(220px,2fr)]">
                <input type="checkbox" checked={selectedLevelIds.includes(niveau.id)} onChange={(event) => setSelectedLevelIds((current) => event.target.checked ? [...current, niveau.id] : current.filter((id) => id !== niveau.id))} className="mt-3 h-4 w-4" />
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{niveau.nom}</p>
                  <p className="text-xs text-slate-500">Ordre {niveau.ordre ?? "-"}</p>
                </div>
                <input className={getInputClassName(false)} value={programmeNames[niveau.id] ?? buildProgrammeName(niveau)} onChange={(event) => setProgrammeNames((current) => ({ ...current, [niveau.id]: event.target.value }))} />
              </div>
            ))}
          </div>
        );

      case 5:
        return (
          <div className="space-y-5">
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-800">
              Chaque niveau peut avoir ses propres heures/semaine et coefficients
              pour une meme matiere. Ces valeurs seront enregistrees dans les
              lignes du programme du niveau.
            </div>

            {selectedLevels.map((niveau) => (
              <section key={niveau.id} className="min-w-0 rounded-[26px] border border-slate-200 bg-white p-4">
                <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="break-words text-lg font-semibold text-slate-900">{niveau.nom}</h4>
                    <p className="text-sm text-slate-500">
                      Programme : {programmeNames[niveau.id] ?? buildProgrammeName(niveau)}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {getSelectedSubjectsForLevel(niveau.id).length} matiere(s)
                  </span>
                </div>

                <div className="space-y-3">
                  {selectedSubjects.map((subject) => {
                    const setting = getLevelSubjectSetting(niveau.id, subject);

                    return (
                      <div
                        key={`${niveau.id}-${subject.code}`}
                        className={`grid min-w-0 gap-3 rounded-2xl border p-3 lg:grid-cols-[minmax(190px,1fr)_minmax(120px,150px)_minmax(110px,140px)] ${
                          setting.active ? "border-slate-200 bg-slate-50" : "border-slate-100 bg-white opacity-70"
                        }`}
                      >
                        <label className="flex min-w-0 items-start gap-3">
                          <input
                            type="checkbox"
                            checked={setting.active}
                            onChange={(event) =>
                              updateLevelSubjectSetting(niveau.id, subject, {
                                active: event.target.checked,
                              })
                            }
                            className="mt-1 h-4 w-4 shrink-0"
                          />
                          <span className="min-w-0">
                            <span className="block break-words font-semibold text-slate-900">
                              {subject.nom}
                            </span>
                            <span className="text-xs font-medium text-slate-500">
                              {subject.code}
                            </span>
                          </span>
                        </label>

                        <label className="min-w-0">
                          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Heures / sem.
                          </span>
                          <input
                            type="number"
                            min={0}
                            className={getInputClassName(false)}
                            value={setting.heures_semaine}
                            onChange={(event) =>
                              updateLevelSubjectSetting(niveau.id, subject, {
                                heures_semaine: Number(event.target.value),
                              })
                            }
                            disabled={!setting.active}
                          />
                        </label>

                        <label className="min-w-0">
                          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                            Coef.
                          </span>
                          <input
                            type="number"
                            min={0}
                            step="0.5"
                            className={getInputClassName(false)}
                            value={setting.coefficient}
                            onChange={(event) =>
                              updateLevelSubjectSetting(niveau.id, subject, {
                                coefficient: Number(event.target.value),
                              })
                            }
                            disabled={!setting.active}
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <label className="flex min-w-0 items-start gap-3 rounded-2xl border border-slate-200 p-4">
              <input type="checkbox" checked={generateCourses} onChange={(event) => setGenerateCourses(event.target.checked)} className="mt-1 shrink-0" />
              <span className="min-w-0 font-semibold leading-6 text-slate-900">Generer automatiquement les cours par classe depuis les programmes</span>
            </label>
            <div className="grid min-w-0 gap-3 md:grid-cols-3">
              <InfoCard title="Classes concernees" value={String(activeYearClasses.filter((classe) => selectedLevelIds.includes(classe.niveau_scolaire_id)).length)} helper="Classes de l'annee active" />
              <InfoCard
                title="Matieres par classe"
                value={String(
                  Math.max(
                    0,
                    ...activeYearClasses
                      .filter((classe) => selectedLevelIds.includes(classe.niveau_scolaire_id))
                      .map((classe) => getSelectedSubjectsForLevel(classe.niveau_scolaire_id).length),
                  )
                )}
                helper="Selon les associations du niveau"
              />
              <InfoCard title="Cours existants" value={String(activeYearCours.length)} helper="Ils ne seront pas recrees" />
            </div>
            <div className="max-h-72 overflow-auto rounded-2xl border border-slate-200">
              {activeYearClasses.map((classe) => (
                <div key={classe.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0">
                  <span className="min-w-0 break-words">{getClasseLabel(classe)}</span>
                  <span className="shrink-0 text-slate-500">{selectedLevelIds.includes(classe.niveau_scolaire_id) ? "Incluse" : "Ignoree"}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case 7:
        return (
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Enseignant par defaut
              </label>
              <select className={getInputClassName(false)} value={defaultTeacherId} onChange={(event) => setDefaultTeacherId(event.target.value)}>
                <option value="">Aucun enseignant par defaut</option>
                {enseignants.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>{getTeacherDisplayLabel(teacher)}</option>
                ))}
              </select>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Optionnel. Si tu choisis un enseignant ici, il sera reutilise
                partout sauf si une affectation plus precise est definie sur un
                niveau et une matiere.
              </p>
            </div>

            {missingTeacherAssignments.length > 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                Certaines lignes n'ont encore aucun enseignant explicite et
                aucun enseignant par defaut n'est defini.
              </div>
            ) : null}

            {conflictingTeacherAssignments.length > 0 ? (
              <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-800">
                Certaines combinaisons niveau-matiere utilisent deja plusieurs
                enseignants dans les cours existants. Le wizard ne force donc
                aucun pre-remplissage sur ces lignes pour te laisser choisir.
              </div>
            ) : null}

            <div className="space-y-4">
              {selectedLevels.map((niveau) => (
                <section key={niveau.id} className="rounded-[26px] border border-slate-200 bg-white p-4">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-semibold text-slate-900">{niveau.nom}</h4>
                      <p className="text-sm text-slate-500">
                        Choisis un enseignant pour chaque matiere active de ce niveau.
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {getSelectedSubjectsForLevel(niveau.id).length} matiere(s)
                    </span>
                  </div>

                  <div className="grid min-w-0 gap-3 md:grid-cols-2">
                    {getSelectedSubjectsForLevel(niveau.id).map((subject) => (
                      <div key={`${niveau.id}-${subject.code}`} className="min-w-0 rounded-2xl border border-slate-200 p-4">
                        <p className="mb-1 break-words font-semibold text-slate-900">{subject.nom}</p>
                        <p className="mb-3 text-xs text-slate-500">
                          {subject.code} • {subject.heures_semaine} h/sem. • coef. {subject.coefficient}
                        </p>
                        <select
                          className={getInputClassName(false)}
                          value={getTeacherAssignment(niveau.id, subject.code)}
                          onChange={(event) =>
                            updateTeacherAssignment(
                              niveau.id,
                              subject.code,
                              event.target.value,
                            )
                          }
                        >
                          <option value="">
                            {defaultTeacherId
                              ? "Utiliser l'enseignant par defaut"
                              : "Selectionner un enseignant"}
                          </option>
                          {enseignants.map((teacher) => (
                            <option key={teacher.id} value={teacher.id}>
                              {getTeacherDisplayLabel(teacher)}
                            </option>
                          ))}
                        </select>
                        {existingTeacherAssignments.assignments[niveau.id]?.[
                          normalizeText(subject.code)
                        ] &&
                        !existingTeacherAssignments.conflicts[niveau.id]?.[
                          normalizeText(subject.code)
                        ] ? (
                          <p className="mt-2 text-xs text-emerald-700">
                            Pre-rempli depuis les cours existants de ce niveau.
                          </p>
                        ) : null}
                        {(existingTeacherAssignments.conflicts[niveau.id]?.[
                          normalizeText(subject.code)
                        ]?.length ?? 0) > 1 ? (
                          <p className="mt-2 text-xs leading-5 text-amber-700">
                            Plusieurs enseignants deja detectes:{" "}
                            {existingTeacherAssignments.conflicts[niveau.id][
                              normalizeText(subject.code)
                            ].join(", ")}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        );

      case 8:
        return (
          <div className="space-y-4">
            <QuickAccessCard
              title="Structure pedagogique detaillee"
              description="Ouvre l'ecran dedie pour construire l'arbre matieres, domaines, sous-domaines, competences et objectifs utilises dans les evaluations et les bulletins."
              href="/pedagogie/structure_pedagogique"
              ctaLabel="Ouvrir la structure pedagogique"
            />
            <QuickAccessCard
              title="Edition avancee des types d'evaluation"
              description="Ouvre le module dedie pour ajuster les types apres l'initialisation, avec historique et CRUD complet."
              href="/pedagogie/types_evaluations"
              ctaLabel="Gerer les types d'evaluation"
            />
            {evaluationTypes.map((type, index) => (
              <div key={`${type.code}-${index}`} className="space-y-4 rounded-2xl border border-slate-200 p-4">
                <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(135px,160px)_minmax(180px,1fr)_minmax(95px,120px)_minmax(95px,120px)]">
                  <select className={getInputClassName(false)} value={type.code} onChange={(event) => updateEvaluationType(index, { code: event.target.value as EvaluationTypeDraft["code"] })}>
                    <option value="DEVOIR">Devoir</option>
                    <option value="EXAMEN">Examen</option>
                    <option value="ORAL">Oral</option>
                    <option value="AUTRE">Autre</option>
                  </select>
                  <input className={getInputClassName(false)} value={type.label} onChange={(event) => updateEvaluationType(index, { label: event.target.value })} />
                  <input type="number" min={0} step="0.5" className={getInputClassName(false)} value={type.poids} onChange={(event) => updateEvaluationType(index, { poids: Number(event.target.value) })} />
                  <input type="number" min={1} className={getInputClassName(false)} value={type.note_max} onChange={(event) => updateEvaluationType(index, { note_max: Number(event.target.value) })} />
                </div>

                <div className="grid min-w-0 gap-3 md:grid-cols-3">
                  <ToggleSetting
                    label="Entre dans la moyenne"
                    checked={type.include_in_average}
                    onChange={(value) =>
                      updateEvaluationType(index, { include_in_average: value })
                    }
                  />
                  <ToggleSetting
                    label="Visible dans bulletin detaille"
                    checked={type.show_in_report_card}
                    onChange={(value) =>
                      updateEvaluationType(index, { show_in_report_card: value })
                    }
                  />
                  <ToggleSetting
                    label="Considere comme examen final"
                    checked={type.is_final_exam}
                    onChange={(value) =>
                      updateEvaluationType(index, { is_final_exam: value })
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        );

      case 9:
        return (
          <div className="space-y-4">
            <QuickAccessCard
              title="Regles de notes completes"
              description="Le module dedie permet de revoir ces choix apres l'initialisation et pilote maintenant le calcul bulletin."
              href="/pedagogie/regles_notes"
              ctaLabel="Ouvrir les regles de notes"
            />
            <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <SelectSetting label="Calcul de moyenne" value={noteRules.moyenne} onChange={(value) => setNoteRules((current) => ({ ...current, moyenne: value as NoteRulesDraft["moyenne"] }))} options={[["PONDEREE", "Moyenne ponderee"], ["SIMPLE", "Moyenne simple"]]} />
              <SelectSetting label="Arrondi" value={noteRules.arrondi} onChange={(value) => setNoteRules((current) => ({ ...current, arrondi: value as NoteRulesDraft["arrondi"] }))} options={[["0.25", "0.25"], ["0.5", "0.5"], ["1", "1"]]} />
              <SelectSetting label="Notes manquantes" value={noteRules.missing_grade_policy} onChange={(value) => setNoteRules((current) => ({ ...current, missing_grade_policy: value as NoteRulesDraft["missing_grade_policy"] }))} options={[["IGNORE", "Ignorer"], ["ZERO", "Compter comme 0"], ["BLOCK", "Bloquer la moyenne"]]} />
              <SelectSetting label="Mode de classement" value={noteRules.ranking_mode} onChange={(value) => setNoteRules((current) => ({ ...current, ranking_mode: value as NoteRulesDraft["ranking_mode"] }))} options={[["COMPETITION", "Competition"], ["DENSE", "Dense"]]} />
              <ToggleSetting label="Absence non notee" checked={noteRules.absence_non_notee} onChange={(value) => setNoteRules((current) => ({ ...current, absence_non_notee: value }))} />
              <ToggleSetting label="Autoriser le rattrapage" checked={noteRules.autoriser_rattrapage} onChange={(value) => setNoteRules((current) => ({ ...current, autoriser_rattrapage: value }))} />
              <ToggleSetting label="Exclure les eleves non classes du rang" checked={noteRules.exclude_ungraded_from_ranking} onChange={(value) => setNoteRules((current) => ({ ...current, exclude_ungraded_from_ranking: value }))} />
            </div>
          </div>
        );

      case 10:
        return (
          <div className="space-y-4">
            <QuickAccessCard
              title="Modeles de bulletin detailles"
              description="Ouvre la gestion dediee des modeles pour previsualiser, dupliquer et definir le modele par defaut."
              href="/pedagogie/modeles_bulletins"
              ctaLabel="Ouvrir les modeles de bulletin"
            />
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]">
              <SelectSetting
                label="Type de modele"
                value={bulletinConfig.template_type}
                onChange={(value) =>
                  updateBulletinConfig({
                    template_type: value as ReportCardTemplateType,
                  })
                }
                options={[
                  ["STANDARD", "Standard recommande"],
                  ["DETAILED", "Detaille"],
                  ["ASSESSMENT_TYPE_SUMMARY", "Par type d'evaluation"],
                  ["FINAL_EXAM_ONLY", "Examen final uniquement"],
                  ["CUSTOM", "Personnalise"],
                ]}
              />
              <label className="block min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
                <span className="mb-2 block break-words font-semibold text-slate-900">
                  Description interne
                </span>
                <textarea
                  className={getInputClassName(false)}
                  value={bulletinConfig.description ?? ""}
                  onChange={(event) =>
                    updateBulletinConfig({ description: event.target.value })
                  }
                  rows={4}
                  placeholder="Ex: Bulletin standard officiel de l'etablissement"
                />
              </label>
            </div>

            <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <ToggleSetting label="Afficher les notes detaillees" checked={bulletinConfig.show_assessment_details} onChange={(value) => updateBulletinConfig({ show_assessment_details: value })} />
              <ToggleSetting label="Afficher la synthese par type" checked={bulletinConfig.show_assessment_type_summary} onChange={(value) => updateBulletinConfig({ show_assessment_type_summary: value })} />
              <ToggleSetting label="Afficher uniquement l'examen final" checked={bulletinConfig.show_only_final_exam} onChange={(value) => updateBulletinConfig({ show_only_final_exam: value })} />
              <ToggleSetting label="Afficher la moyenne matiere" checked={bulletinConfig.show_subject_average} onChange={(value) => updateBulletinConfig({ show_subject_average: value })} />
              <ToggleSetting label="Afficher le coefficient" checked={bulletinConfig.show_subject_coefficient} onChange={(value) => updateBulletinConfig({ show_subject_coefficient: value })} />
              <ToggleSetting label="Afficher les points" checked={bulletinConfig.show_subject_points} onChange={(value) => updateBulletinConfig({ show_subject_points: value })} />
              <ToggleSetting label="Afficher le rang matiere" checked={bulletinConfig.show_subject_rank} onChange={(value) => updateBulletinConfig({ show_subject_rank: value })} />
              <ToggleSetting label="Afficher l'appreciation enseignant" checked={bulletinConfig.show_teacher_appreciation} onChange={(value) => updateBulletinConfig({ show_teacher_appreciation: value })} />
              <ToggleSetting label="Afficher les absences" checked={bulletinConfig.show_absences} onChange={(value) => updateBulletinConfig({ show_absences: value })} />
              <ToggleSetting label="Afficher les retards" checked={bulletinConfig.show_late_count} onChange={(value) => updateBulletinConfig({ show_late_count: value })} />
              <ToggleSetting label="Afficher le logo" checked={bulletinConfig.show_logo} onChange={(value) => updateBulletinConfig({ show_logo: value })} />
              <ToggleSetting label="Afficher la signature" checked={bulletinConfig.show_signature} onChange={(value) => updateBulletinConfig({ show_signature: value })} />
              <ToggleSetting label="Afficher la moyenne generale" checked={bulletinConfig.show_general_average} onChange={(value) => updateBulletinConfig({ show_general_average: value })} />
              <ToggleSetting label="Afficher le total des coefficients" checked={bulletinConfig.show_total_coefficients} onChange={(value) => updateBulletinConfig({ show_total_coefficients: value })} />
              <ToggleSetting label="Afficher le total des points" checked={bulletinConfig.show_total_points} onChange={(value) => updateBulletinConfig({ show_total_points: value })} />
              <ToggleSetting label="Afficher le rang general" checked={bulletinConfig.show_general_rank} onChange={(value) => updateBulletinConfig({ show_general_rank: value })} />
              <ToggleSetting label="Afficher la mention" checked={bulletinConfig.show_mention} onChange={(value) => updateBulletinConfig({ show_mention: value })} />
              <ToggleSetting label="Afficher la decision" checked={bulletinConfig.show_decision} onChange={(value) => updateBulletinConfig({ show_decision: value })} />
              <ToggleSetting label="Afficher l'appreciation generale" checked={bulletinConfig.show_general_appreciation} onChange={(value) => updateBulletinConfig({ show_general_appreciation: value })} />
              <ToggleSetting label="Publier par defaut" checked={bulletinConfig.publier_par_defaut} onChange={(value) => updateBulletinConfig({ publier_par_defaut: value })} />
            </div>

            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-900">
              <p className="font-semibold">Apercu du modele actif</p>
              <p className="mt-2">
                {bulletinConfig.template_type === "STANDARD"
                  ? "Bulletin synthetique: la moyenne par matiere reste visible, sans details de devoirs."
                  : bulletinConfig.template_type === "DETAILED"
                    ? "Bulletin detaille: les notes publiees et autorisees par type d'evaluation pourront apparaitre en clair."
                    : bulletinConfig.template_type === "ASSESSMENT_TYPE_SUMMARY"
                      ? "Bulletin groupe: les notes seront resumees par type d'evaluation pour eviter une mise en page trop chargee."
                      : bulletinConfig.template_type === "FINAL_EXAM_ONLY"
                        ? "Bulletin cible examen final: seules les compositions ou examens finaux visibles apparaitront."
                        : "Bulletin personnalise: les options ci-dessus pilotent directement l'affichage final."}
              </p>
            </div>
          </div>
        );

      case 11:
      case 12:
        return (
          <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <InfoCard
              title="Periodes utilisees"
              value={String(periodes.length > 0 ? periodes.length : periodDrafts.length)}
              helper={periodes.length > 0 ? "Reutilisees depuis l'initialisation globale" : "A generer en secours"}
            />
            <InfoCard title="Matieres selectionnees" value={String(selectedSubjects.length)} helper={`${matieres.length} deja disponible(s)`} />
            <InfoCard title="Niveaux selectionnes" value={String(selectedLevels.length)} helper={`${activeYearProgrammes.length} programme(s) existant(s)`} />
            <InfoCard
              title="Cours potentiels"
              value={String(
                activeYearClasses
                  .filter((classe) => selectedLevelIds.includes(classe.niveau_scolaire_id))
                  .reduce(
                    (total, classe) =>
                      total + getSelectedSubjectsForLevel(classe.niveau_scolaire_id).length,
                    0,
                  )
              )}
              helper={`${activeYearCours.length} cours existant(s)`}
            />
            <InfoCard
              title="Enseignants"
              value={String(enseignants.length)}
              helper={
                missingTeacherAssignments.length === 0
                  ? "Affectation prete"
                  : `${missingTeacherAssignments.length} affectation(s) a completer`
              }
            />
            <InfoCard title="Configuration" value={existingConfig ? "Mise a jour" : "Creation"} helper="Evaluations, notes et bulletin" />
            {summary ? (
              <div className="md:col-span-2 xl:col-span-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                Derniere validation: {summary.periodesCreated} periode(s), {summary.matieresCreated} matiere(s), {summary.programmesCreated} programme(s), {summary.programmesUpdated} programme(s) complete(s), {summary.coursCreated} cours cree(s).
              </div>
            ) : null}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <ERPPage
      title="Initialisation pedagogique"
      description="Preparer les matieres, programmes, cours, evaluations, notes et bulletins de l'annee scolaire active."
      headerActions={[
        <button
          key="refresh"
          type="button"
          onClick={() => void loadData()}
          className="inline-flex max-w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          <FiRefreshCw />
          Recharger
        </button>,
      ]}
    >
      <div className="grid min-w-0 gap-6 xl:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-3 rounded-[30px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-auto">
          <div className="rounded-[24px] bg-slate-950 p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-200">Wizard</p>
            <h2 className="mt-2 text-xl font-semibold">Pédagogie annuelle</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Configuration guidée pour l'année courante uniquement.
            </p>
          </div>

          {STEP_DEFINITIONS.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => goToStep(index)}
              className={`flex min-w-0 w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${step === index ? "border-sky-300 bg-sky-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${index < step ? "bg-emerald-100 text-emerald-700" : step === index ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-500"}`}>
                {index < step ? <FiCheck /> : index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{label}</span>
              <FiChevronRight className={`shrink-0 ${step === index ? "text-sky-600" : "text-slate-300"}`} />
            </button>
          ))}
        </aside>

        <main className="min-w-0 space-y-5">
          <section className="min-w-0 overflow-hidden rounded-[32px] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Etape {step + 1} sur {STEP_DEFINITIONS.length}
                </p>
                <h3 className="mt-2 flex min-w-0 items-start gap-3 text-xl font-semibold text-slate-900 sm:text-2xl">
                  {getStepIcon(step)}
                  <span className="min-w-0 break-words">{STEP_DEFINITIONS[step]}</span>
                </h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                  {getStepDescription(step)}
                </p>
              </div>
            </div>

            <div className="mt-6 min-w-0">{renderStepContent()}</div>
          </section>

          <div className="flex min-w-0 flex-col-reverse gap-3 rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => goToStep(step - 1)}
              disabled={step === 0 || committing}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              Retour
            </button>

            {step < STEP_DEFINITIONS.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={committing}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                Continuer
                <FiChevronRight />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void commitInitialization()}
                disabled={committing || loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {committing ? <Spin inline /> : <FiCheck />}
                Valider l'initialisation
              </button>
            )}
          </div>
        </main>
      </div>
    </ERPPage>
  );
}

function InfoCard({ title, value, helper }: { title: string; value: string; helper: string }) {
  return (
    <div className="min-w-0 rounded-[24px] border border-slate-200 bg-slate-50 p-5">
      <p className="break-words text-sm font-semibold text-slate-600">{title}</p>
      <p className="mt-2 break-words text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-2 break-words text-sm leading-6 text-slate-500">{helper}</p>
    </div>
  );
}

function QuickAccessCard({
  title,
  description,
  href,
  ctaLabel,
}: {
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-[24px] border border-sky-200 bg-sky-50 p-5 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-sky-900">{title}</p>
        <p className="mt-2 text-sm leading-6 text-sky-800">{description}</p>
      </div>
      <a
        href={href}
        className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-sky-700 shadow-sm transition hover:bg-sky-100"
      >
        {ctaLabel}
      </a>
    </div>
  );
}

function ToggleSetting({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex min-w-0 items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4">
      <span className="min-w-0 break-words font-semibold leading-6 text-slate-900">{label}</span>
      <input className="mt-1 shrink-0" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function SelectSetting({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="block min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
      <span className="mb-2 block break-words font-semibold text-slate-900">{label}</span>
      <select className={getInputClassName(false)} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function getStepIcon(step: number) {
  if (step <= 1) return <FiSettings className="text-sky-600" />;
  if (step <= 5) return <FiBookOpen className="text-sky-600" />;
  if (step <= 8) return <FiUsers className="text-sky-600" />;
  if (step <= 10) return <FiEdit3 className="text-sky-600" />;
  if (step === 11) return <FiClipboard className="text-sky-600" />;
  return <FiLayers className="text-sky-600" />;
}

function getStepDescription(step: number) {
  const descriptions = [
    "Le wizard utilise automatiquement l'année scolaire active de l'établissement.",
    "Le mode rapide préremplit les valeurs standards. Le mode avancé laisse tout ajuster.",
    "Les périodes appartiennent à l'année active et servent aux évaluations et bulletins.",
    "Crée ou réutilise les matières de l'établissement sans doublon.",
    "Prépare un programme par niveau sur l'année active.",
    "Associe matières, volumes horaires et coefficients.",
    "Prévisualise la génération des cours par classe.",
    "Choisis les enseignants utilisés pendant la génération des cours.",
    "Configure les types d'évaluation proposés aux équipes.",
    "Définis les règles de calcul et d'arrondi des notes.",
    "Prépare les options de bulletin utilisées par l'établissement.",
    "Vérifie les volumes et les impacts avant validation.",
    "Lance l'initialisation idempotente : le système complète sans recréer les doublons.",
  ];
  return descriptions[step] ?? "";
}
