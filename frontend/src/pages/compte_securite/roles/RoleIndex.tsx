import ERPPage from "../../../components/page/ERPPage";
import {
  getComponentById,
  hasAccess,
} from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import { useRoleStore } from "./store/RoleIndexStore";
import { useEffect, useState, type JSX } from "react";
import NotFound from "../../NotFound";
import { useAuth } from "../../../auth/AuthContext";

function RolesIndex() {
  const { user, roles } = useAuth();

  //states
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
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
    if (renderedElement) {
      setRender(renderedElement);
    }
  }, [renderedElement]);

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

export default RolesIndex;
