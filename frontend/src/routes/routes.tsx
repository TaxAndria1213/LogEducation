import { lazy } from "react";
import type { RouteObject } from "react-router-dom";
import type { AppRoute, menu } from "../types/types";
import { modules } from "./modules";


const Dashboard = lazy(() => import("../pages/dashboard/PreviewDashboard"));


export const routes: RouteObject[] = [
  {
    index: true,
    element: <Dashboard />,
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
