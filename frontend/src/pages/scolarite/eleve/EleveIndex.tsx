import ERPPage from "../../../components/page/ERPPage";
import {
  getComponentById,
  hasAccess,
} from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import { useEleveStore } from "./store/EleveIndexStore";
import { useEffect, useState, type JSX } from "react";
import NotFound from "../../NotFound";
import { useAuth } from "../../../auth/AuthContext";

function EleveIndex() {
  const { user, roles } = useAuth();

  //states
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
  const [renderList, setRenderList] = useState<JSX.Element[]>([<></>]);

  const menuListIsVisible = useEleveStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = useEleveStore(
    (state) => state.setMenuListIsVisible,
  );

  const renderState = useEleveStore((state) => state.renderState);
  const renderedElement = useEleveStore((state) => state.renderedComponent);

  const setRenderState = useEleveStore((state) => state.setRenderState);
  const setRenderedComponent = useEleveStore(
    (state) => state.setRenderedComponent,
  );

  const OptionButton = getComponentById("SC.ELEVES.MENUACTION");

  useEffect(() => {
    if (renderedElement) {
      setRender(renderedElement);
    }
  }, [renderedElement]);

  useEffect(() => {
    if (user && roles) {
      //composants
      const ListButtonComponent = getComponentById("SC.ELEVES.MENUACTION.LIST");
      const ParametreButtonComponent = getComponentById(
        "SC.ELEVES.MENUACTION.PARAMETRE",
      );
      const AddButtonComponent = getComponentById("SC.ELEVES.MENUACTION.ADD");
      const DashboardButton = getComponentById("SC.ELEVES.MENUACTION.DASHBOARD");

      const sidebarComponents = [
        hasAccess(
          user,
          roles,
          "SC.ELEVES.MENUACTION.DASHBOARD",
        ) && (
          <DashboardButton onClick={() => setRenderedComponent("dashboard")} />
        ),
        hasAccess(
          user,
          roles,
          "SC.ELEVES.MENUACTION.LIST",
        ) && (
          <ListButtonComponent onClick={() => setRenderedComponent("list")} />
        ),
        hasAccess(
          user,
          roles,
          "SC.ELEVES.MENUACTION.PARAMETRE",
        ) && (
          <ParametreButtonComponent
            onClick={() => setRenderedComponent("parametre")}
          />
        ),
        hasAccess(user, roles, "SC.ELEVES.MENUACTION.ADD") && (
          <AddButtonComponent onClick={() => setRenderedComponent("add")} />
        ),
      ].filter(Boolean) as JSX.Element[];

      setRenderList(sidebarComponents);
    }
  }, [user, roles, setRenderedComponent]);

  return (
    <ERPPage
      title="Elève"
      description="Gérer les élèves de l'établissement"
      headerActions={[
        <OptionButton
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
          key={"SC.ELEVES.MENUACTION"}
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

export default EleveIndex;
