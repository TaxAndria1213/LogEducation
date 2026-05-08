export type RoleName =
  | "ADMIN"
  | "DIRECTION"
  | "SECRETARIAT"
  | "ENSEIGNANT"
  | "COMPTABLE"
  | "SURVEILLANT"
  | "PARENT"
  | "ELEVE";

export type MobileTabKey =
  | "Home"
  | "Classes"
  | "Notes"
  | "Messages"
  | "Agenda"
  | "Presence"
  | "Academic"
  | "Operations"
  | "Profile";

export type Role = {
  id: string;
  nom: string;
};

export type UtilisateurRole = {
  role?: Role | null;
  scope_json?: unknown;
};

export type Profil = {
  prenom?: string | null;
  nom?: string | null;
  photo_url?: string | null;
  adresse?: string | null;
};

export type Etablissement = {
  id: string;
  nom?: string | null;
  code?: string | null;
};

export type Utilisateur = {
  id: string;
  etablissement_id?: string | null;
  email?: string | null;
  telephone?: string | null;
  profil?: Profil | null;
  roles?: UtilisateurRole[] | null;
  etablissement?: Etablissement | null;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type PersistedSession = {
  user: Utilisateur;
  tokens: AuthTokens;
  activeRole: RoleName;
};

export type ApiEnvelope<T> = {
  status?: {
    code?: number;
    success?: boolean;
    message?: string;
  };
  data: T;
};

export type CollectionMeta = {
  take?: number;
  skip?: number;
  page?: number;
  total?: number;
  hasNextPage?: boolean;
};

export type PaginatedCollection<T> = {
  data: T[];
  meta?: CollectionMeta;
};

export type ClasseLite = {
  id: string;
  nom?: string | null;
  niveau?: {
    id: string;
    nom?: string | null;
  } | null;
  site?: {
    id: string;
    nom?: string | null;
  } | null;
};

export type CreneauLite = {
  id: string;
  nom?: string | null;
  heure_debut?: string | null;
  heure_fin?: string | null;
};

export type MatiereLite = {
  id: string;
  nom?: string | null;
  code?: string | null;
};

export type PersonnelLite = {
  id: string;
  code_personnel?: string | null;
  poste?: string | null;
  utilisateur?: {
    id?: string;
    profil?: Profil | null;
  } | null;
};

export type EnseignantLite = {
  id: string;
  personnel?: PersonnelLite | null;
};

export type EleveLite = {
  id: string;
  code_eleve?: string | null;
  utilisateur?: {
    id?: string;
    profil?: Profil | null;
  } | null;
  inscriptions?: Array<{
    id: string;
    classe_id: string;
    statut?: string | null;
    classe?: ClasseLite | null;
  }> | null;
};

export type ParentTuteurLite = {
  id: string;
  nom_complet?: string | null;
  utilisateur_id?: string | null;
  eleves?: Array<{
    eleve_id: string;
    relation?: string | null;
    est_principal?: boolean;
    eleve?: EleveLite | null;
  }> | null;
};

export type EmploiDuTempsItem = {
  id: string;
  cours_id?: string | null;
  classe_id?: string | null;
  enseignant_id?: string | null;
  heure_debut?: string | null;
  heure_fin?: string | null;
  creneau_horaire_id?: string | null;
  jour_semaine?: number | string | null;
  type_portee?: string | null;
  effectif_du?: string | null;
  effectif_au?: string | null;
  classe?: ClasseLite | null;
  cours?: {
    id: string;
    matiere?: MatiereLite | null;
  } | null;
  matiere?: MatiereLite | null;
  enseignant?: EnseignantLite | null;
  creneau?: CreneauLite | null;
  salle?: {
    id: string;
    nom?: string | null;
  } | null;
};

export type SessionAppelItem = {
  id: string;
  classe_id?: string | null;
  emploi_du_temps_id?: string | null;
  creneau_horaire_id?: string | null;
  date?: string | null;
  pris_par_enseignant_id?: string | null;
  pris_le?: string | null;
  classe?: ClasseLite | null;
  emploi?: EmploiDuTempsItem | null;
  creneau?: CreneauLite | null;
  presences?: Array<{
    id: string;
    statut?: string | null;
  }> | null;
};

export type EvaluationItem = {
  id: string;
  cree_par_enseignant_id?: string | null;
  titre?: string | null;
  date?: string | null;
  note_max?: number | null;
  cours?: {
    id: string;
    classe?: ClasseLite | null;
    matiere?: MatiereLite | null;
  } | null;
};

export type NoteItem = {
  id: string;
  score?: number | null;
  note_le?: string | null;
  evaluation?: EvaluationItem | null;
  eleve?: EleveLite | null;
};

export type BulletinLigneItem = {
  id: string;
  moyenne?: number | null;
  matiere?: MatiereLite | null;
};

export type BulletinItem = {
  id: string;
  statut?: string | null;
  eleve?: EleveLite | null;
  classe?: ClasseLite | null;
  periode?: {
    id: string;
    nom?: string | null;
  } | null;
  lignes?: BulletinLigneItem[] | null;
};

export type JustificatifItem = {
  id: string;
  date_debut?: string | null;
  date_fin?: string | null;
  statut?: string | null;
  eleve?: EleveLite | null;
  motif?: {
    id: string;
    nom?: string | null;
  } | null;
};

export type PresenceEleveItem = {
  id: string;
  session_appel_id?: string | null;
  eleve_id?: string | null;
  statut?: string | null;
  minutes_retard?: number | null;
  note?: string | null;
  eleve?: EleveLite | null;
  session?: SessionAppelItem | null;
};

export type PresencePersonnelItem = {
  id: string;
  date?: string | null;
  statut?: string | null;
  personnel?: PersonnelLite | null;
};

export type StaffItem = {
  id: string;
  code_personnel?: string | null;
  poste?: string | null;
  utilisateur?: {
    profil?: Profil | null;
  } | null;
};

export type FeedMetric = {
  id: string;
  label: string;
  value: string;
  tone?: "primary" | "success" | "warning" | "danger" | "info";
};

export type FeedItem = {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  accent?: "primary" | "success" | "warning" | "danger" | "info";
};

export type QuickAction = {
  id: string;
  label: string;
  description: string;
  target: MobileTabKey;
};

export type HomeBundle = {
  heading: string;
  subtitle: string;
  metrics: FeedMetric[];
  quickActions: QuickAction[];
  highlights: FeedItem[];
};

export type FeedBundle = {
  title: string;
  subtitle: string;
  items: FeedItem[];
};

export type TeacherAttendanceCourse = {
  id: string;
  className: string;
  subjectName: string;
  roomName: string;
  slotLabel: string;
  startsAt: string;
  endsAt: string;
  timingState: "current" | "upcoming" | "completed";
};

export type TeacherAttendanceStudent = {
  id: string;
  eleveId: string;
  name: string;
  code: string;
  status: "PRESENT" | "ABSENT" | "RETARD" | "EXCUSE";
  minutesLate: number | null;
  note: string | null;
};

export type TeacherAttendanceBundle = {
  title: string;
  subtitle: string;
  todayCourses: TeacherAttendanceCourse[];
  selectedCourse: TeacherAttendanceCourse | null;
  currentCourse: TeacherAttendanceCourse | null;
  nextCourse: TeacherAttendanceCourse | null;
  sessionId: string | null;
  sessionStatus: "ready" | "idle";
  students: TeacherAttendanceStudent[];
};

export type TeacherDashboardCourse = {
  id: string;
  classId: string;
  className: string;
  levelName: string;
  subjectName: string;
  roomName: string;
  startTime: string;
  endTime: string;
  slotLabel: string;
  status: "EN_COURS" | "A_VENIR" | "TERMINE";
};

export type TeacherDashboardData = {
  teacher: {
    id: string;
    fullName: string;
    firstName?: string | null;
  };
  academicYear: {
    id: string;
    name: string;
  };
  todayDate: string;
  stats: {
    classCount: number;
    totalCourses: number;
    coursesToday: number;
    pendingGradeSheets: number;
    pendingRemarks: number;
    unreadMessages: number;
    recentAbsences: number;
  };
  todayCourses: TeacherDashboardCourse[];
  upcomingEvaluations: Array<{
    id: string;
    title: string;
    date: string;
    className: string;
    subjectName: string;
    status: "PUBLIEE" | "BROUILLON";
  }>;
};

export type TeacherClassAssignment = {
  id: string;
  courseId: string;
  classId: string;
  className: string;
  levelName: string;
  siteName?: string | null;
  subjectName: string;
  studentCount: number;
  evaluationCount: number;
  recentAbsences: number;
  averageScore: number | null;
};

export type TeacherClassesResponse = {
  academicYear: {
    id: string;
    name: string;
  };
  items: TeacherClassAssignment[];
};

export type TeacherClassDetail = {
  academicYear: {
    id: string;
    name: string;
  };
  class: {
    courseId: string;
    classId: string;
    className: string;
    levelName: string;
    siteName?: string | null;
    subjectName: string;
    studentCount: number;
    evaluationCount: number;
    averageScore: number | null;
  };
  students: Array<{
    eleveId: string;
    code: string;
    fullName: string;
    photoUrl?: string | null;
    averageScore: number | null;
    absences: number;
    retards: number;
    lastAttendanceStatus?: string | null;
    difficulty: boolean;
  }>;
};

export type TeacherCourseSummary = {
  id: string;
  classId: string;
  className: string;
  levelName: string;
  subjectName: string;
  coefficient: number | null;
  weeklyHours: number;
  evaluationCount: number;
  totalNotes: number;
  pendingEvaluations: number;
  averageScore: number | null;
  progressionPercent: number | null;
};

export type TeacherCoursesResponse = {
  academicYear: {
    id: string;
    name: string;
  };
  items: TeacherCourseSummary[];
};

export type TeacherEvaluationProgress = {
  id: string;
  title: string;
  date: string;
  className: string;
  subjectName: string;
  noteMax: number;
  enteredNotes: number;
  expectedNotes: number;
  completionRate: number;
  status: "COMPLET" | "EN_SAISIE" | "BROUILLON";
};

export type TeacherNotesOverview = {
  academicYear: {
    id: string;
    name: string;
  };
  stats: {
    totalCourses: number;
    totalEvaluations: number;
    pendingEvaluations: number;
    completedEvaluations: number;
  };
  items: TeacherEvaluationProgress[];
};

export type TeacherProfileData = {
  id: string;
  fullName: string;
  matricule?: string | null;
  email?: string | null;
  telephone?: string | null;
  address?: string | null;
  photoUrl?: string | null;
  specialty?: string | null;
  academicYearName: string;
  subjects: string[];
  classes: string[];
};

export type TeacherEvaluationFormOptions = {
  academicYear: {
    id: string;
    name: string;
  };
  courses: Array<{
    id: string;
    levelId: string;
    subjectId: string;
    className: string;
    levelName: string;
    subjectName: string;
  }>;
  periods: Array<{
    id: string;
    nom?: string | null;
    date_debut: string;
    date_fin: string;
  }>;
  typeOptions: Array<{
    value: string;
    label: string;
  }>;
  typeReferences: Array<{
    id: string;
    nom: string;
    poids_defaut?: number | null;
    default_max_score?: number | null;
    include_in_average?: boolean;
    show_in_report_card?: boolean;
    is_final_exam?: boolean;
  }>;
  pedagogicalItems: Array<{
    id: string;
    nom: string;
    item_type: string;
    niveau_scolaire_id: string;
    matiere_id?: string | null;
    parent_id?: string | null;
    parent?: {
      id: string;
      nom: string;
    } | null;
  }>;
  gradingScales: Array<{
    id: string;
    nom: string;
    grading_type: string;
    base_score?: number | null;
    use_for_calculation: boolean;
    allow_decimal: boolean;
    is_default: boolean;
  }>;
};

export type TeacherCreateEvaluationPayload = {
  cours_id: string;
  periode_id: string;
  pedagogical_item_id?: string | null;
  grading_scale_id?: string | null;
  titre: string;
  date: string;
  type: string;
  note_max: number;
  poids?: number | null;
  est_publiee?: boolean;
  include_in_average?: boolean;
  show_in_report_card?: boolean;
  is_final_exam?: boolean;
  type_evaluation_id?: string | null;
};

export type TeacherEvaluationDetail = {
  id: string;
  cours_id: string;
  periode_id: string;
  pedagogical_item_id?: string | null;
  grading_scale_id?: string | null;
  titre: string;
  date: string;
  type: string;
  note_max: number;
  poids?: number | null;
  est_publiee: boolean;
  include_in_average?: boolean;
  show_in_report_card?: boolean;
  is_final_exam?: boolean;
  type_evaluation_id?: string | null;
  className: string;
  subjectName: string;
};

export type TeacherGradeSheet = {
  evaluation: {
    id: string;
    title: string;
    date: string;
    noteMax: number;
    status: "PUBLIEE" | "BROUILLON";
    workflowStatus?: string | null;
    gradingScaleId?: string | null;
    gradingScaleName?: string | null;
    gradingType: string;
    gradingBaseScore: number;
    gradingLevels: Array<{
      id: string;
      code: string;
      label: string;
      color?: string | null;
      numericValue?: number | null;
    }>;
    periodName: string;
    className: string;
    levelName: string;
    subjectName: string;
  };
  students: Array<{
    eleveId: string;
    inscriptionId: string;
    noteId: string | null;
    resultId?: string | null;
    fullName: string;
    code: string;
    score: number | null;
    status: string;
    scaleLevelId?: string | null;
    textValue?: string;
    displayValue?: string;
    comment: string;
  }>;
};
