import { useEffect, useState, type JSX } from "react";
import ERPPage from "../../../components/page/ERPPage";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import { getComponentById } from "../../../components/components.build";
import NotFound from "../../NotFound";
import { useReferentielIndexStore } from "./store/ReferentielIndexStore";

export default function ReferentielsIndex() {
  const [render, setRender] = useState<JSX.Element>(<NotFound />);

  const menuListIsVisible = useReferentielIndexStore(
    (state) => state.menuListIsVisible,
  );
  const setMenuListIsVisible = useReferentielIndexStore(
    (state) => state.setMenuListIsVisible,
  );
  const renderState = useReferentielIndexStore((state) => state.renderState);
  const renderedElement = useReferentielIndexStore(
    (state) => state.renderedComponent,
  );
  const setRenderState = useReferentielIndexStore(
    (state) => state.setRenderState,
  );
  const setRenderedComponent = useReferentielIndexStore(
    (state) => state.setRenderedComponent,
  );

  useEffect(() => {
    if (renderedElement) {
      setRender(renderedElement);
    }
  }, [renderedElement]);

  const OptionButton = getComponentById("ET.REFERENTIELS.MENUACTION");
  const DashboardButton = getComponentById(
    "ET.REFERENTIELS.MENUACTION.DASHBOARD",
  );
  const ListButton = getComponentById("ET.REFERENTIELS.MENUACTION.LIST");
  const SettingButton = getComponentById(
    "ET.REFERENTIELS.MENUACTION.PARAMETRE",
  );
  const AddButton = getComponentById("ET.REFERENTIELS.MENUACTION.ADD");

  return (
    <ERPPage
      title="Referentiels"
      description="Listes reutilisables personnalisees pour les formulaires et le pilotage de l'etablissement"
      headerActions={[
        <OptionButton
          key="ET.REFERENTIELS.MENUACTION"
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
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
              <ListButton
                key="list"
                onClick={() => setRenderedComponent("list")}
              />,
              <SettingButton
                key="parametre"
                onClick={() => setRenderedComponent("parametre")}
              />,
              <AddButton
                key="add"
                onClick={() => setRenderedComponent("add")}
              />,
            ]}
          />
        </PageSidebarPopup>
      </div>
    </ERPPage>
  );
}
