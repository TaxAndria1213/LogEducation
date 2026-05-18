import { createElement, type ReactNode } from "react";
import {
  faBook,
  faBuilding,
  faCalendarCheck,
  faChalkboardTeacher,
  faClock,
  faComments,
  faFolderOpen,
  faGraduationCap,
  faGrip,
  faHouse,
  faMoneyBillWave,
  faPlug,
  faScaleBalanced,
  faShieldHalved,
  faUserTie,
  faUsersGear,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { modules as routeModules } from "../routes/modules";
import type { menu } from "../types/types";

export type NavigationSubModule = {
  key: string;
  label: string;
  path: string;
  icon?: ReactNode;
  permission?: string;
  description?: string;
};

export type NavigationModule = {
  key: string;
  label: string;
  title: string;
  description: string;
  basePath: string;
  defaultPath: string;
  icon: ReactNode;
  permission?: string;
  badge?: string;
  children: NavigationSubModule[];
};

export const HOME_PATH = "/home";

function faIcon(icon: Parameters<typeof FontAwesomeIcon>[0]["icon"]) {
  return createElement(FontAwesomeIcon, { icon });
}

const MODULE_META: Record<
  string,
  {
    label?: string;
    description: string;
    icon: ReactNode;
    badge?: string;
  }
> = {
  dashboard: {
    label: "Accueil",
    description: "Vue generale, calendrier et indicateurs rapides de l'etablissement.",
    icon: faIcon(faHouse),
    // badge: "Pilotage",
  },
  scolarite: {
    label: "Scolarite",
    description: "Eleves, inscriptions, classes, niveaux et dossiers scolaires.",
    icon: faIcon(faGraduationCap),
    // badge: "Vie scolaire",
  },
  personnel: {
    label: "Personnel",
    description: "Personnels, enseignants, departements et affectations internes.",
    icon: faIcon(faUserTie),
  },
  pedagogie: {
    label: "Pedagogie",
    description: "Matieres, programmes, cours, evaluations, notes et bulletins.",
    icon: faIcon(faChalkboardTeacher),
    // badge: "Notes",
  },
  presences: {
    label: "Presences",
    description: "Appels, presences eleves, justificatifs et presences personnel.",
    icon: faIcon(faCalendarCheck),
  },
  discipline: {
    label: "Discipline",
    description: "Incidents, sanctions, recompenses et suivi comportemental.",
    icon: faIcon(faScaleBalanced),
  },
  bibliothque: {
    label: "Bibliotheque",
    description: "Ressources documentaires, emprunts et suivi du fonds scolaire.",
    icon: faIcon(faBook),
  },
  finance: {
    label: "Finance",
    description: "Factures, paiements, remises, recouvrement et journal financier.",
    icon: faIcon(faMoneyBillWave),
    // badge: "Tresorerie",
  },
  transport_cantine: {
    label: "Transport & Cantine",
    description: "Lignes, abonnements, repas, acces et services aux eleves.",
    icon: faIcon(faUsersGear),
  },
  etablissement: {
    label: "Parametrage",
    description: "Sites, salles, annees scolaires, periodes et referentiels.",
    icon: faIcon(faBuilding),
  },
  comptes_securite: {
    label: "Securite",
    description: "Utilisateurs, roles, permissions et scopes d'acces.",
    icon: faIcon(faShieldHalved),
  },
  documents: {
    label: "Documents",
    description: "Types de documents, justificatifs et pieces administratives.",
    icon: faIcon(faFolderOpen),
  },
  communication: {
    label: "Communication",
    description: "Messages, annonces, canaux et notifications.",
    icon: faIcon(faComments),
  },
  emploi_du_temps: {
    label: "Emploi du temps",
    description: "Plannings, creneaux, salles et calendrier operationnel.",
    icon: faIcon(faClock),
  },
  audit_integrations: {
    label: "Audit & integrations",
    description: "Journaux, webhooks, integrations et tracabilite.",
    icon: faIcon(faPlug),
  },
};

function pathToBasePath(path?: string) {
  if (!path) return "/";
  const parts = path.split("/").filter(Boolean);
  return parts[0] ? `/${parts[0]}` : "/";
}

function firstRoute(items?: menu[]) {
  return items?.find((item) => item.path)?.path ?? "/";
}

function toSubModule(item: menu): NavigationSubModule | null {
  if (!item.path) return null;
  return {
    key: item.key,
    label: item.name,
    path: item.path,
    icon: item.icon,
    permission: item.permission,
    description: item.description,
  };
}

function toNavigationModule(module: menu): NavigationModule {
  const children = module.submodules?.flatMap((item) => {
    const child = toSubModule(item);
    return child ? [child] : [];
  }) ?? [];
  const defaultPath = module.path ?? firstRoute(module.submodules);
  const meta = MODULE_META[module.key] ?? {
    description: module.description ?? "Acceder aux fonctionnalites du module.",
    icon: module.icon ?? faIcon(faGrip),
  };

  return {
    key: module.key,
    label: meta.label ?? module.name,
    title: meta.label ?? module.name,
    description: module.description ?? meta.description,
    basePath: pathToBasePath(defaultPath),
    defaultPath,
    icon: meta.icon ?? module.icon ?? faIcon(faGrip),
    permission: module.permission,
    badge: meta.badge,
    children,
  };
}

export const APP_MODULES = routeModules
  .filter((module) => module.key !== "dashboard")
  .map(toNavigationModule);
