export type StandardLevelTemplate = {
  code: string;
  nom: string;
  cycle: string;
  ordre: number;
};

export const standardLevelTemplates: StandardLevelTemplate[] = [
  { code: "MATERNELLE", nom: "Maternelle", cycle: "Prescolaire", ordre: 1 },
  { code: "PS", nom: "Petite Section", cycle: "Prescolaire", ordre: 2 },
  { code: "MS", nom: "Moyenne Section", cycle: "Prescolaire", ordre: 3 },
  { code: "GS", nom: "Grande Section", cycle: "Prescolaire", ordre: 4 },
  { code: "CP", nom: "CP", cycle: "Primaire", ordre: 5 },
  { code: "CE1", nom: "CE1", cycle: "Primaire", ordre: 6 },
  { code: "CE2", nom: "CE2", cycle: "Primaire", ordre: 7 },
  { code: "CM1", nom: "CM1", cycle: "Primaire", ordre: 8 },
  { code: "CM2", nom: "CM2", cycle: "Primaire", ordre: 9 },
  { code: "6E", nom: "6e", cycle: "College", ordre: 10 },
  { code: "5E", nom: "5e", cycle: "College", ordre: 11 },
  { code: "4E", nom: "4e", cycle: "College", ordre: 12 },
  { code: "3E", nom: "3e", cycle: "College", ordre: 13 },
  { code: "2NDE", nom: "Seconde", cycle: "Lycee", ordre: 14 },
  { code: "1ERE", nom: "Premiere", cycle: "Lycee", ordre: 15 },
  { code: "TLE", nom: "Terminale", cycle: "Lycee", ordre: 16 },
];
