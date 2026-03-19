import { NavLink, Outlet } from "react-router-dom";
import { FiMenu } from "react-icons/fi";
import { FaChevronCircleLeft } from "react-icons/fa";
import { useAuth } from "../../hooks/useAuth";
import { useMemo, useState, type CSSProperties } from "react";
import { modules } from "../../routes/modules";
import { FiChevronDown, FiChevronRight } from "react-icons/fi";
import Header from "./Header";
import { styles } from "../../styles/styles";

export default function AppLayout() {
  const { user } = useAuth();
  console.log("🚀 ~ AppLayout ~ user:", user);

  const [openModule, setOpenModule] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");

  const toggleModule = (name: string) =>
    setOpenModule(openModule === name ? null : name);

  const filteredModules = useMemo(
    () =>
      modules.filter((m) =>
        m.name.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [search],
  );

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-gray-800"
      style={
        {
          "--app-sidebar-offset": collapsed ? "72px" : "18rem",
        } as CSSProperties
      }
    >
      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-screen transition-all duration-300 border-r shadow-lg ${
          collapsed ? "w-[72px] px-3" : "w-72 px-4"
        } py-5 overflow-hidden`}
        style={{
          backgroundColor: styles.color.sidebar.background,
          borderColor: styles.color.sidebar.border,
          color: styles.color.sidebar.text,
        }}
      >
        <div className="flex items-center justify-between gap-2 mb-6">
          <div className="flex items-center gap-3">
            <div
              className="cursor-pointer grid h-10 w-10 place-items-center rounded-2xl text-lg font-bold uppercase tracking-widest"
              style={{
                backgroundColor: styles.color.sidebar.hover,
                color: styles.color.sidebar.active,
              }}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? (
                <FiMenu />
              ) : (
                user?.etablissement?.nom.slice(0, 2) || "E"
              )}
            </div>
            {!collapsed && (
              <div>
                <div
                  className="text-sm"
                  style={{ color: styles.color.sidebar.text }}
                >
                  {user?.etablissement?.nom || "Etablissement"}
                </div>
                <div
                  className="text-xs"
                  style={{ color: styles.color.sidebar.textSecondary }}
                >
                  Navigation
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-[11px] uppercase tracking-[0.12em] transition"
            style={{
              backgroundColor: collapsed
                ? ""
                : styles.color.primary,
              color: collapsed
                ? ""
                : styles.color.sidebar.activeText,
            }}
          >
            {collapsed ? <FiMenu /> : (
              <>
                <FaChevronCircleLeft />
              </>
            )}
            <span>Réduire</span>
          </button>
        </div>

        {!collapsed && (
          <div className="mb-4">
            <div
              className="text-[11px] uppercase tracking-[0.15em] mb-2"
              style={{ color: styles.color.sidebar.textSecondary }}
            >
              Recherche
            </div>
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none border"
                style={{
                  backgroundColor: styles.color.sidebar.background,
                  color: styles.color.sidebar.text,
                  borderColor: styles.color.sidebar.border,
                }}
                placeholder="Filtrer les modules..."
              />
            </div>
          </div>
        )}

        <div
          className={`space-y-2 ${collapsed ? "hide-scrollbar" : ""}`}
          style={{
            maxHeight: "calc(100vh - 170px)",
            overflowY: "auto",
            paddingRight: collapsed ? 0 : 4,
          }}
        >
          <nav className="space-y-2">
            {filteredModules.map((mod) => {
              const hasChildren = !!mod.submodules;
              const active = openModule === mod.name;
              const Row = ({ children }: { children: React.ReactNode }) => (
                <div
                  className="flex items-center gap-3 rounded-xl px-3 py-2 transition cursor-pointer"
                  style={{
                    color: styles.color.sidebar.text,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor =
                      styles.color.sidebar.hover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                  onClick={() => (hasChildren ? toggleModule(mod.name) : null)}
                >
                  {children}
                </div>
              );

              return (
                <div key={mod.name}>
                  {hasChildren ? (
                    <Row>
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold uppercase"
                        style={{
                          backgroundColor: collapsed
                            ? "transparent"
                            : styles.color.sidebar.hover,
                          color: styles.color.sidebar.active,
                        }}
                        onClick={() => {
                          toggleModule(mod.name);
                          setCollapsed(false);
                        }}
                      >
                        {mod.icon ?? mod.name.slice(0, 2)}
                      </div>
                      {!collapsed && (
                        <div
                          className="flex-1 text-sm font-semibold"
                          style={{ color: styles.color.sidebar.text }}
                        >
                          {mod.name}
                        </div>
                      )}
                      {hasChildren && !collapsed && (
                        <span
                          className="text-xs"
                          style={{ color: styles.color.sidebar.textSecondary }}
                        >
                          {active ? <FiChevronDown /> : <FiChevronRight />}
                        </span>
                      )}
                    </Row>
                  ) : (
                    <NavLink
                      to={mod.path as string}
                      className={`block rounded-xl`}
                      style={({ isActive }) => ({
                        backgroundColor: isActive
                          ? styles.color.sidebar.active
                          : "transparent",
                        border: isActive
                          ? `1px solid ${styles.color.sidebar.active}`
                          : "none",
                      })}
                    >
                      {({ isActive }) => (
                        <div
                          className="flex items-center gap-3 px-3 py-2 transition"
                          style={{
                            color: isActive
                              ? styles.color.sidebar.activeText
                              : styles.color.sidebar.text,
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.backgroundColor =
                                styles.color.sidebar.hover;
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.backgroundColor =
                                "transparent";
                            }
                          }}
                        >
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold uppercase"
                            style={{
                              backgroundColor: isActive
                                ? styles.color.sidebar.activeText
                                : styles.color.sidebar.hover,
                              color: isActive
                                ? styles.color.sidebar.active
                                : styles.color.sidebar.active,
                            }}
                          >
                            {(mod.icon as string) ?? mod.name.slice(0, 2)}
                          </div>
                          {!collapsed && (
                            <div className="flex-1 text-sm font-semibold">
                              {mod.name}
                            </div>
                          )}
                        </div>
                      )}
                    </NavLink>
                  )}

                  {hasChildren && active && !collapsed && (
                    <div
                      className="ml-4 mt-1 space-y-1 pl-3"
                      style={{ borderLeftColor: styles.color.sidebar.border }}
                    >
                      {mod.submodules!.map((sub) => (
                        <NavLink
                          key={sub.path}
                          to={sub.path as string}
                          className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-sm transition`}
                          style={({ isActive }) => ({
                            backgroundColor: isActive
                              ? styles.color.sidebar.active
                              : "transparent",
                            color: isActive
                              ? styles.color.sidebar.activeText
                              : styles.color.sidebar.text,
                            border: isActive
                              ? `1px solid ${styles.color.sidebar.active}`
                              : "none",
                          })}
                        >
                          {({ isActive }) => (
                            <span
                              onMouseLeave={(e) => {
                                if (!isActive) {
                                  e.currentTarget.style.backgroundColor =
                                    "transparent";
                                }
                              }}
                            >
                              {sub.name}
                            </span>
                          )}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Contenu principal (avec marge gauche = largeur sidebar) */}
      <div
        className={`${collapsed ? "ml-[72px]" : "ml-72"} flex flex-col h-screen overflow-hidden transition-all duration-300`}
      >
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
