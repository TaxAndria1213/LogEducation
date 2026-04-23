import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  FiChevronDown,
  FiChevronRight,
  FiMenu,
  FiSearch,
  FiGrid,
  FiChevronLeft,
  FiX,
} from "react-icons/fi";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useAuth } from "../../hooks/useAuth";
import { modules } from "../../routes/modules";
import Header from "./Header";
import type { menu } from "../../types/types";

function moduleMatchesSearch(module: menu, query: string) {
  if (!query) return true;
  const haystacks = [module.name, ...(module.submodules?.map((sub) => sub.name) ?? [])]
    .join(" ")
    .toLowerCase();
  return haystacks.includes(query);
}

function getFilteredModule(module: menu, query: string) {
  if (!query) return module;

  const normalized = query.toLowerCase();
  const moduleMatches = module.name.toLowerCase().includes(normalized);
  const matchedSubmodules = module.submodules?.filter((sub) =>
    sub.name.toLowerCase().includes(normalized),
  );

  if (moduleMatches) return module;
  if (matchedSubmodules && matchedSubmodules.length > 0) {
    return { ...module, submodules: matchedSubmodules };
  }
  return null;
}

export default function AppLayout() {
  const { user, roles } = useAuth();
  const location = useLocation();
  const [openModule, setOpenModule] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const sidebarScrollRef = useRef<HTMLDivElement | null>(null);
  const moduleGroupRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const activeModuleKey = useMemo(() => {
    const found = modules.find((module) =>
      module.submodules?.some((submodule) => location.pathname.startsWith(submodule.path ?? "")) ||
      (!!module.path && location.pathname.startsWith(module.path)),
    );
    return found?.key ?? null;
  }, [location.pathname]);

  const filteredModules = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return modules;
    return modules
      .filter((module) => moduleMatchesSearch(module, query))
      .map((module) => getFilteredModule(module, query))
      .filter((module): module is menu => Boolean(module));
  }, [search]);

  const orderedModules = useMemo(() => {
    if (!openModule) {
      return filteredModules;
    }

    const expandedModuleIndex = filteredModules.findIndex(
      (module) => module.key === openModule,
    );

    if (expandedModuleIndex <= 0) {
      return filteredModules;
    }

    const expandedItem = filteredModules[expandedModuleIndex];
    return [
      expandedItem,
      ...filteredModules.filter((module) => module.key !== openModule),
    ];
  }, [filteredModules, openModule]);

  const expandedModule = openModule ?? activeModuleKey;
  const appShellStyle = {
    "--app-sidebar-offset": collapsed ? "88px" : "340px",
  } as CSSProperties;

  useEffect(() => {
    if (!openModule || collapsed) return;

    let firstFrame = 0;
    let secondFrame = 0;

    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const scrollContainer = sidebarScrollRef.current;
        const moduleElement = moduleGroupRefs.current[openModule];

        if (!scrollContainer || !moduleElement) return;

        const scrollContainerRect = scrollContainer.getBoundingClientRect();
        const moduleRect = moduleElement.getBoundingClientRect();
        const topGap = 10;
        const nextTop = Math.max(
          0,
          scrollContainer.scrollTop + (moduleRect.top - scrollContainerRect.top) - topGap,
        );
        scrollContainer.scrollTop = nextTop;
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
    };
  }, [collapsed, openModule, orderedModules]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800" style={appShellStyle}>
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-white/70 bg-white/86 shadow-[0_18px_50px_rgba(15,23,42,0.09)] backdrop-blur-2xl transition-all duration-300 ${
          collapsed ? "w-[88px] px-2 py-3" : "w-[340px] px-4 py-5"
        }`}
      >
        <div
          className={`border border-slate-200/80 bg-white shadow-[0_16px_30px_rgba(148,163,184,0.14)] ${
            collapsed ? "rounded-[24px] p-2.5" : "rounded-[28px] p-3.5"
          }`}
        >
          <div
            className={`flex ${collapsed ? "flex-col items-center gap-2" : "items-center justify-between gap-3"}`}
          >
            <div className={`flex min-w-0 items-center ${collapsed ? "justify-center" : "gap-3"}`}>
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[18px] bg-slate-950 text-sm font-bold uppercase tracking-[0.18em] text-white shadow-[0_12px_24px_rgba(15,23,42,0.26)]">
                {user?.etablissement?.nom?.slice(0, 2) ?? "ED"}
              </div>
              {!collapsed ? (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">
                    {user?.etablissement?.nom ?? "Etablissement"}
                  </p>
                  <p className="text-xs text-slate-500">Administration et pilotage scolaire</p>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              aria-label={collapsed ? "Etendre la navigation" : "Reduire la navigation"}
            >
              {collapsed ? <FiMenu /> : <FiChevronLeft />}
            </button>
          </div>

          {!collapsed ? (
            <div className="mt-3 space-y-3">
              <div className="relative">
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-10 py-2.5 pr-11 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                  placeholder="Rechercher un module ou une section"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Effacer la recherche"
                  >
                    <FiX className="text-[14px]" />
                  </button>
                ) : null}
              </div>
              <div className="flex items-center justify-between rounded-[20px] border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-sm">
                <span className="truncate">{modules.length} module(s)</span>
                <span className="truncate font-semibold text-slate-700">
                  {roles?.[0]?.role?.nom ?? "Utilisateur"}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div
          ref={sidebarScrollRef}
          className={`mt-4 flex-1 overflow-y-auto ${collapsed ? "hide-scrollbar pr-0" : "pr-1"}`}
        >
          <div className={`space-y-2 ${collapsed ? "px-0.5" : ""}`}>
            {orderedModules.map((module) => {
              const hasChildren = Boolean(module.submodules?.length);
              const isExpanded = expandedModule === module.key;
              const isModuleActive =
                module.key === activeModuleKey ||
                module.submodules?.some((submodule) => location.pathname.startsWith(submodule.path ?? ""));

              const collapsedItemClass = isModuleActive
                ? "mx-auto flex h-12 w-12 items-center justify-center rounded-[18px] border border-slate-900 bg-slate-900 text-white shadow-sm"
                : "mx-auto flex h-12 w-12 items-center justify-center rounded-[18px] border border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900";

              return (
                <div
                  key={module.key}
                  ref={(node) => {
                    moduleGroupRefs.current[module.key] = node;
                  }}
                  className={
                    hasChildren && isExpanded && !collapsed
                      ? "space-y-2 rounded-[28px] border-2 border-sky-300 bg-gradient-to-br from-sky-50 via-white to-sky-50/70 p-2 shadow-[0_14px_34px_rgba(14,165,233,0.12)] ring-1 ring-sky-100"
                      : "space-y-2"
                  }
                >
                  {hasChildren ? (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenModule((current) => (current === module.key ? null : module.key));
                        if (collapsed) {
                          setCollapsed(false);
                        }
                      }}
                      aria-label={module.name}
                      className={
                        collapsed
                          ? collapsedItemClass
                          : `flex w-full items-center gap-3 rounded-[24px] border px-3 py-3 text-left transition ${
                              isModuleActive
                                ? "border-slate-900 bg-slate-900 text-white shadow-[0_18px_28px_rgba(15,23,42,0.18)]"
                                : isExpanded
                                  ? "border-sky-200 bg-white text-slate-900 shadow-sm"
                                : "border-transparent bg-white/62 text-slate-700 hover:border-slate-200 hover:bg-white"
                            }`
                      }
                    >
                      {collapsed ? (
                        module.icon ?? <FiGrid />
                      ) : (
                        <>
                          <span
                            className={`grid h-11 w-11 shrink-0 place-items-center rounded-[18px] text-sm ${
                              isModuleActive
                                ? "bg-white/12 text-white"
                                : isExpanded
                                  ? "bg-sky-100 text-sky-700"
                                  : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {module.icon ?? <FiGrid />}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{module.name}</span>
                            <span
                              className={`block text-xs ${
                                isModuleActive
                                  ? "text-slate-300"
                                  : isExpanded
                                    ? "text-sky-700"
                                    : "text-slate-500"
                              }`}
                            >
                              {module.submodules?.length ?? 0} section(s)
                            </span>
                          </span>
                          <span
                            className={`text-sm ${
                              isModuleActive
                                ? "text-slate-200"
                                : isExpanded
                                  ? "text-sky-600"
                                  : "text-slate-400"
                            }`}
                          >
                            {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
                          </span>
                        </>
                      )}
                    </button>
                  ) : (
                    <NavLink
                      to={module.path ?? "/"}
                      aria-label={module.name}
                      className={({ isActive }) =>
                        collapsed
                          ? `mx-auto flex h-12 w-12 items-center justify-center rounded-[18px] border transition ${
                              isActive
                                ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                                : "border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900"
                            }`
                          : `flex items-center gap-3 rounded-[24px] border px-3 py-3 transition ${
                              isActive
                                ? "border-slate-900 bg-slate-900 text-white shadow-[0_18px_28px_rgba(15,23,42,0.18)]"
                                : "border-transparent bg-white/62 text-slate-700 hover:border-slate-200 hover:bg-white"
                            }`
                      }
                    >
                      {({ isActive }) =>
                        collapsed ? (
                          module.icon ?? <FiGrid />
                        ) : (
                          <>
                            <span
                              className={`grid h-11 w-11 shrink-0 place-items-center rounded-[18px] text-sm ${
                                isActive ? "bg-white/12 text-white" : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {module.icon ?? <FiGrid />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold">{module.name}</span>
                              <span className={`block text-xs ${isActive ? "text-slate-300" : "text-slate-500"}`}>
                                Acces direct
                              </span>
                            </span>
                          </>
                        )
                      }
                    </NavLink>
                  )}

                  {hasChildren && isExpanded && !collapsed ? (
                    <div className="space-y-1 pl-4">
                      {module.submodules?.map((submodule) => (
                        <NavLink
                          key={submodule.path}
                          to={submodule.path ?? "/"}
                          className={({ isActive }) =>
                            `flex items-center justify-between rounded-[20px] border px-3 py-2.5 text-sm transition ${
                              isActive
                                ? "border-sky-200 bg-sky-50 text-sky-900 shadow-sm"
                                : "border-transparent bg-transparent text-slate-600 hover:border-slate-200 hover:bg-white"
                            }`
                          }
                        >
                          {() => (
                            <>
                              <span className="truncate font-medium">{submodule.name}</span>
                              
                            </>
                          )}
                        </NavLink>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      <div
        className={`${collapsed ? "ml-[88px]" : "ml-[340px]"} flex min-h-screen flex-col transition-all duration-300`}
      >
        <Header />

        <main className="relative flex-1 px-5 pb-5 pt-4 lg:px-6">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-40 rounded-[32px] bg-white/40" />
          <div className="relative">
            <Outlet />
          </div>
        </main>

        <footer className="px-6 pb-4 text-center text-[11px] text-slate-400">
          {new Date().getFullYear()} EducAr - ERP scolaire - Powered by ArhexiaMG
        </footer>
      </div>
    </div>
  );
}
