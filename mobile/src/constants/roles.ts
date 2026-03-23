import type { MobileTabKey, QuickAction, RoleName } from "@/types/models";

export const ROLE_PRIORITY: RoleName[] = [
  "ADMIN",
  "DIRECTION",
  "SECRETARIAT",
  "ENSEIGNANT",
  "COMPTABLE",
  "SURVEILLANT",
  "PARENT",
  "ELEVE",
];

export const ROLE_LABELS: Record<RoleName, string> = {
  ADMIN: "Admin",
  DIRECTION: "Direction",
  SECRETARIAT: "Secretariat",
  ENSEIGNANT: "Enseignant",
  COMPTABLE: "Comptable",
  SURVEILLANT: "Surveillant",
  PARENT: "Parent",
  ELEVE: "Eleve",
};

export const ROLE_TABS: Record<RoleName, MobileTabKey[]> = {
  ADMIN: ["Home", "Agenda", "Operations", "Profile"],
  DIRECTION: ["Home", "Agenda", "Presence", "Academic", "Profile"],
  SECRETARIAT: ["Home", "Presence", "Operations", "Profile"],
  ENSEIGNANT: ["Home", "Agenda", "Presence", "Academic", "Profile"],
  COMPTABLE: ["Home", "Operations", "Profile"],
  SURVEILLANT: ["Home", "Agenda", "Presence", "Profile"],
  PARENT: ["Home", "Agenda", "Academic", "Operations", "Profile"],
  ELEVE: ["Home", "Agenda", "Academic", "Profile"],
};

export const ROLE_QUICK_ACTIONS: Record<RoleName, QuickAction[]> = {
  ADMIN: [
    { id: "admin-ops", label: "Operations", description: "Utilisateurs et personnels", target: "Operations" },
    { id: "admin-agenda", label: "Agenda", description: "Vision etablissement", target: "Agenda" },
  ],
  DIRECTION: [
    { id: "dir-presence", label: "Presences", description: "Sessions et justificatifs", target: "Presence" },
    { id: "dir-academic", label: "Pedagogie", description: "Cours et bulletins", target: "Academic" },
  ],
  SECRETARIAT: [
    { id: "sec-presence", label: "Justificatifs", description: "Suivi administratif", target: "Presence" },
    { id: "sec-ops", label: "Repertoires", description: "Eleves, parents, classes", target: "Operations" },
  ],
  ENSEIGNANT: [
    { id: "ens-agenda", label: "Agenda", description: "Cours du jour", target: "Agenda" },
    { id: "ens-presence", label: "Appels", description: "Presences eleves", target: "Presence" },
    { id: "ens-academic", label: "Evaluations", description: "Notes et suivi", target: "Academic" },
  ],
  COMPTABLE: [
    { id: "comp-ops", label: "Dossiers", description: "Eleves et responsables", target: "Operations" },
  ],
  SURVEILLANT: [
    { id: "surv-agenda", label: "Agenda", description: "Planning terrain", target: "Agenda" },
    { id: "surv-presence", label: "Controle", description: "Absences et retards", target: "Presence" },
  ],
  PARENT: [
    { id: "par-agenda", label: "Agenda", description: "Emploi du temps enfants", target: "Agenda" },
    { id: "par-academic", label: "Resultats", description: "Notes et bulletins", target: "Academic" },
    { id: "par-ops", label: "Enfants", description: "Rattachements et suivi", target: "Operations" },
  ],
  ELEVE: [
    { id: "elv-agenda", label: "Agenda", description: "Planning de la semaine", target: "Agenda" },
    { id: "elv-academic", label: "Notes", description: "Resultats et bulletins", target: "Academic" },
  ],
};
