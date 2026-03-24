import { useEffect, useState, type JSX } from "react";
import ERPPage from "../../../components/page/ERPPage";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import { getComponentById } from "../../../components/components.build";
import NotFound from "../../NotFound";
import { usePaiementStore } from "./store/PaiementIndexStore";

export default function PaiementsIndex() {
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
  const menuListIsVisible = usePaiementStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = usePaiementStore((state) => state.setMenuListIsVisible);
  const renderState = usePaiementStore((state) => state.renderState);
  const renderedElement = usePaiementStore((state) => state.renderedComponent);
  const setRenderState = usePaiementStore((state) => state.setRenderState);
  const setRenderedComponent = usePaiementStore((state) => state.setRenderedComponent);

  useEffect(() => {
    if (renderedElement) setRender(renderedElement);
  }, [renderedElement]);

  const OptionButton = getComponentById("FIN.PAIEMENTS.MENUACTION");
  const DashboardButton = getComponentById("FIN.PAIEMENTS.MENUACTION.DASHBOARD");
  const ListButton = getComponentById("FIN.PAIEMENTS.MENUACTION.LIST");
  const ParametreButton = getComponentById("FIN.PAIEMENTS.MENUACTION.PARAMETRE");
  const AddButton = getComponentById("FIN.PAIEMENTS.MENUACTION.ADD");

  return (
    <ERPPage
      title="Paiements"
      description="Encaissements, references et suivi des paiements associes aux factures."
      headerActions={[
        <OptionButton
          key="FIN.PAIEMENTS.MENUACTION"
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
