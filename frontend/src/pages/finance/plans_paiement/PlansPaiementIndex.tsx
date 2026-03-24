import { useEffect, useState, type JSX } from "react";
import ERPPage from "../../../components/page/ERPPage";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import { getComponentById } from "../../../components/components.build";
import NotFound from "../../NotFound";
import { usePlanPaiementStore } from "./store/PlanPaiementIndexStore";

export default function PlansPaiementIndex() {
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
  const menuListIsVisible = usePlanPaiementStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = usePlanPaiementStore((state) => state.setMenuListIsVisible);
  const renderState = usePlanPaiementStore((state) => state.renderState);
  const renderedElement = usePlanPaiementStore((state) => state.renderedComponent);
  const setRenderState = usePlanPaiementStore((state) => state.setRenderState);
  const setRenderedComponent = usePlanPaiementStore((state) => state.setRenderedComponent);

  useEffect(() => {
    if (renderedElement) setRender(renderedElement);
  }, [renderedElement]);

  const OptionButton = getComponentById("FIN.PLANSPAIEMENT.MENUACTION");
  const DashboardButton = getComponentById("FIN.PLANSPAIEMENT.MENUACTION.DASHBOARD");
  const ListButton = getComponentById("FIN.PLANSPAIEMENT.MENUACTION.LIST");
  const ParametreButton = getComponentById("FIN.PLANSPAIEMENT.MENUACTION.PARAMETRE");
  const AddButton = getComponentById("FIN.PLANSPAIEMENT.MENUACTION.ADD");

  return (
    <ERPPage
      title="Plans de paiement"
      description="Echeanciers et tranches de reglement par eleve et annee scolaire."
      headerActions={[
        <OptionButton
          key="FIN.PLANSPAIEMENT.MENUACTION"
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
