export type InitialisationBlockMode =
  | "CREATION"
  | "REPRISE"
  | "REPRISE_MODIFIEE"
  | "DESACTIVEE"
  | "PLUS_TARD";

export type InitialisationPreviewBlock = {
  code: string;
  libelle: string;
  mode: InitialisationBlockMode;
  statut: "PRET" | "DIFFERE" | "IGNORE";
  description: string;
  estimation_creation: number;
  execution_disponible: boolean;
};

export type InitialisationStatus = {
  etablissement: {
    id: string;
    nom: string;
    code?: string | null;
    created_at?: string | Date;
  };
  active_year?: {
    id: string;
    nom: string;
    date_debut?: string | Date;
    date_fin?: string | Date;
  } | null;
  counts: {
    sites: number;
    annees: number;
    niveaux: number;
    classes: number;
    departements: number;
    matieres: number;
    roles: number;
    permissions: number;
    lignes_transport: number;
    formules_cantine: number;
  };
  completion_rate: number;
  ready_for_operational_start: boolean;
  ready_for_new_school_year: boolean;
};

export type InitialisationSession = {
  id: string;
  type: "NOUVEL_ETABLISSEMENT" | "NOUVELLE_ANNEE_SCOLAIRE" | string;
  label: string;
  statut: string;
  created_at?: string | Date;
  summary: string;
  details?: Record<string, unknown>;
};

export type InitialisationTemplates = {
  niveaux_standards: {
    code: string;
    nom: string;
    cycle: string;
    ordre: number;
  }[];
  roles_standards: {
    nom: string;
    description: string;
  }[];
  permissions_standards: {
    code: string;
    description: string;
  }[];
  departements_standards: string[];
};

export type InitialisationPreview = {
  type: string;
  payload: Record<string, unknown>;
  blocks: InitialisationPreviewBlock[];
  estimated_creates: number;
  ready_blocks: number;
  deferred_blocks: number;
  warnings: string[];
  current_status: InitialisationStatus;
  source_year?: {
    id: string;
    nom: string;
  } | null;
};

export type InitialisationCommitResult = {
  type: string;
  created: Record<string, number>;
  skipped: string[];
  warnings: string[];
  deferred_blocks: string[];
  etablissement?: {
    id: string;
    nom: string;
  };
  annee?: {
    id: string;
    nom: string;
  };
};

export type InitialisationClassGroup = {
  level_code: string;
  level_nom: string;
  class_names: string[];
};

export type InitialisationAcademicSubject = {
  nom: string;
  code: string;
  heures_semaine: string;
  coefficient: string;
};

export type InitialisationAcademicGroup = {
  level_code: string;
  level_nom: string;
  programme_nom: string;
  subjects: InitialisationAcademicSubject[];
};

export type InitialisationSetupDraft = {
  etablissement_id: string;
  include_site_principal: boolean;
  site_principal_nom: string;
  site_principal_adresse: string;
  site_principal_telephone: string;
  create_initial_year: boolean;
  annee_nom: string;
  annee_date_debut: string;
  annee_date_fin: string;
  selected_level_codes: string[];
  custom_levels: string;
  classes_by_level: InitialisationClassGroup[];
  academic_by_level: InitialisationAcademicGroup[];
  create_default_departements: boolean;
  classes_mode: InitialisationBlockMode;
  academic_mode: InitialisationBlockMode;
  security_mode: InitialisationBlockMode;
  finance_mode: InitialisationBlockMode;
  services_mode: InitialisationBlockMode;
  audit_mode: InitialisationBlockMode;
};

export type NouvelleAnneeDraft = {
  etablissement_id: string;
  nom: string;
  date_debut: string;
  date_fin: string;
  source_annee_id: string;
  copy_periodes: boolean;
  close_current_year: boolean;
  references_mode: InitialisationBlockMode;
  finance_mode: InitialisationBlockMode;
  services_mode: InitialisationBlockMode;
};
