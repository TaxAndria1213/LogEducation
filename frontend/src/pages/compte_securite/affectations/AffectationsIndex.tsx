import ERPPage from "../../../components/page/ERPPage";
import {
  getComponentById,
  hasAccess,
} from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import { useAffectationStore } from "./store/AffectationIndexStore";
import { useEffect, useState, type JSX } from "react";
import { useAuth } from "../../../auth/AuthContext";

function AffectationsIndex() {
  const { user, roles } = useAuth();
  const [renderList, setRenderList] = useState<JSX.Element[]>([<></>]);

  const menuListIsVisible = useAffectationStore(
    (state) => state.menuListIsVisible,
  );
  const setMenuListIsVisible = useAffectationStore(
    (state) => state.setMenuListIsVisible,
  );

  const renderState = useAffectationStore((state) => state.renderState);
  const renderedElement = useAffectationStore(
    (state) => state.renderedComponent,
  );

  const setRenderState = useAffectationStore((state) => state.setRenderState);
  const setRenderedComponent = useAffectationStore(
    (state) => state.setRenderedComponent,
  );

  const OptionButton = getComponentById("CS.AFFECTATIONS.MENUACTION");

  useEffect(() => {
    if (user && roles) {
      const ListButtonComponent = getComponentById(
        "CS.AFFECTATIONS.MENUACTION.LIST",
      );
      const ParametreButtonComponent = getComponentById(
        "CS.AFFECTATIONS.MENUACTION.PARAMETRE",
      );
      const AddButtonComponent = getComponentById(
        "CS.AFFECTATIONS.MENUACTION.ADD",
      );
      const DashboardButton = getComponentById(
        "CS.AFFECTATIONS.MENUACTION.DASHBOARD",
      );

      const sidebarComponents = [
        hasAccess(user, roles, "CS.AFFECTATIONS.MENUACTION.DASHBOARD") && (
          <DashboardButton onClick={() => setRenderedComponent("dashboard")} />
        ),
        hasAccess(user, roles, "CS.AFFECTATIONS.MENUACTION.LIST") && (
          <ListButtonComponent onClick={() => setRenderedComponent("list")} />
        ),
        hasAccess(user, roles, "CS.AFFECTATIONS.MENUACTION.ADD") && (
          <AddButtonComponent onClick={() => setRenderedComponent("add")} />
        ),
        hasAccess(user, roles, "CS.AFFECTATIONS.MENUACTION.PARAMETRE") && (
          <ParametreButtonComponent
            onClick={() => setRenderedComponent("parametre")}
          />
        ),
      ].filter(Boolean) as JSX.Element[];

      setRenderList(sidebarComponents);
    }
  }, [user, roles, setRenderedComponent]);

  return (
    <ERPPage
      title="Affectations & scope"
      description="Gerer les droits reels entre roles, permissions, utilisateurs et perimetres"
      headerActions={[
        <OptionButton
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
          key={"CS.AFFECTATIONS.MENUACTION"}
        />,
      ]}
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">{renderedElement}</div>
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

export default AffectationsIndex;
