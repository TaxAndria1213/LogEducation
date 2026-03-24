import { useEffect, useState, type JSX } from "react";
import ERPPage from "../../../components/page/ERPPage";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import { getComponentById } from "../../../components/components.build";
import NotFound from "../../NotFound";
import { useFactureStore } from "./store/FactureIndexStore";

export default function FacturesIndex() {
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
  const menuListIsVisible = useFactureStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = useFactureStore((state) => state.setMenuListIsVisible);
  const renderState = useFactureStore((state) => state.renderState);
  const renderedElement = useFactureStore((state) => state.renderedComponent);
  const setRenderState = useFactureStore((state) => state.setRenderState);
  const setRenderedComponent = useFactureStore((state) => state.setRenderedComponent);

  useEffect(() => {
    if (renderedElement) setRender(renderedElement);
  }, [renderedElement]);

  const OptionButton = getComponentById("FIN.FACTURES.MENUACTION");
  const DashboardButton = getComponentById("FIN.FACTURES.MENUACTION.DASHBOARD");
  const ListButton = getComponentById("FIN.FACTURES.MENUACTION.LIST");
  const ParametreButton = getComponentById("FIN.FACTURES.MENUACTION.PARAMETRE");
  const AddButton = getComponentById("FIN.FACTURES.MENUACTION.ADD");

  return (
    <ERPPage
      title="Factures"
      description="Emission, suivi et consultation des factures eleves de l'etablissement."
      headerActions={[
        <OptionButton
          key="FIN.FACTURES.MENUACTION"
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
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
            components={[
              <DashboardButton key="dashboard" onClick={() => setRenderedComponent("dashboard")} />,
              <ListButton key="list" onClick={() => setRenderedComponent("list")} />,
              <ParametreButton key="parametre" onClick={() => setRenderedComponent("parametre")} />,
              <AddButton key="add" onClick={() => setRenderedComponent("add")} />,
            ]}
          />
        </PageSidebarPopup>
      </div>
    </ERPPage>
  );
}
