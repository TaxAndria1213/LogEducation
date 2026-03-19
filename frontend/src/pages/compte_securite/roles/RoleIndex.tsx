import ERPPage from "../../../components/page/ERPPage";
import {
  getComponentById,
  hasAccess,
} from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import { useRoleStore } from "./store/RoleIndexStore";
import { useEffect, useState, type JSX } from "react";
import { useAuth } from "../../../auth/AuthContext";

function RolesIndex() {
  const { user, roles } = useAuth();

  //states
  const [renderList, setRenderList] = useState<JSX.Element[]>([<></>]);

  const menuListIsVisible = useRoleStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = useRoleStore(
    (state) => state.setMenuListIsVisible,
  );

  const renderState = useRoleStore((state) => state.renderState);
  const renderedElement = useRoleStore((state) => state.renderedComponent);

  const setRenderState = useRoleStore((state) => state.setRenderState);
  const setRenderedComponent = useRoleStore(
    (state) => state.setRenderedComponent,
  );

  const OptionButton = getComponentById("CS.ROLES.MENUACTION");

  useEffect(() => {
    if (user && roles) {
      //composants
      const ListButtonComponent = getComponentById("CS.ROLES.MENUACTION.LIST");
      const ParametreButtonComponent = getComponentById(
        "CS.ROLES.MENUACTION.PARAMETRE",
      );
      const AddButtonComponent = getComponentById("CS.ROLES.MENUACTION.ADD");
      const DashboardButton = getComponentById("CS.ROLES.MENUACTION.DASHBOARD");

      const sidebarComponents = [
        hasAccess(
          user,
          roles,
          "CS.ROLES.MENUACTION.DASHBOARD",
        ) && (
          <DashboardButton onClick={() => setRenderedComponent("dashboard")} />
        ),
        hasAccess(
          user,
          roles,
          "CS.ROLES.MENUACTION.LIST",
        ) && (
          <ListButtonComponent onClick={() => setRenderedComponent("list")} />
        ),
        hasAccess(
          user,
          roles,
          "CS.ROLES.MENUACTION.PARAMETRE",
        ) && (
          <ParametreButtonComponent
            onClick={() => setRenderedComponent("parametre")}
          />
        ),
        hasAccess(user, roles, "CS.ROLES.MENUACTION.ADD") && (
          <AddButtonComponent onClick={() => setRenderedComponent("add")} />
        ),
      ].filter(Boolean) as JSX.Element[];

      setRenderList(sidebarComponents);
    }
  }, [user, roles, setRenderedComponent]);

  return (
    <ERPPage
      title="Roles"
      description="Gérer les roles de l'établissement"
      headerActions={[
        <OptionButton
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
          key={"CS.ROLES.MENUACTION"}
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

export default RolesIndex;
