import ERPPage from "../../../components/page/ERPPage";
import {
  getComponentById,
  hasAccess,
} from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import { useInscriptionStore } from "./store/InscriptionIndexStore";
import { useEffect, useMemo, useState, type JSX } from "react";
import NotFound from "../../NotFound";
import { useAuth } from "../../../auth/AuthContext";

import InscriptionList from "./components/table/InscriptionTable";
import InscriptionDashboard from "./components/dashboard/InscriptionDashboard";
import ReinscriptionForm from "./components/reinscription/ReinscriptionForm";
import { useNavigate } from "react-router-dom";

function InscriptionsIndex() {
  const { user, roles } = useAuth();
  const navigate = useNavigate();

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
    if (renderedComponent === "add") {
      setRenderedComponent("dashboard");
    }
  }, [renderedComponent, setRenderedComponent]);

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
      const DraftsButton = getComponentById(
        "SC.INSCRIPTIONS.MENUACTION.DRAFTS",
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
            onClick={() => {
              setMenuListIsVisible(false);
              navigate("/scolarite/inscriptions/nouveau");
            }}
          />
        ),
        hasAccess(user, roles, "SC.INSCRIPTIONS.MENUACTION.DRAFTS") && (
          <DraftsButton
            key="drafts"
            onClick={() => {
              setMenuListIsVisible(false);
              navigate("/scolarite/inscriptions/brouillons");
            }}
          />
        ),
      ].filter(Boolean) as JSX.Element[];

      setRenderList(sidebarComponents);
    }
  }, [navigate, setMenuListIsVisible, setRenderedComponent, user, roles]);

  const render = useMemo(() => {
    switch (renderedComponent) {
      case "dashboard":
        return (
          <InscriptionDashboard
            onNouvelleInscription={() => {
              navigate("/scolarite/inscriptions/nouveau");
            }}
            onReinscription={() => {
              setRenderedComponent("reinscription");
            }}
            onBrouillons={() => {
              navigate("/scolarite/inscriptions/brouillons");
            }}
          />
        );

      case "list":
        return <InscriptionList />;

      case "parametre":
        return <InscriptionDashboard mode="settings" />;

      case "reinscription":
        return <ReinscriptionForm />;

      default:
        return <NotFound />;
    }
  }, [navigate, renderedComponent, setRenderedComponent]);

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
        <PageSidebarPopup
          open={menuListIsVisible}
          onClose={() => setMenuListIsVisible(false)}
        >
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

export default InscriptionsIndex;
