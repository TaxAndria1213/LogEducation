import { lazy } from "react";
import type { RouteObject } from "react-router-dom";
import type { AppRoute, menu } from "../types/types";
import { modules } from "./modules";

const HomePage = lazy(() => import("../navigation/HomePage"));
const InscriptionResumePage = lazy(
  () => import("../pages/scolarite/inscriptions/InscriptionResumePage"),
);
const InscriptionEditPage = lazy(
  () => import("../pages/scolarite/inscriptions/InscriptionEditPage"),
);
const InscriptionCreatePage = lazy(
  () => import("../pages/scolarite/inscriptions/InscriptionCreatePage"),
);
const EnrollmentDraftListPage = lazy(
  () => import("../pages/scolarite/inscriptions/EnrollmentDraftListPage"),
);
const EnrollmentDraftFormPage = lazy(
  () => import("../pages/scolarite/inscriptions/EnrollmentDraftFormPage"),
);
const EleveDossierPage = lazy(
  () => import("../pages/scolarite/eleve/EleveDossierPage"),
);


export const routes: RouteObject[] = [
  {
    index: true,
    element: <HomePage />,
  },
  {
    path: "/home",
    element: <HomePage />,
  },
  {
    path: "/dashboard",
    element: <HomePage />,
  },
  {
    path: "/scolarite/inscriptions/:id/resume",
    element: <InscriptionResumePage />,
  },
  {
    path: "/scolarite/inscriptions/:id/edit",
    element: <InscriptionEditPage />,
  },
  {
    path: "/scolarite/inscriptions/nouveau",
    element: <InscriptionCreatePage />,
  },
  {
    path: "/scolarite/inscriptions/brouillons",
    element: <EnrollmentDraftListPage />,
  },
  {
    path: "/scolarite/inscriptions/brouillons/:id",
    element: <EnrollmentDraftFormPage />,
  },
  {
    path: "/scolarite/eleves/:id/dossier",
    element: <EleveDossierPage />,
  },
  ...getAllRoutes(modules),
];

export function getAllRoutes(modules: menu[]): AppRoute[] {
  const routes: AppRoute[] = [];

  const walk = (items: menu[]) => {
    for (const item of items) {
      // Si l'entrée est routable
      if (item.path && item.elements) {
        routes.push({ path: item.path, element: item.elements });
      }

      // Descend dans les sous-modules
      if (item.submodules?.length) {
        walk(item.submodules);
      }
    }
  };

  walk(modules);
  return routes;
}
