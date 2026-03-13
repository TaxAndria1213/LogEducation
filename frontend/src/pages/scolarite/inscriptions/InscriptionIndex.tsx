import ERPPage from "../../../components/page/ERPPage";
import {
  getComponentById,
  hasAccess,
} from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import { useInscriptionStore } from "./store/InscriptionIndexStore";
import { useEffect, useMemo, useState, type JSX } from "react";
import NotFound from "../../NotFound";
import { useAuth } from "../../../auth/AuthContext";

import InscriptionList from "./components/table/InscriptionTable";
import InscriptionForm from "./components/form/InscriptionForm";
import InscriptionDashboard from "./components/dashboard/InscriptionDashboard";
import ReinscriptionForm from "./components/reinscription/ReinscriptionForm";

function InscriptionsIndex() {
  const { user, roles } = useAuth();

  const [renderList, setRenderList] = useState<JSX.Element[]>([]);

  const menuListIsVisible = useInscriptionStore(
    (state) => state.menuListIsVisible,
  );
  const setMenuListIsVisible = useInscriptionStore(
    (state) => state.setMenuListIsVisible,
  );

  const renderState = useInscriptionStore((state) => state.renderState);
  const renderedComponent = useInscriptionStore(
    (state) => state.renderedComponent,
  );

  const setRenderState = useInscriptionStore((state) => state.setRenderState);
  const setRenderedComponent = useInscriptionStore(
    (state) => state.setRenderedComponent,
  );

  const OptionButton = getComponentById("SC.INSCRIPTIONS.MENUACTION");

  useEffect(() => {
    if (user && roles) {
      const ListButtonComponent = getComponentById(
        "SC.INSCRIPTIONS.MENUACTION.LIST",
      );
      const ParametreButtonComponent = getComponentById(
        "SC.INSCRIPTIONS.MENUACTION.PARAMETRE",
      );
      const AddButtonComponent = getComponentById(
        "SC.INSCRIPTIONS.MENUACTION.ADD",
      );
      const DashboardButton = getComponentById(
        "SC.INSCRIPTIONS.MENUACTION.DASHBOARD",
      );

      const sidebarComponents = [
        hasAccess(user, roles, "SC.INSCRIPTIONS.MENUACTION.DASHBOARD") && (
          <DashboardButton
            key="dashboard"
            onClick={() => setRenderedComponent("dashboard")}
          />
        ),
        hasAccess(user, roles, "SC.INSCRIPTIONS.MENUACTION.LIST") && (
          <ListButtonComponent
            key="list"
            onClick={() => setRenderedComponent("list")}
          />
        ),
        hasAccess(user, roles, "SC.INSCRIPTIONS.MENUACTION.PARAMETRE") && (
          <ParametreButtonComponent
            key="parametre"
            onClick={() => setRenderedComponent("parametre")}
          />
        ),
        hasAccess(user, roles, "SC.INSCRIPTIONS.MENUACTION.ADD") && (
          <AddButtonComponent
            key="add"
            onClick={() => setRenderedComponent("add")}
          />
        ),
      ].filter(Boolean) as JSX.Element[];

      setRenderList(sidebarComponents);
    }
  }, [user, roles, setRenderedComponent]);

  const render = useMemo(() => {
    switch (renderedComponent) {
      case "dashboard":
        return (
          <InscriptionDashboard
            onNouvelleInscription={() => {
              setRenderedComponent("add");
              setRenderState(3);
            }}
            onReinscription={() => {
              setRenderedComponent("reinscription");
              setRenderState(3);
            }}
          />
        );

      case "list":
        return <InscriptionList />;

      case "reinscription":
        return <ReinscriptionForm />;

      case "add":
        return <InscriptionForm />;

      default:
        return <NotFound />;
    }
  }, [renderedComponent, setRenderedComponent, setRenderState]);

  return (
    <ERPPage
      title="Inscription"
      description="Gérer les inscriptions de l'établissement"
      headerActions={[
        <OptionButton
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
          key="SC.INSCRIPTIONS.MENUACTION"
        />,
      ]}
    >
      <div className="flex">
        <div className="flex-1">{render}</div>

        {menuListIsVisible ? (
          <div className="ml-4 border-l border-slate-200 pl-4">
            <ListContainer
              selected={renderState}
              setSelected={setRenderState}
              components={renderList}
            />
          </div>
        ) : (
          <div className="hidden" />
        )}
      </div>
    </ERPPage>
  );
}

export default InscriptionsIndex;
