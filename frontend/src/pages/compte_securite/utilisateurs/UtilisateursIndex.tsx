import ERPPage from "../../../components/page/ERPPage";
import {
  getComponentById,
  hasAccess,
} from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import { useUtilisateurStore } from "./store/UtilisateurIndexStore";
import { useEffect, useState, type JSX } from "react";
import NotFound from "../../NotFound";
import { useAuth } from "../../../auth/AuthContext";
import type { Utilisateur, UtilisateurRole } from "../../../generated/zod";

function UtilisateursIndex() {
  const { user, roles } = useAuth();

  const utilisateur = user as Utilisateur;
  const utilisateurRoles = roles as UtilisateurRole[];
  //states
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
  const [renderList, setRenderList] = useState<JSX.Element[]>([<></>]);

  const menuListIsVisible = useUtilisateurStore(
    (state) => state.menuListIsVisible,
  );
  const setMenuListIsVisible = useUtilisateurStore(
    (state) => state.setMenuListIsVisible,
  );

  const renderState = useUtilisateurStore((state) => state.renderState);
  const renderedElement = useUtilisateurStore(
    (state) => state.renderedComponent,
  );

  const setRenderState = useUtilisateurStore((state) => state.setRenderState);
  const setRenderedComponent = useUtilisateurStore(
    (state) => state.setRenderedComponent,
  );

  const OptionButton = getComponentById("CS.UTILISATEURS.MENUACTION");

  useEffect(() => {
    if (renderedElement) {
      setRender(renderedElement);
    }
  }, [renderedElement]);

  useEffect(() => {
    if (user && roles) {
      //composants
      const ListButtonComponent = getComponentById(
        "CS.UTILISATEURS.MENUACTION.LIST",
      );
      const ParametreButtonComponent = getComponentById(
        "CS.UTILISATEURS.MENUACTION.PARAMETRE",
      );
      const AddButtonComponent = getComponentById(
        "CS.UTILISATEURS.MENUACTION.ADD",
      );
      const DashboardButton = getComponentById(
        "CS.UTILISATEURS.MENUACTION.DASHBOARD",
      );
      const ApprobationButton = getComponentById(
        "CS.UTILISATEURS.MENUACTION.APPROV.LIST",
      );

      const sidebarComponents = [
        hasAccess(
          utilisateur,
          utilisateurRoles,
          "CS.UTILISATEURS.MENUACTION.DASHBOARD",
        ) && (
          <DashboardButton onClick={() => setRenderedComponent("dashboard")} />
        ),
        hasAccess(
          utilisateur,
          utilisateurRoles,
          "CS.UTILISATEURS.MENUACTION.LIST",
        ) && (
          <ListButtonComponent onClick={() => setRenderedComponent("list")} />
        ),
        hasAccess(
          utilisateur,
          utilisateurRoles,
          "CS.UTILISATEURS.MENUACTION.PARAMETRE",
        ) && (
          <ParametreButtonComponent
            onClick={() => setRenderedComponent("parametre")}
          />
        ),
        hasAccess(
          utilisateur,
          utilisateurRoles,
          "CS.UTILISATEURS.MENUACTION.ADD",
        ) && <AddButtonComponent onClick={() => setRenderedComponent("add")} />,
        hasAccess(
          utilisateur,
          utilisateurRoles,
          "CS.UTILISATEURS.MENUACTION.APPROV.LIST",
        ) && (
          <ApprobationButton
            onClick={() => setRenderedComponent("approbation")}
          />
        ),
      ].filter(Boolean) as JSX.Element[];

      setRenderList(sidebarComponents);
    }
  }, [user, roles, utilisateur, utilisateurRoles, setRenderedComponent]);

  return (
    <ERPPage
      title="Utilisateur"
      description="Gérer les utilisateurs de l'établissement"
      headerActions={[
        <OptionButton
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
          key={"CS.UTILISATEURS.MENUACTION"}
        />,
      ]}
    >
      <div className="flex">
        <div className="flex-1">{render}</div>
        {menuListIsVisible ? (
          <div className="border-l border-slate-200 pl-4 ml-4">
            <ListContainer
              selected={renderState}
              setSelected={setRenderState}
              components={renderList}
            />
          </div>
        ) : (
          <div className="none"></div>
        )}
      </div>
    </ERPPage>
  );
}

export default UtilisateursIndex;
