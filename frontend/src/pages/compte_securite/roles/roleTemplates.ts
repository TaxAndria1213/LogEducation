export type FeatureItem = {
  code: string;
  label: string;
  description: string;
};

export type FeatureGroup = {
  key: string;
  title: string;
  description: string;
  items: FeatureItem[];
};

export type RoleTemplate = {
  key: string;
  label: string;
  suggestedName: string;
  description: string;
  permissions: string[];
};

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    key: "etablissement",
    title: "Etablissement",
    description: "Configuration de la structure et du calendrier scolaire.",
    items: [
      {
        code: "ET.*",
        label: "Tous les modules etablissement",
        description: "Sites, salles, annees scolaires et periodes.",
      },
    ],
  },
  {
    key: "compte_securite",
    title: "Comptes & securite",
    description: "Utilisateurs, roles, profils, permissions et affectations.",
    items: [
      {
        code: "CS.UTILISATEURS.*",
        label: "Utilisateurs",
        description: "Gestion des comptes utilisateurs.",
      },
      {
        code: "CS.ROLES.*",
        label: "Roles",
        description: "Gestion des roles et des liens de creation.",
      },
      {
        code: "CS.PROFILS.*",
        label: "Profils",
        description: "Consultation et gestion des profils.",
      },
      {
        code: "CS.PERMISSIONS.*",
        label: "Permissions",
        description: "Catalogue fonctionnel des permissions.",
      },
      {
        code: "CS.AFFECTATIONS.*",
        label: "Affectations",
        description: "Affectation des roles et ajustements de scope.",
      },
    ],
  },
  {
    key: "scolarite",
    title: "Scolarite",
    description: "Parcours eleve, classes et inscriptions.",
    items: [
      {
        code: "SC.INSCRIPTIONS.*",
        label: "Inscriptions",
        description: "Nouvelles inscriptions et reinscriptions.",
      },
      { code: "SC.CLASSES.*", label: "Classes", description: "Organisation des classes." },
      {
        code: "SC.NIVEAUX.*",
        label: "Niveaux",
        description: "Parametrage des niveaux scolaires.",
      },
      {
        code: "SC.PARENTSTUTEURS.*",
        label: "Parents / tuteurs",
        description: "Responsables des eleves.",
      },
      {
        code: "SC.IDENTIFIANTS.*",
        label: "Identifiants eleves",
        description: "Documents et identifiants eleves.",
      },
      { code: "SC.ELEVES.*", label: "Eleves", description: "Fiches eleves et suivi." },
    ],
  },
  {
    key: "personnel",
    title: "Personnel",
    description: "Equipes et organisation interne.",
    items: [
      {
        code: "PE.PERSONNELS.*",
        label: "Personnels",
        description: "Fiches personnel et comptes rattaches.",
      },
      { code: "PE.ENSEIGNANTS.*", label: "Enseignants", description: "Profils enseignants." },
      {
        code: "PE.DEPARTEMENTS.*",
        label: "Departements",
        description: "Organisation pedagogique par departement.",
      },
    ],
  },
  {
    key: "pedagogie",
    title: "Pedagogie",
    description: "Organisation des enseignements et evaluations.",
    items: [
      { code: "PD.MATIERES.*", label: "Matieres", description: "Catalogue et pilotage des matieres." },
      {
        code: "PD.PROGRAMMES.*",
        label: "Programmes",
        description: "Programmes par niveau et annee.",
      },
      { code: "PD.COURS.*", label: "Cours", description: "Affectation des cours." },
      {
        code: "PD.EVALUATIONS.*",
        label: "Evaluations",
        description: "Controle continu et examens.",
      },
      { code: "PD.NOTES.*", label: "Notes", description: "Saisie et suivi des notes." },
      {
        code: "PD.BULLETINS.*",
        label: "Bulletins",
        description: "Generation et publication des bulletins.",
      },
      {
        code: "PD.REGLESNOTES.*",
        label: "Regles de notes",
        description: "Parametrage de la notation.",
      },
    ],
  },
  {
    key: "emploi_du_temps",
    title: "Emploi du temps & calendrier",
    description: "Planning des cours et evenements.",
    items: [
      {
        code: "EDT.EMPLOIDUTEMPS.*",
        label: "Emploi du temps",
        description: "Construction et consultation des EDT.",
      },
      { code: "EDT.EVENEMENTS.*", label: "Evenements", description: "Calendrier et evenements." },
    ],
  },
  {
    key: "presences",
    title: "Presences",
    description: "Appel, retards, justificatifs et suivi du personnel.",
    items: [
      {
        code: "PR.SESSIONSAPPEL.*",
        label: "Sessions d'appel",
        description: "Ouverture et suivi des appels.",
      },
      {
        code: "PR.PRESENCESELEVES.*",
        label: "Presences eleves",
        description: "Feuilles d'appel et statuts des eleves.",
      },
      {
        code: "PR.JUSTIFICATIFS.*",
        label: "Justificatifs",
        description: "Traitement des justificatifs d'absence.",
      },
      {
        code: "PR.PRESENCESPERSONNEL.*",
        label: "Presences personnel",
        description: "Suivi quotidien du personnel.",
      },
    ],
  },
  {
    key: "discipline",
    title: "Discipline",
    description: "Incidents, sanctions et recompenses eleves.",
    items: [
      { code: "DI.INCIDENTS.*", label: "Incidents", description: "Signalement et suivi des incidents eleves." },
      {
        code: "DI.SANCTIONS.*",
        label: "Sanctions",
        description: "Actions disciplinaires et decisions prises.",
      },
      {
        code: "DI.RECOMPENSES.*",
        label: "Recompenses",
        description: "Encouragements et valorisation du comportement.",
      },
    ],
  },
  {
    key: "finance",
    title: "Finance",
    description: "Tarifs, facturation et suivi financier.",
    items: [
      {
        code: "FIN.CATALOGUEFRAIS.*",
        label: "Catalogue de frais",
        description: "Tarifs et frais reutilisables de l'etablissement.",
      },
      {
        code: "FIN.REMISES.*",
        label: "Remises",
        description: "Reductions en pourcentage ou montant fixe.",
      },
      {
        code: "FIN.FACTURES.*",
        label: "Factures",
        description: "Emission, detail et suivi des factures eleves.",
      },
      {
        code: "FIN.PAIEMENTS.*",
        label: "Paiements",
        description: "Encaissements, references et suivi des reglements.",
      },
      {
        code: "FIN.PLANSPAIEMENT.*",
        label: "Plans de paiement",
        description: "Echeanciers et tranches de paiement par eleve.",
      },
      {
        code: "FIN.JOURNALFINANCIER.*",
        label: "Journal financier",
        description: "Audit des operations comptables, annulations, remboursements et avoirs.",
      },
    ],
  },
  {
    key: "transport_cantine",
    title: "Transport & cantine",
    description: "Services eleves, abonnements et parametres lies a la vie scolaire.",
    items: [
      {
        code: "TC.TRANSPORT.*",
        label: "Transport",
        description: "Lignes, arrets et abonnements transport des eleves.",
      },
      {
        code: "TC.CANTINE.*",
        label: "Cantine",
        description: "Formules et abonnements cantine des eleves.",
      },
    ],
  },
  {
    key: "bibliotheque",
    title: "Bibliotheque",
    description: "Ressources documentaires et circulation des emprunts.",
    items: [
      {
        code: "BI.RESSOURCES.*",
        label: "Ressources",
        description: "Catalogue des livres et materiels de bibliotheque.",
      },
      { code: "BI.EMPRUNTS.*", label: "Emprunts", description: "Prets, retours et suivi des retards." },
    ],
  },
];

export const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    key: "DIRECTION",
    label: "Direction",
    suggestedName: "Direction",
    description: "Pilotage transverse de l'etablissement sans administration pure.",
    permissions: ["ET.*", "SC.*", "PE.*", "PD.*", "EDT.*", "PR.*", "DI.*", "FIN.*", "TC.*", "BI.*"],
  },
  {
    key: "SECRETARIAT",
    label: "Secretariat",
    suggestedName: "Secretariat",
    description: "Orientation administrative, eleves et suivi quotidien.",
    permissions: ["ET.*", "SC.*", "PR.*", "DI.*", "TC.*", "BI.*"],
  },
  {
    key: "ENSEIGNANT",
    label: "Enseignant",
    suggestedName: "Enseignant",
    description: "Pedagogie, emploi du temps et presences.",
    permissions: ["PD.*", "EDT.*", "PR.*"],
  },
  {
    key: "COMPTABLE",
    label: "Comptable",
    suggestedName: "Comptable",
    description: "Acces restreint aux donnees utiles pour le suivi administratif et financier.",
    permissions: ["ET.*", "SC.*", "FIN.*", "TC.*"],
  },
  {
    key: "SURVEILLANT",
    label: "Surveillant",
    suggestedName: "Surveillant",
    description: "Controle terrain, appels et classes utiles au suivi.",
    permissions: ["PR.*", "EDT.*", "SC.CLASSES.*", "SC.ELEVES.*", "DI.*"],
  },
  {
    key: "PARENT",
    label: "Parent",
    suggestedName: "Parent",
    description: "Role minimal pour les comptes famille et parcours dedies.",
    permissions: [],
  },
  {
    key: "ELEVE",
    label: "Eleve",
    suggestedName: "Eleve",
    description: "Role minimal pour l'acces des eleves.",
    permissions: [],
  },
];
