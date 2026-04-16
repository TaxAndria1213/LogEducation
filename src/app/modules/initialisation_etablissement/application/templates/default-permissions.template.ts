export type DefaultPermissionTemplate = {
  code: string;
  description: string;
};

export const defaultPermissionTemplates: DefaultPermissionTemplate[] = [
  { code: "voir", description: "Consulter les donnees du bloc." },
  { code: "creer", description: "Creer une nouvelle donnee." },
  { code: "modifier", description: "Mettre a jour une donnee existante." },
  { code: "supprimer", description: "Supprimer ou archiver une donnee." },
  { code: "valider", description: "Valider un workflow ou une demande." },
  { code: "suspendre", description: "Suspendre temporairement un droit ou un acces." },
  { code: "reactiver", description: "Restaurer un droit suspendu." },
  { code: "exporter", description: "Extraire les donnees ou documents." },
  { code: "corriger", description: "Corriger une donnee deja enregistree." },
  { code: "cloturer", description: "Cloturer une periode ou un processus." },
];
