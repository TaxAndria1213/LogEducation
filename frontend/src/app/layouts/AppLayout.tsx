import { Outlet } from "react-router-dom";
import Header from "./Header";
import StartupChecklistWidget from "../../components/startup/StartupChecklistWidget";
import Sidebar from "../../navigation/Sidebar";
import { useActiveModule } from "../../navigation/useActiveModule";
import { useAuth } from "../../hooks/useAuth";

export default function AppLayout() {
  const { user, roles } = useAuth();
  const { activeModule, sidebarItems } = useActiveModule();
  const roleLabel = roles?.[0]?.role?.nom ?? "Utilisateur";
  const hasContextualSidebar = Boolean(activeModule && sidebarItems.length > 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {hasContextualSidebar && activeModule ? (
        <Sidebar activeModule={activeModule} items={sidebarItems} roleLabel={roleLabel} />
      ) : null}

      <div
        className={`flex min-h-screen flex-col transition-[margin] duration-300 ${
          hasContextualSidebar ? "ml-[316px]" : "ml-0"
        }`}
      >
        <Header />

        <main className="relative flex-1 px-5 pb-5 pt-4 lg:px-6">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-40 rounded-[32px] bg-white/40" />
          <div className="relative">
            <Outlet />
          </div>
        </main>

        <footer className="px-6 pb-4 text-center text-[11px] text-slate-400">
          {new Date().getFullYear()} {user?.etablissement?.nom ?? "EducAr"} - ERP scolaire - Powered by ArhexiaMG
        </footer>
      </div>

      <StartupChecklistWidget />
    </div>
  );
}
