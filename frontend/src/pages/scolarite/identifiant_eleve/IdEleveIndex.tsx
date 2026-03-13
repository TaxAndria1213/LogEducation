import ERPPage from "../../../components/page/ERPPage";
import {
  getComponentById,
  hasAccess,
} from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import { useIdentifiantEleveStore } from "./store/IdEleveIndexStore";
import { useEffect, useState, type JSX } from "react";
import NotFound from "../../NotFound";
import { useAuth } from "../../../auth/AuthContext";

function IdentifiantEleveIndex() {
  const { user, roles } = useAuth();

  //states
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
  const [renderList, setRenderList] = useState<JSX.Element[]>([<></>]);

  const menuListIsVisible = useIdentifiantEleveStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = useIdentifiantEleveStore(
    (state) => state.setMenuListIsVisible,
  );

  const renderState = useIdentifiantEleveStore((state) => state.renderState);
  const renderedElement = useIdentifiantEleveStore((state) => state.renderedComponent);

  const setRenderState = useIdentifiantEleveStore((state) => state.setRenderState);
  const setRenderedComponent = useIdentifiantEleveStore(
    (state) => state.setRenderedComponent,
  );

  const OptionButton = getComponentById("SC.IDENTIFIANTS.MENUACTION");

  useEffect(() => {
    if (renderedElement) {
      setRender(renderedElement);
    }
  }, [renderedElement]);

  useEffect(() => {
    if (user && roles) {
      //composants
      const ListButtonComponent = getComponentById("SC.IDENTIFIANTS.MENUACTION.LIST");
      const ParametreButtonComponent = getComponentById(
        "SC.IDENTIFIANTS.MENUACTION.PARAMETRE",
      );
      const AddButtonComponent = getComponentById("SC.IDENTIFIANTS.MENUACTION.ADD");
      const DashboardButton = getComponentById("SC.IDENTIFIANTS.MENUACTION.DASHBOARD");

      const sidebarComponents = [
        hasAccess(
          user,
          roles,
          "SC.IDENTIFIANTS.MENUACTION.DASHBOARD",
        ) && (
          <DashboardButton onClick={() => setRenderedComponent("dashboard")} />
        ),
        hasAccess(
          user,
          roles,
          "SC.IDENTIFIANTS.MENUACTION.LIST",
        ) && (
          <ListButtonComponent onClick={() => setRenderedComponent("list")} />
        ),
        hasAccess(
          user,
          roles,
          "SC.IDENTIFIANTS.MENUACTION.PARAMETRE",
        ) && (
          <ParametreButtonComponent
            onClick={() => setRenderedComponent("parametre")}
          />
        ),
        hasAccess(user, roles, "SC.IDENTIFIANTS.MENUACTION.ADD") && (
          <AddButtonComponent onClick={() => setRenderedComponent("add")} />
        ),
      ].filter(Boolean) as JSX.Element[];

      setRenderList(sidebarComponents);
    }
  }, [user, roles, setRenderedComponent]);

  return (
    <ERPPage
      title="Identifiants des élèves"
      description="Gérer les identifiants des élèves de l'établissement"
      headerActions={[
        <OptionButton
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
          key={"SC.IDENTIFIANTS.MENUACTION"}
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

export default IdentifiantEleveIndex;
