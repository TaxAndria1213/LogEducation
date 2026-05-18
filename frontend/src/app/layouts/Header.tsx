import { NavLink, useLocation } from "react-router-dom";
import { useMemo, type JSX } from "react";
import {
  FiUser,
  FiBell,
  FiMessageCircle,
  FiChevronRight,
  FiLogOut,
  FiRefreshCw,
} from "react-icons/fi";
import { useAuth } from "../../auth/AuthContext";
import IconButton from "../../components/actions/IconButton";
import { useHeaderStore } from "../store/headerStore";
import UserPopup from "../process/headBar/components/UserPopup";
import { getComponentById } from "../../components/components.build";
import AdminPopup from "../process/headBar/components/AdminPopup";
import { APP_MODULES, HOME_PATH } from "../../navigation/modules.config";

const PAGE_REFRESH_EVENT = "logesco:page-refresh-request";

function Header() {
  const { user, profil, logout } = useAuth();
  const location = useLocation();
  const etablissementName = user?.etablissement?.nom ?? "Etablissement";

  const popupOpen = useHeaderStore((state) => state.popupOpen);
  const popupType = useHeaderStore((state) => state.popupType);
  const popupContent = useHeaderStore((state) => state.popupContent);
  const setPopupContent = useHeaderStore((state) => state.setPopupContent);
  const setPopupOpen = useHeaderStore((state) => state.setPopupOpen);

  const EtablissementChoiceButton = getComponentById("ADM.BARRE.SELECT.ETABLISSEMENT");

  const routeContext = useMemo(() => {
    const isHome =
      location.pathname === "/" ||
      location.pathname === HOME_PATH ||
      location.pathname === "/dashboard";
    if (isHome) {
      return {
        moduleName: "Accueil",
        sectionName: "Modules",
      };
    }

    for (const module of APP_MODULES) {
      const directMatch =
        location.pathname === module.defaultPath ||
        location.pathname === module.basePath ||
        location.pathname.startsWith(`${module.basePath}/`);
      if (!directMatch) continue;

      const submodule = module.children.find((item) =>
        location.pathname === item.path || location.pathname.startsWith(`${item.path}/`),
      );
      if (submodule) {
        return { moduleName: module.title, sectionName: submodule.label };
      }

      return { moduleName: module.title, sectionName: module.title };
    }

    return {
      moduleName: "Accueil",
      sectionName: "Modules",
    };
  }, [location.pathname]);

  const togglePopup = (type: "left" | "center" | "right") => {
    if (popupType === type) {
      setPopupOpen(!popupOpen, type);
      return;
    }
    setPopupOpen(true, type);
  };

  const handleRefreshPageData = () => {
    if (typeof window === "undefined") return;

    const event = new CustomEvent(PAGE_REFRESH_EVENT, {
      cancelable: true,
      detail: {
        pathname: location.pathname,
        requestedAt: Date.now(),
      },
    });

    const handled = !window.dispatchEvent(event);
    if (!handled) {
      window.location.reload();
    }
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-xl">
      <div className="relative flex min-h-[68px] items-center justify-between gap-4 px-6">
        <div className="min-w-0 flex flex-1 items-center gap-4">
          <div className="min-w-0 shrink">
            <p className="truncate text-sm font-bold text-slate-950">
              {etablissementName}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              <span>{routeContext.moduleName}</span>
              <FiChevronRight className="text-slate-300" />
              <span>{routeContext.sectionName}</span>
              <button
                type="button"
                onClick={handleRefreshPageData}
                className="ml-1 inline-flex h-7 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-200"
                aria-label="Recharger les donnees de la page"
                title="Recharger les donnees"
              >
                <FiRefreshCw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Recharger</span>
              </button>
            </div>
          </div>

          <div className="hidden xl:block">
            {EtablissementChoiceButton ? (
              <EtablissementChoiceButton onClick={() => togglePopup("left")} />
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <IconButton
            icon={<FiMessageCircle />}
            onClick={() => {
              togglePopup("center");
              setPopupContent("message");
            }}
            size={40}
          />
          <IconButton
            icon={<FiBell />}
            onClick={() => {
              togglePopup("center");
              setPopupContent("notification");
            }}
            size={40}
          />
          <IconButton
            icon={<FiUser />}
            onClick={() => {
              togglePopup("center");
              setPopupContent("profil");
            }}
            size={40}
          />

          {user ? (
            <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
              <div className="grid h-9 w-9 place-items-center rounded-[14px] bg-slate-950 text-xs font-bold uppercase tracking-[0.12em] text-white">
                {(profil?.prenom?.[0] ?? user?.email?.[0] ?? "U").toUpperCase()}
              </div>
              <div className="hidden min-w-0 sm:block sm:max-w-[160px]">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {[profil?.prenom, profil?.nom].filter(Boolean).join(" ") || user.email}
                </p>
              </div>
              <button
                onClick={logout}
                className="inline-flex h-9 w-9 items-center justify-center rounded-[14px] border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                aria-label="Se deconnecter"
                type="button"
              >
                <FiLogOut />
              </button>
            </div>
          ) : (
            <NavLink
              to="/login"
              className="inline-flex items-center rounded-[16px] border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              Se connecter
            </NavLink>
          )}
        </div>

        {popupType === "left" && (
          <AdminPopup
            isOpen={popupOpen}
            popupType={popupType}
            onClose={() => setPopupOpen(false)}
          />
        )}
        {popupType === "center" && popupContent && (
          <UserPopup
            component={popupContent as JSX.Element}
            isOpen={popupOpen}
            popupType={popupType}
            onClose={() => setPopupOpen(false)}
          />
        )}
      </div>
    </header>
  );
}

export default Header;
