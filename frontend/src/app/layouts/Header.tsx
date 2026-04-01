import { NavLink, useLocation } from "react-router-dom";
import { useMemo, type JSX } from "react";
import {
  FiUser,
  FiBell,
  FiMessageCircle,
  FiChevronRight,
  FiLogOut,
} from "react-icons/fi";
import { useAuth } from "../../auth/AuthContext";
import IconButton from "../../components/actions/IconButton";
import { useHeaderStore } from "../store/headerStore";
import UserPopup from "../process/headBar/components/UserPopup";
import { getComponentById } from "../../components/components.build";
import AdminPopup from "../process/headBar/components/AdminPopup";
import { modules } from "../../routes/modules";

function Header() {
  const { user, profil, logout } = useAuth();
  const location = useLocation();

  const popupOpen = useHeaderStore((state) => state.popupOpen);
  const popupType = useHeaderStore((state) => state.popupType);
  const popupContent = useHeaderStore((state) => state.popupContent);
  const setPopupContent = useHeaderStore((state) => state.setPopupContent);
  const setPopupOpen = useHeaderStore((state) => state.setPopupOpen);

  const EtablissementChoiceButton = getComponentById("ADM.BARRE.SELECT.ETABLISSEMENT");

  const routeContext = useMemo(() => {
    for (const module of modules) {
      const directMatch = module.path && location.pathname.startsWith(module.path);
      if (directMatch) {
        return { moduleName: module.name, sectionName: module.name };
      }

      const submodule = module.submodules?.find((item) =>
        location.pathname.startsWith(item.path ?? ""),
      );
      if (submodule) {
        return { moduleName: module.name, sectionName: submodule.name };
      }
    }

    return {
      moduleName: "Pilotage",
      sectionName: "Vue generale",
    };
  }, [location.pathname]);

  const togglePopup = (type: "left" | "center" | "right") => {
    if (popupType === type) {
      setPopupOpen(!popupOpen, type);
      return;
    }
    setPopupOpen(true, type);
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-xl">
      <div className="relative flex min-h-[68px] items-center justify-between gap-4 px-6">
        <div className="min-w-0 flex flex-1 items-center gap-4">
          <div className="min-w-0 shrink">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              <span>{routeContext.moduleName}</span>
              <FiChevronRight className="text-slate-300" />
              <span>{routeContext.sectionName}</span>
            </div>
            <p className="mt-1 truncate text-sm font-semibold text-slate-900">
              {profil?.prenom || user?.email || "equipe"}
              <span className="ml-2 text-xs font-medium text-slate-500">session active</span>
            </p>
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
