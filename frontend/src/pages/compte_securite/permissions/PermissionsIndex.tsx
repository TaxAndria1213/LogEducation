import ERPPage from "../../../components/page/ERPPage";
import {
  getComponentById,
  hasAccess,
} from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import { usePermissionStore } from "./store/PermissionIndexStore";
import { useEffect, useState, type JSX } from "react";
import { useAuth } from "../../../auth/AuthContext";

function PermissionsIndex() {
  const { user, roles } = useAuth();
  const [renderList, setRenderList] = useState<JSX.Element[]>([<></>]);

  const menuListIsVisible = usePermissionStore(
    (state) => state.menuListIsVisible,
  );
  const setMenuListIsVisible = usePermissionStore(
    (state) => state.setMenuListIsVisible,
  );

  const renderState = usePermissionStore((state) => state.renderState);
  const renderedElement = usePermissionStore(
    (state) => state.renderedComponent,
  );

  const setRenderState = usePermissionStore((state) => state.setRenderState);
  const setRenderedComponent = usePermissionStore(
    (state) => state.setRenderedComponent,
  );

  const OptionButton = getComponentById("CS.PERMISSIONS.MENUACTION");

  useEffect(() => {
    if (user && roles) {
      const ListButtonComponent = getComponentById(
        "CS.PERMISSIONS.MENUACTION.LIST",
      );
      const ParametreButtonComponent = getComponentById(
        "CS.PERMISSIONS.MENUACTION.PARAMETRE",
      );
      const AddButtonComponent = getComponentById(
        "CS.PERMISSIONS.MENUACTION.ADD",
      );
      const DashboardButton = getComponentById(
        "CS.PERMISSIONS.MENUACTION.DASHBOARD",
      );

      const sidebarComponents = [
        hasAccess(user, roles, "CS.PERMISSIONS.MENUACTION.DASHBOARD") && (
          <DashboardButton onClick={() => setRenderedComponent("dashboard")} />
        ),
        hasAccess(user, roles, "CS.PERMISSIONS.MENUACTION.LIST") && (
          <ListButtonComponent onClick={() => setRenderedComponent("list")} />
        ),
        hasAccess(user, roles, "CS.PERMISSIONS.MENUACTION.PARAMETRE") && (
          <ParametreButtonComponent
            onClick={() => setRenderedComponent("parametre")}
          />
        ),
        hasAccess(user, roles, "CS.PERMISSIONS.MENUACTION.ADD") && (
          <AddButtonComponent onClick={() => setRenderedComponent("add")} />
        ),
      ].filter(Boolean) as JSX.Element[];

      setRenderList(sidebarComponents);
    }
  }, [user, roles, setRenderedComponent]);

  return (
    <ERPPage
      title="Permissions"
      description="Gerer les permissions fonctionnelles de l'etablissement"
      headerActions={[
        <OptionButton
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
          key={"CS.PERMISSIONS.MENUACTION"}
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

export default PermissionsIndex;
