export type DefaultRoleTemplate = {
  nom: string;
  description: string;
};

export const defaultRoleTemplates: DefaultRoleTemplate[] = [
  {
    nom: "DIRECTION",
    description: "Pilotage general de l'etablissement et supervision transverse.",
  },
  {
    nom: "SCOLARITE",
    description: "Gestion des eleves, inscriptions, classes et referentiels scolaires.",
  },
  {
    nom: "FINANCE",
    description: "Facturation, paiements, relances et suivi financier.",
  },
  {
    nom: "ENSEIGNANT",
    description: "Production pedagogique, notes, bulletins et suivi de classes.",
  },
  {
    nom: "VIE_SCOLAIRE",
    description: "Presences, discipline, incidents, sanctions et recompenses.",
  },
  {
    nom: "BIBLIOTHEQUE",
    description: "Gestion documentaire, ressources et emprunts.",
  },
  {
    nom: "TRANSPORT",
    description: "Formules, lignes, arrets et droits d'acces transport.",
  },
  {
    nom: "CANTINE",
    description: "Abonnements, acces, consommation et suspensions cantine.",
  },
];
