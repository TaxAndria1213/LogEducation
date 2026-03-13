import ERPPage from "../../../components/page/ERPPage";
import {
  getComponentById,
  hasAccess,
} from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import { useNiveauStore } from "./store/NiveauIndexStore";
import { useEffect, useState, type JSX } from "react";
import NotFound from "../../NotFound";
import { useAuth } from "../../../auth/AuthContext";

function NiveauIndex() {
  const { user, roles } = useAuth();

  //states
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
  const [renderList, setRenderList] = useState<JSX.Element[]>([<></>]);

  const menuListIsVisible = useNiveauStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = useNiveauStore(
    (state) => state.setMenuListIsVisible,
  );

  const renderState = useNiveauStore((state) => state.renderState);
  const renderedElement = useNiveauStore((state) => state.renderedComponent);

  const setRenderState = useNiveauStore((state) => state.setRenderState);
  const setRenderedComponent = useNiveauStore(
    (state) => state.setRenderedComponent,
  );

  const OptionButton = getComponentById("SC.NIVEAUX.MENUACTION");

  useEffect(() => {
    if (renderedElement) {
      setRender(renderedElement);
    }
  }, [renderedElement]);

  useEffect(() => {
    if (user && roles) {
      //composants
      const ListButtonComponent = getComponentById("SC.NIVEAUX.MENUACTION.LIST");
      const ParametreButtonComponent = getComponentById(
        "SC.NIVEAUX.MENUACTION.PARAMETRE",
      );
      const AddButtonComponent = getComponentById("SC.NIVEAUX.MENUACTION.ADD");
      const DashboardButton = getComponentById("SC.NIVEAUX.MENUACTION.DASHBOARD");

      const sidebarComponents = [
        hasAccess(
          user,
          roles,
          "SC.NIVEAUX.MENUACTION.DASHBOARD",
        ) && (
          <DashboardButton onClick={() => setRenderedComponent("dashboard")} />
        ),
        hasAccess(
          user,
          roles,
          "SC.NIVEAUX.MENUACTION.LIST",
        ) && (
          <ListButtonComponent onClick={() => setRenderedComponent("list")} />
        ),
        hasAccess(
          user,
          roles,
          "SC.NIVEAUX.MENUACTION.PARAMETRE",
        ) && (
          <ParametreButtonComponent
            onClick={() => setRenderedComponent("parametre")}
          />
        ),
        hasAccess(user, roles, "SC.NIVEAUX.MENUACTION.ADD") && (
          <AddButtonComponent onClick={() => setRenderedComponent("add")} />
        ),
      ].filter(Boolean) as JSX.Element[];

      setRenderList(sidebarComponents);
    }
  }, [user, roles, setRenderedComponent]);

  return (
    <ERPPage
      title="Niveau"
      description="Gérer les niveaux de l'établissement"
      headerActions={[
        <OptionButton
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
          key={"SC.NIVEAUX.MENUACTION"}
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

export default NiveauIndex;
