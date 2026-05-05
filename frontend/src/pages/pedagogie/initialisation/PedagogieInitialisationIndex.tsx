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
  getMatiereDisplayLabel,
  type MatiereWithRelations,
} from "../../../services/matiere.service";
import NiveauScolaireService from "../../../services/niveau.service";
import PeriodeService from "../../../services/periode.service";
import ProgrammeService, {
  type ProgrammeLine,
  type ProgrammeWithRelations,
} from "../../../services/programme.service";
import RegleNoteService from "../../../services/regleNote.service";
import type {
  AnneeScolaire,
  Classe,
  NiveauScolaire,
  Periode,
  RegleNote,
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

type EvaluationTypeDraft = {
  code: "DEVOIR" | "EXAMEN" | "ORAL" | "AUTRE";
  label: string;
  poids: number;
  note_max: number;
};

type NoteRulesDraft = {
  moyenne: "PONDEREE" | "SIMPLE";
  arrondi: "0.25" | "0.5" | "1";
  absence_non_notee: boolean;
  autoriser_rattrapage: boolean;
};

type BulletinConfigDraft = {
  afficher_rang: boolean;
  afficher_absences: boolean;
  afficher_signature: boolean;
  afficher_decision: boolean;
  publier_par_defaut: boolean;
};

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
  { code: "DEVOIR", label: "Devoir", poids: 1, note_max: 20 },
  { code: "EXAMEN", label: "Composition", poids: 2, note_max: 20 },
  { code: "ORAL", label: "Oral / participation", poids: 1, note_max: 20 },
];

const SUMMARY_SCOPE = "PEDAGOGIE_INITIALISATION";

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

export default function PedagogieInitialisationIndex() {
  const { etablissement_id } = useAuth();
  const { info } = useInfo();

  const matiereService = useMemo(() => new MatiereService(), []);
  const niveauService = useMemo(() => new NiveauScolaireService(), []);
  const programmeService = useMemo(() => new ProgrammeService(), []);
  const classeService = useMemo(() => new ClasseService(), []);
  const coursService = useMemo(() => new CoursService(), []);
  const enseignantService = useMemo(() => new EnseignantService(), []);
  const regleNoteService = useMemo(() => new RegleNoteService(), []);

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
  const [regles, setRegles] = useState<RegleNote[]>([]);

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
  const [teacherBySubjectCode, setTeacherBySubjectCode] = useState<Record<string, string>>({});
  const [evaluationTypes, setEvaluationTypes] = useState<EvaluationTypeDraft[]>(DEFAULT_EVALUATION_TYPES);
  const [noteRules, setNoteRules] = useState<NoteRulesDraft>({
    moyenne: "PONDEREE",
    arrondi: "0.25",
    absence_non_notee: true,
    autoriser_rattrapage: true,
  });
  const [bulletinConfig, setBulletinConfig] = useState<BulletinConfigDraft>({
    afficher_rang: true,
    afficher_absences: true,
    afficher_signature: true,
    afficher_decision: true,
    publier_par_defaut: false,
  });
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

  const existingSubjectCodes = useMemo(
    () => new Set(matieres.map((item) => normalizeText(item.code))),
    [matieres],
  );

  const existingConfig = useMemo(
    () => regles.find((item) => item.scope === SUMMARY_SCOPE) ?? null,
    [regles],
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
      setRegles([]);
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
        reglesResult,
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
        regleNoteService.getAll({
          take: 1000,
          where: JSON.stringify({ etablissement_id }),
          orderBy: JSON.stringify([{ created_at: "desc" }]),
        }),
      ]);

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
      setRegles(reglesResult?.status.success ? ((reglesResult.data.data as RegleNote[]) ?? []) : []);

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

  const goToStep = (index: number) => {
    setStep(Math.max(0, Math.min(STEP_DEFINITIONS.length - 1, index)));
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  };

  const validateCurrentStep = () => {
    if (step === 0 && !activeYear?.id) return "Aucune annee scolaire active n'est configuree.";
    if (step === 2 && periodes.length === 0 && periodDrafts.length === 0) return "Aucune periode pedagogique n'est disponible pour l'annee active.";
    if (step === 3 && selectedSubjects.length === 0) return "Selectionne au moins une matiere.";
    if (step === 4 && selectedLevels.length === 0) return "Selectionne au moins un niveau.";
    if (step === 5 && selectedLevels.some((niveau) => getSelectedSubjectsForLevel(niveau.id).length === 0)) return "Chaque niveau selectionne doit garder au moins une matiere active.";
    if (step === 6 && generateCourses && activeYearClasses.length === 0) return "Aucune classe n'existe sur l'annee active.";
    if (step === 7 && generateCourses && enseignants.length === 0) return "Aucun enseignant n'est disponible pour generer les cours.";
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

  const commitInitialization = async () => {
    if (!etablissement_id) {
      info("Aucun etablissement actif n'est disponible.", "error");
      return;
    }
    if (!activeYear?.id) {
      info("Aucune annee scolaire active n'est disponible.", "error");
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
    if (generateCourses && enseignants.length > 0 && !defaultTeacherId) {
      info("Choisis un enseignant par defaut pour generer les cours.", "error");
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

            const teacherId = teacherBySubjectCode[subject.code] || defaultTeacherId;
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
        evaluation_types: evaluationTypes,
        note_rules: noteRules,
        bulletin_config: bulletinConfig,
        updated_at: new Date().toISOString(),
      };

      if (existingConfig?.id) {
        await regleNoteService.update(existingConfig.id, {
          etablissement_id,
          scope: SUMMARY_SCOPE,
          regle_json: reglePayload,
        });
        result.configUpdated = true;
      } else {
        await regleNoteService.create({
          etablissement_id,
          scope: SUMMARY_SCOPE,
          regle_json: reglePayload,
        });
        result.configCreated = true;
      }

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
                Aucune annee scolaire active n'est configuree. Active une annee dans les parametres globaux avant de continuer.
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
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Enseignant par defaut</label>
              <select className={getInputClassName(false)} value={defaultTeacherId} onChange={(event) => setDefaultTeacherId(event.target.value)}>
                <option value="">Selectionner un enseignant</option>
                {enseignants.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>{getTeacherDisplayLabel(teacher)}</option>
                ))}
              </select>
            </div>
            <div className="grid min-w-0 gap-3 md:grid-cols-2">
              {selectedSubjects.map((subject) => (
                <div key={subject.code} className="min-w-0 rounded-2xl border border-slate-200 p-4">
                  <p className="mb-2 break-words font-semibold text-slate-900">{subject.nom}</p>
                  <select className={getInputClassName(false)} value={teacherBySubjectCode[subject.code] ?? ""} onChange={(event) => setTeacherBySubjectCode((current) => ({ ...current, [subject.code]: event.target.value }))}>
                    <option value="">Utiliser l'enseignant par defaut</option>
                    {enseignants.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>{getTeacherDisplayLabel(teacher)}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        );

      case 8:
        return (
          <div className="space-y-3">
            {evaluationTypes.map((type, index) => (
              <div key={`${type.code}-${index}`} className="grid min-w-0 gap-3 rounded-2xl border border-slate-200 p-4 lg:grid-cols-[minmax(135px,160px)_minmax(180px,1fr)_minmax(95px,120px)_minmax(95px,120px)]">
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
            ))}
          </div>
        );

      case 9:
        return (
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <SelectSetting label="Calcul de moyenne" value={noteRules.moyenne} onChange={(value) => setNoteRules((current) => ({ ...current, moyenne: value as NoteRulesDraft["moyenne"] }))} options={[["PONDEREE", "Moyenne ponderee"], ["SIMPLE", "Moyenne simple"]]} />
            <SelectSetting label="Arrondi" value={noteRules.arrondi} onChange={(value) => setNoteRules((current) => ({ ...current, arrondi: value as NoteRulesDraft["arrondi"] }))} options={[["0.25", "0.25"], ["0.5", "0.5"], ["1", "1"]]} />
            <ToggleSetting label="Absence non notee" checked={noteRules.absence_non_notee} onChange={(value) => setNoteRules((current) => ({ ...current, absence_non_notee: value }))} />
            <ToggleSetting label="Autoriser le rattrapage" checked={noteRules.autoriser_rattrapage} onChange={(value) => setNoteRules((current) => ({ ...current, autoriser_rattrapage: value }))} />
          </div>
        );

      case 10:
        return (
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <ToggleSetting label="Afficher le rang" checked={bulletinConfig.afficher_rang} onChange={(value) => setBulletinConfig((current) => ({ ...current, afficher_rang: value }))} />
            <ToggleSetting label="Afficher les absences" checked={bulletinConfig.afficher_absences} onChange={(value) => setBulletinConfig((current) => ({ ...current, afficher_absences: value }))} />
            <ToggleSetting label="Afficher la signature" checked={bulletinConfig.afficher_signature} onChange={(value) => setBulletinConfig((current) => ({ ...current, afficher_signature: value }))} />
            <ToggleSetting label="Afficher la decision" checked={bulletinConfig.afficher_decision} onChange={(value) => setBulletinConfig((current) => ({ ...current, afficher_decision: value }))} />
            <ToggleSetting label="Publier par defaut" checked={bulletinConfig.publier_par_defaut} onChange={(value) => setBulletinConfig((current) => ({ ...current, publier_par_defaut: value }))} />
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
            <InfoCard title="Enseignants" value={String(enseignants.length)} helper={defaultTeacherId ? "Affectation prete" : "Affectation a verifier"} />
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
