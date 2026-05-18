import { FiSearch } from "react-icons/fi";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import ModuleCard from "./ModuleCard";
import { APP_MODULES } from "./modules.config";
import { filterModulesByPermissions } from "./permissions";

export default function HomePage() {
  const { user, roles, rolesAccessList } = useAuth();
  useEffect(() => {
    if(roles) {
      console.log("User roles:", roles);
    }
  }, [roles])
  const [search, setSearch] = useState("");
  const modules = useMemo(
    () => filterModulesByPermissions(APP_MODULES, { user, roles, rolesAccessList }),
    [roles, rolesAccessList, user],
  );
  const visibleModules = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return modules;
    return modules.filter((module) =>
      [module.title, module.description, module.badge]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [modules, search]);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-130px)] w-full max-w-6xl flex-col justify-center space-y-8 py-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-bold text-slate-950">
            { roles && roles[0].role?.nom ||
              user?.email ||
              "Menu principal"}
          </p>
          <p className="text-sm text-slate-500">
            {visibleModules.length} module(s) accessible(s)
          </p>
        </div>
        <div className="relative w-full md:max-w-sm">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-10 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-100"
            placeholder="Rechercher un module"
          />
        </div>
      </div>

      <section className="mx-auto grid w-full max-w-5xl grid-cols-3 justify-items-center gap-x-5 gap-y-8 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
        {visibleModules.map((module) => (
          <ModuleCard key={module.key} module={module} />
        ))}
      </section>
    </div>
  );
}
