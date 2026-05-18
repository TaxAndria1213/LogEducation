import { Link, NavLink } from "react-router-dom";
import { FiArrowLeft, FiArrowRight, FiSearch } from "react-icons/fi";
import { useMemo, useState } from "react";
import { HOME_PATH, type NavigationModule, type NavigationSubModule } from "./modules.config";

type SidebarProps = {
  activeModule: NavigationModule;
  items: NavigationSubModule[];
  roleLabel?: string | null;
};

function itemMatchesSearch(item: NavigationSubModule, query: string) {
  if (!query) return true;
  return [item.label, item.description, item.path]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);
}

export default function Sidebar({ activeModule, items, roleLabel }: SidebarProps) {
  const [search, setSearch] = useState("");
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => itemMatchesSearch(item, query));
  }, [items, search]);

  const visibleItems = filteredItems.length > 0 ? filteredItems : items;

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-[316px] flex-col border-r border-slate-200 bg-white/95 px-4 py-5 shadow-[14px_0_38px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <Link
        to={HOME_PATH}
        className="mb-4 inline-flex items-center justify-center gap-2 rounded-[20px] border border-slate-200 bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800"
      >
        <FiArrowLeft />
        Retour au menu
      </Link>

      <section className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[20px] bg-slate-950 text-xl text-white">
            {activeModule.icon}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-950">
              {activeModule.label}
            </p>
            <p className="truncate text-xs text-slate-500">
              {roleLabel ?? "Espace de travail"}
            </p>
          </div>
        </div>

        <div className="relative mt-4">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-9 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            placeholder="Rechercher dans ce module"
          />
        </div>
      </section>

      <nav className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1" aria-label="Sous-modules">
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `group flex items-center justify-between gap-3 rounded-[22px] border px-4 py-3 text-sm transition ${
                isActive
                  ? "border-sky-200 bg-sky-50 text-sky-950 shadow-sm"
                  : "border-transparent bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className="flex min-w-0 items-center gap-3">
                  {item.icon ? (
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-[15px] ${
                        isActive ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {item.icon}
                    </span>
                  ) : null}
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{item.label}</span>
                    {item.description ? (
                      <span
                        className={`mt-0.5 block truncate text-xs ${
                          isActive ? "text-sky-700" : "text-slate-400"
                        }`}
                      >
                        {item.description}
                      </span>
                    ) : null}
                  </span>
                </span>
                <FiArrowRight
                  className={`shrink-0 text-[14px] transition group-hover:translate-x-0.5 ${
                    isActive ? "text-sky-600" : "text-slate-300"
                  }`}
                />
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
