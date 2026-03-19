import ERPPage from "../../../components/page/ERPPage";
import {
  getComponentById,
  hasAccess,
} from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import { useProfileStore } from "./store/ProfileIndexStore";
import { useEffect, useState, type JSX } from "react";
import { useAuth } from "../../../auth/AuthContext";

function ProfilsIndex() {
  const { user, roles } = useAuth();

  const [renderList, setRenderList] = useState<JSX.Element[]>([<></>]);

  const menuListIsVisible = useProfileStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = useProfileStore(
    (state) => state.setMenuListIsVisible,
  );

  const renderState = useProfileStore((state) => state.renderState);
  const renderedElement = useProfileStore((state) => state.renderedComponent);

  const setRenderState = useProfileStore((state) => state.setRenderState);
  const setRenderedComponent = useProfileStore(
    (state) => state.setRenderedComponent,
  );

  const OptionButton = getComponentById("CS.PROFILS.MENUACTION");

  useEffect(() => {
    if (user && roles) {
      const ListButtonComponent = getComponentById(
        "CS.PROFILS.MENUACTION.LIST",
      );
      const ParametreButtonComponent = getComponentById(
        "CS.PROFILS.MENUACTION.PARAMETRE",
      );
      const AddButtonComponent = getComponentById("CS.PROFILS.MENUACTION.ADD");
      const DashboardButton = getComponentById(
        "CS.PROFILS.MENUACTION.DASHBOARD",
      );

      const sidebarComponents = [
        hasAccess(user, roles, "CS.PROFILS.MENUACTION.DASHBOARD") && (
          <DashboardButton onClick={() => setRenderedComponent("dashboard")} />
        ),
        hasAccess(user, roles, "CS.PROFILS.MENUACTION.LIST") && (
          <ListButtonComponent onClick={() => setRenderedComponent("list")} />
        ),
        hasAccess(user, roles, "CS.PROFILS.MENUACTION.PARAMETRE") && (
          <ParametreButtonComponent
            onClick={() => setRenderedComponent("parametre")}
          />
        ),
        hasAccess(user, roles, "CS.PROFILS.MENUACTION.ADD") && (
          <AddButtonComponent onClick={() => setRenderedComponent("add")} />
        ),
      ].filter(Boolean) as JSX.Element[];

      setRenderList(sidebarComponents);
    }
  }, [user, roles, setRenderedComponent]);

  return (
    <ERPPage
      title="Profils"
      description="Gerer les profils relies aux utilisateurs de l'etablissement"
      headerActions={[
        <OptionButton
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
          key={"CS.PROFILS.MENUACTION"}
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

export default ProfilsIndex;
