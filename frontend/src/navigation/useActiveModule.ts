import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { APP_MODULES, HOME_PATH, type NavigationModule } from "./modules.config";
import { filterModulesByPermissions } from "./permissions";

function normalizePath(path?: string) {
  if (!path) return "";
  return path.startsWith("/") ? path : `/${path}`;
}

function routeMatches(pathname: string, routePath?: string) {
  const path = normalizePath(routePath);
  if (!path) return false;
  return pathname === path || pathname.startsWith(`${path}/`);
}

function isHomePath(pathname: string) {
  return pathname === "/" || pathname === HOME_PATH || pathname === "/dashboard";
}

function moduleScore(module: NavigationModule, pathname: string) {
  const paths = [module.basePath, module.defaultPath, ...module.children.map((item) => item.path)];
  return paths.reduce((score, path) => {
    const normalized = normalizePath(path);
    return routeMatches(pathname, normalized)
      ? Math.max(score, normalized.length)
      : score;
  }, 0);
}

export function useActiveModule() {
  const location = useLocation();
  const { user, roles, rolesAccessList } = useAuth();

  const availableModules = useMemo(
    () => filterModulesByPermissions(APP_MODULES, { user, roles, rolesAccessList }),
    [roles, rolesAccessList, user],
  );

  const activeModule = useMemo(() => {
    if (isHomePath(location.pathname)) return null;
    return (
      availableModules
        .map((module) => ({ module, score: moduleScore(module, location.pathname) }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score)[0]?.module ?? null
    );
  }, [availableModules, location.pathname]);

  return {
    activeModule,
    availableModules,
    isHome: isHomePath(location.pathname) || activeModule === null,
    sidebarItems: activeModule?.children ?? [],
  };
}
