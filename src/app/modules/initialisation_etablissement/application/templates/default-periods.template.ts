export type DefaultPeriodTemplate = {
  code: string;
  label: string;
  description: string;
  periodes: {
    nom: string;
    ordre: number;
  }[];
};

export const defaultPeriodTemplates: DefaultPeriodTemplate[] = [
  {
    code: "TRIMESTRES",
    label: "Trimestres",
    description: "Decoupage classique en trois periodes academiques de reference.",
    periodes: [
      { nom: "Trimestre 1", ordre: 1 },
      { nom: "Trimestre 2", ordre: 2 },
      { nom: "Trimestre 3", ordre: 3 },
    ],
  },
  {
    code: "SEMESTRES",
    label: "Semestres",
    description: "Organisation en deux grandes periodes pour un suivi plus large.",
    periodes: [
      { nom: "Semestre 1", ordre: 1 },
      { nom: "Semestre 2", ordre: 2 },
    ],
  },
  {
    code: "BIMESTRES",
    label: "Bimestres",
    description: "Repartition plus fine en cinq periodes de deux mois environ.",
    periodes: [
      { nom: "Bimestre 1", ordre: 1 },
      { nom: "Bimestre 2", ordre: 2 },
      { nom: "Bimestre 3", ordre: 3 },
      { nom: "Bimestre 4", ordre: 4 },
      { nom: "Bimestre 5", ordre: 5 },
    ],
  },
  {
    code: "SEQUENCES",
    label: "Sequences",
    description: "Cadre plus detaille en six sequences pour un pilotage rapproche.",
    periodes: [
      { nom: "Sequence 1", ordre: 1 },
      { nom: "Sequence 2", ordre: 2 },
      { nom: "Sequence 3", ordre: 3 },
      { nom: "Sequence 4", ordre: 4 },
      { nom: "Sequence 5", ordre: 5 },
      { nom: "Sequence 6", ordre: 6 },
    ],
  },
];
