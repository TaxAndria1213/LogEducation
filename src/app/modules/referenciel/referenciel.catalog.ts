export type ReferentialCategoryDefinition = {
  code: string;
  titre: string;
  description: string;
  fieldTargets: string[];
  defaultValues: string[];
};

export const REFERENTIAL_CATALOG: ReferentialCategoryDefinition[] = [
  {
    code: "PROFILE_GENRE",
    titre: "Genres",
    description: "Valeurs proposees pour les profils et les fiches eleves.",
    fieldTargets: ["profil.genre", "inscription.eleve.genre"],
    defaultValues: ["Homme", "Femme", "Autre"],
  },
  {
    code: "SCOLARITE_RELATION",
    titre: "Liens avec l'eleve",
    description:
      "Relations proposees pour les parents, tuteurs et contacts d'urgence.",
    fieldTargets: [
      "inscription.contact_urgence_relation",
      "inscription.tuteur1.relation",
      "inscription.tuteur2.relation",
    ],
    defaultValues: ["Pere", "Mere", "Tuteur", "Famille", "Autre"],
  },
  {
    code: "SALLE_TYPE",
    titre: "Types de salle",
    description: "Categories de salles utilisees dans le referentiel des locaux.",
    fieldTargets: ["salle.type"],
    defaultValues: [
      "Classe",
      "Laboratoire",
      "Bibliotheque",
      "Bureau",
      "Salle polyvalente",
    ],
  },
  {
    code: "PERSONNEL_STATUT",
    titre: "Statuts du personnel",
    description: "Statuts RH et administratifs utilises sur les fiches personnel.",
    fieldTargets: ["personnel.statut"],
    defaultValues: ["ACTIF", "EN_CONGE", "SUSPENDU", "SORTI"],
  },
  {
    code: "PERSONNEL_POSTE",
    titre: "Postes du personnel",
    description:
      "Postes et fonctions proposes pour le personnel de l'etablissement.",
    fieldTargets: ["personnel.poste"],
    defaultValues: [
      "Directeur",
      "Secretaire scolaire",
      "Comptable",
      "Surveillant",
      "Professeur",
    ],
  },
  {
    code: "IDENTIFIANT_ELEVE_TYPE",
    titre: "Types d'identifiant eleve",
    description:
      "Natures d'identifiants ou de pieces rattachees au dossier eleve.",
    fieldTargets: ["identifiant_eleve.type"],
    defaultValues: ["CARTE_SCOLAIRE", "MATRICULE", "CIN", "ACTE_NAISSANCE"],
  },
  {
    code: "EVENEMENT_TYPE",
    titre: "Types d'evenement calendrier",
    description:
      "Types d'evenements planifiables dans le calendrier d'etablissement.",
    fieldTargets: ["evenement_calendrier.type"],
    defaultValues: ["Activite", "Examen", "Reunion", "Sortie", "Evenement"],
  },
  {
    code: "PRESENCE_PERSONNEL_STATUT",
    titre: "Statuts de presence du personnel",
    description: "Statuts utilises pour les suivis de presence du personnel.",
    fieldTargets: ["presence_personnel.statut"],
    defaultValues: ["PRESENT", "ABSENT", "RETARD", "CONGE"],
  },
  {
    code: "FINANCE_DEVISE",
    titre: "Devises financieres",
    description: "Devises proposees pour le catalogue de frais et la facturation.",
    fieldTargets: ["catalogue_frais.devise", "finance.devise"],
    defaultValues: ["MGA", "EUR", "USD"],
  },
  {
    code: "DISCIPLINE_INCIDENT_STATUT",
    titre: "Statuts des incidents disciplinaires",
    description:
      "Statuts proposes pour suivre l'avancement des incidents disciplinaires.",
    fieldTargets: ["discipline.incident.statut"],
    defaultValues: ["OUVERT", "EN_COURS", "RESOLU", "CLOS"],
  },
  {
    code: "DISCIPLINE_SANCTION_TYPE",
    titre: "Types de sanctions disciplinaires",
    description:
      "Types d'actions disciplinaires pouvant etre rattaches a un incident.",
    fieldTargets: ["discipline.sanction.type_action"],
    defaultValues: [
      "Avertissement",
      "Retenue",
      "Convocation",
      "Exclusion temporaire",
      "Travail d'interet scolaire",
    ],
  },
  {
    code: "DISCIPLINE_RECOMPENSE_RAISON",
    titre: "Motifs de recompense",
    description:
      "Motifs valorisables pour les encouragements et recompenses eleves.",
    fieldTargets: ["discipline.recompense.raison"],
    defaultValues: [
      "Bon comportement",
      "Esprit d'entraide",
      "Participation active",
      "Assiduite",
      "Progression remarquable",
    ],
  },
];

export const REFERENTIAL_CODES = new Set(
  REFERENTIAL_CATALOG.map((item) => item.code),
);

export function getReferentialDefinition(code: string) {
  return REFERENTIAL_CATALOG.find((item) => item.code === code);
}
