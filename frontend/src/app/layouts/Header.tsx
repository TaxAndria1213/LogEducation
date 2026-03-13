import { NavLink } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { FiUser, FiBell, FiMessageCircle } from "react-icons/fi";
import IconButton from "../../components/actions/IconButton";
import { useHeaderStore } from "../store/headerStore";
import UserPopup from "../process/headBar/components/UserPopup";
import { getComponentById } from "../../components/components.build";
import AdminPopup from "../process/headBar/components/AdminPopup";
import type { JSX } from "react";

function Header() {
  const { user, logout } = useAuth();

  const popupOpen = useHeaderStore((state) => state.popupOpen);
  const popupType = useHeaderStore((state) => state.popupType);
  const popupContent = useHeaderStore((state) => state.popupContent);
  const setPopupContent = useHeaderStore((state) => state.setPopupContent);
  const setPopupOpen = useHeaderStore((state) => state.setPopupOpen);

  const EtablissementChoiceButton = getComponentById(
    "ADM.BARRE.SELECT.ETABLISSEMENT",
  );

  const togglePopup = (type: "left" | "center" | "right") => {
    // si on clique sur le même type => toggle
    if (popupType === type) {
      setPopupOpen(!popupOpen, type);
      return;
    }
    // si on clique sur un autre type => ouvre celui-là
    setPopupOpen(true, type);
  };

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
      <div className="relative flex items-center px-6 h-14">
        {/* gauche */}
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold text-gray-800">EducAr</h1>
          <EtablissementChoiceButton onClick={() => togglePopup("left")} />
        </div>

        {/* centre */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="flex items-center space-x-4">
            <IconButton
              icon={<FiMessageCircle />}
              onClick={() => {
                togglePopup("center");
                setPopupContent("message");
              }}
            />
            <IconButton
              icon={<FiBell />}
              onClick={() => {
                togglePopup("center");
                setPopupContent("notification");
              }}
            />
            <IconButton
              icon={<FiUser />}
              onClick={() => {
                  togglePopup("center");
                  setPopupContent("profil");
                }}
            />
          </div>
        </div>

        {/* Popups */}
        {popupType === "left" && (
          <AdminPopup
            isOpen={popupOpen}
            popupType={popupType}
            onClose={() => setPopupOpen(false)}
          />
        )}
        {popupType === "center" && (
          <UserPopup
            component={popupContent as JSX.Element}
            isOpen={popupOpen}
            popupType={popupType}
            onClose={() => setPopupOpen(false)}
          />
        )}

        {/* droite */}
        <div className="ml-auto">
          {user ? (
            <button
              onClick={logout}
              className="text-sm text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-md"
            >
              Se déconnecter
            </button>
          ) : (
            <NavLink
              to="/login"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Se connecter
            </NavLink>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
