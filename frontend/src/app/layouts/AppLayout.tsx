import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useState } from "react";
import { modules } from "../../routes/modules";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";
import Header from "./Header";

export default function AppLayout() {
  const { user } = useAuth();
  console.log("🚀 ~ AppLayout ~ user:", user);

  const [openModule, setOpenModule] = useState<string | null>(null);

  const toggleModule = (name: string) =>
    setOpenModule(openModule === name ? null : name);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Sidebar FIXÉE */}
      <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 p-4 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-6 text-gray-700">Modules</h2>
        <nav className="space-y-2">
          {modules.map((mod) => (
            <div key={mod.name}>
              <div
                onClick={() => toggleModule(mod.name)}
                className="flex items-center justify-between px-2 py-2 rounded-md cursor-pointer hover:bg-gray-100"
              >
                {!mod.submodules ? (
                  <NavLink
                    to={mod.path as string}
                    className={({ isActive }) =>
                      `flex-1 block text-sm font-medium ${
                        isActive
                          ? "text-blue-600 font-semibold"
                          : "text-gray-700"
                      }`
                    }
                  >
                    {mod.name}
                  </NavLink>
                ) : (
                  <span className="flex-1 block text-sm font-medium text-gray-700">
                    {mod.name}
                  </span>
                )}
                {mod.submodules && (
                  <span className="text-gray-500 text-xs">
                    {openModule === mod.name ? (
                      <FiChevronDown />
                    ) : (
                      <FiChevronRight />
                    )}
                  </span>
                )}
              </div>

              {mod.submodules && openModule === mod.name && (
                <div className="ml-4 mt-1 space-y-1">
                  {mod.submodules.map((sub) => (
                    <NavLink
                      key={sub.path}
                      to={sub.path as string}
                      className={({ isActive }) =>
                        `block px-2 py-1 rounded-md text-sm ${
                          isActive
                            ? "text-blue-600 bg-blue-50 font-semibold"
                            : "text-gray-600 hover:bg-gray-100"
                        }`
                      }
                    >
                      {sub.name}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* Contenu principal (avec marge gauche = largeur sidebar) */}
      <div className="ml-64 flex flex-col h-screen overflow-hidden">
        {/* Header collant */}
        <Header />

        {/* Zone principale scrollable */}
        <main className="flex-1 min-h-0 overflow-y-auto p-4">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="shrink-0 text-center text-[10px] text-gray-300 py-2">
          © {new Date().getFullYear()} - EducAr - Tous droits reservés -
          Version 1.0 |
          <span>
            {" "}
            Powered by{" "}
            <a
              href="https://arhexia-mg.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-300"
            >
              ArhexiaMG
            </a>
          </span>
        </footer>
      </div>
    </div>
  );
}
