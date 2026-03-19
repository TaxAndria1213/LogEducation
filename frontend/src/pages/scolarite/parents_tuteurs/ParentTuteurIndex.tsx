import ERPPage from "../../../components/page/ERPPage";
import {
  getComponentById,
  hasAccess,
} from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import { useParentTuteurStore } from "./store/ParentTuteurIndexStore";
import { useEffect, useState, type JSX } from "react";
import NotFound from "../../NotFound";
import { useAuth } from "../../../auth/AuthContext";

function ParentTuteurIndex() {
  const { user, roles } = useAuth();

  //states
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
  const [renderList, setRenderList] = useState<JSX.Element[]>([<></>]);

  const menuListIsVisible = useParentTuteurStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = useParentTuteurStore(
    (state) => state.setMenuListIsVisible,
  );

  const renderState = useParentTuteurStore((state) => state.renderState);
  const renderedElement = useParentTuteurStore((state) => state.renderedComponent);

  const setRenderState = useParentTuteurStore((state) => state.setRenderState);
  const setRenderedComponent = useParentTuteurStore(
    (state) => state.setRenderedComponent,
  );

  const OptionButton = getComponentById("SC.PARENTSTUTEURS.MENUACTION");

  useEffect(() => {
    if (renderedElement) {
      setRender(renderedElement);
    }
  }, [renderedElement]);

  useEffect(() => {
    if (user && roles) {
      //composants
      const ListButtonComponent = getComponentById("SC.PARENTSTUTEURS.MENUACTION.LIST");
      const ParametreButtonComponent = getComponentById(
        "SC.PARENTSTUTEURS.MENUACTION.PARAMETRE",
      );
      const AddButtonComponent = getComponentById("SC.PARENTSTUTEURS.MENUACTION.ADD");
      const DashboardButton = getComponentById("SC.PARENTSTUTEURS.MENUACTION.DASHBOARD");

      const sidebarComponents = [
        hasAccess(
          user,
          roles,
          "SC.PARENTSTUTEURS.MENUACTION.DASHBOARD",
        ) && (
          <DashboardButton onClick={() => setRenderedComponent("dashboard")} />
        ),
        hasAccess(
          user,
          roles,
          "SC.PARENTSTUTEURS.MENUACTION.LIST",
        ) && (
          <ListButtonComponent onClick={() => setRenderedComponent("list")} />
        ),
        hasAccess(
          user,
          roles,
          "SC.PARENTSTUTEURS.MENUACTION.PARAMETRE",
        ) && (
          <ParametreButtonComponent
            onClick={() => setRenderedComponent("parametre")}
          />
        ),
        hasAccess(user, roles, "SC.PARENTSTUTEURS.MENUACTION.ADD") && (
          <AddButtonComponent onClick={() => setRenderedComponent("add")} />
        ),
      ].filter(Boolean) as JSX.Element[];

      setRenderList(sidebarComponents);
    }
  }, [user, roles, setRenderedComponent]);

  return (
    <ERPPage
      title="Parents/Tuteurs"
      description="Gérer les parents/tuteurs de l'établissement"
      headerActions={[
        <OptionButton
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
          key={"SC.PARENTSTUTEURS.MENUACTION"}
        />,
      ]}
    >
      <div className="flex">
        <div className="flex-1">{render}</div>
        <PageSidebarPopup open={menuListIsVisible} onClose={() => setMenuListIsVisible(false)}>
            <ListContainer
              onItemClick={() => setMenuListIsVisible(false)}
              selected={renderState}
              setSelected={setRenderState}
              components={renderList}
            />
          </PageSidebarPopup>
      </div>
    </ERPPage>
  );
}

export default ParentTuteurIndex;
