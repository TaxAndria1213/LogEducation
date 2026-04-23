export type DefaultRoleTemplate = {
  key: string;
  label: string;
  suggestedName: string;
  nom: string;
  description: string;
  permissions: string[];
};

export const defaultRoleTemplates: DefaultRoleTemplate[] = [
  {
    key: "DIRECTION",
    label: "Direction",
    suggestedName: "Direction",
    nom: "Direction",
    description: "Pilotage transverse de l'etablissement sans administration pure.",
    permissions: [
      "ET.*",
      "SC.*",
      "PE.*",
      "PD.*",
      "EDT.*",
      "PR.*",
      "DI.*",
      "FIN.*",
      "TC.*",
      "BI.*",
    ],
  },
  {
    key: "SECRETARIAT",
    label: "Secretariat",
    suggestedName: "Secretariat",
    nom: "Secretariat",
    description: "Orientation administrative, eleves et suivi quotidien.",
    permissions: ["ET.*", "SC.*", "PR.*", "DI.*", "TC.*", "BI.*"],
  },
  {
    key: "ENSEIGNANT",
    label: "Enseignant",
    suggestedName: "Enseignant",
    nom: "Enseignant",
    description: "Pedagogie, emploi du temps et presences.",
    permissions: ["PD.*", "EDT.*", "PR.*"],
  },
  {
    key: "COMPTABLE",
    label: "Comptable",
    suggestedName: "Comptable",
    nom: "Comptable",
    description:
      "Acces restreint aux donnees utiles pour le suivi administratif et financier.",
    permissions: ["ET.*", "SC.*", "FIN.*", "TC.*"],
  },
  {
    key: "SURVEILLANT",
    label: "Surveillant",
    suggestedName: "Surveillant",
    nom: "Surveillant",
    description: "Controle terrain, appels et classes utiles au suivi.",
    permissions: ["PR.*", "EDT.*", "SC.CLASSES.*", "SC.ELEVES.*", "DI.*"],
  },
  {
    key: "PARENT",
    label: "Parent",
    suggestedName: "Parent",
    nom: "Parent",
    description: "Role minimal pour les comptes famille et parcours dedies.",
    permissions: [],
  },
  {
    key: "ELEVE",
    label: "Eleve",
    suggestedName: "Eleve",
    nom: "Eleve",
    description: "Role minimal pour l'acces des eleves.",
    permissions: [],
  },
];
