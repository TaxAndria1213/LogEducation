import { useEffect, useState, type JSX } from "react";
import { getComponentById } from "../../../components/components.build";
import ERPPage from "../../../components/page/ERPPage";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import NotFound from "../../NotFound";
import { useInitialisationEtablissementStore } from "./store/InitialisationEtablissementIndexStore";

function InitialisationEtablissementIndex() {
  const [render, setRender] = useState<JSX.Element>(<NotFound />);

  const menuListIsVisible = useInitialisationEtablissementStore(
    (state) => state.menuListIsVisible,
  );
  const setMenuListIsVisible = useInitialisationEtablissementStore(
    (state) => state.setMenuListIsVisible,
  );
  const renderState = useInitialisationEtablissementStore(
    (state) => state.renderState,
  );
  const renderedElement = useInitialisationEtablissementStore(
    (state) => state.renderedComponent,
  );
  const setRenderState = useInitialisationEtablissementStore(
    (state) => state.setRenderState,
  );
  const setRenderedComponent = useInitialisationEtablissementStore(
    (state) => state.setRenderedComponent,
  );

  useEffect(() => {
    if (renderedElement) {
      setRender(renderedElement);
    }
  }, [renderedElement]);

  const OptionButton = getComponentById("ET.INIT.MENUACTION");
  const DashboardButton = getComponentById("ET.INIT.MENUACTION.DASHBOARD");
  const ListButton = getComponentById("ET.INIT.MENUACTION.LIST");
  const SettingsButton = getComponentById("ET.INIT.MENUACTION.PARAMETRE");
  const LaunchButton = getComponentById("ET.INIT.MENUACTION.ADD");

  return (
    <ERPPage
      title="Initialisation"
      description="Assistant d'amorcage de l'etablissement et des nouvelles annees scolaires"
      headerActions={[
        <OptionButton
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
          key="ET.INIT.MENUACTION"
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
            components={[
              <DashboardButton
                key="dashboard"
                onClick={() => setRenderedComponent("dashboard")}
              />,
              <ListButton key="list" onClick={() => setRenderedComponent("list")} />,
              <SettingsButton
                key="settings"
                onClick={() => setRenderedComponent("parametre")}
              />,
              <LaunchButton key="launch" onClick={() => setRenderedComponent("add")} />,
            ]}
          />
        </PageSidebarPopup>
      </div>
    </ERPPage>
  );
}

export default InitialisationEtablissementIndex;
