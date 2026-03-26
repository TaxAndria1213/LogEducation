import { useEffect, useState, type JSX } from "react";
import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import NotFound from "../../NotFound";
import { useRemiseStore } from "./store/RemiseIndexStore";

export default function RemisesIndex() {
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
  const menuListIsVisible = useRemiseStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = useRemiseStore((state) => state.setMenuListIsVisible);
  const renderState = useRemiseStore((state) => state.renderState);
  const renderedElement = useRemiseStore((state) => state.renderedComponent);
  const setRenderState = useRemiseStore((state) => state.setRenderState);
  const setRenderedComponent = useRemiseStore((state) => state.setRenderedComponent);
  const OptionButton = getComponentById("FIN.REMISES.MENUACTION");
  const DashboardButton = getComponentById("FIN.REMISES.MENUACTION.DASHBOARD");
  const ListButton = getComponentById("FIN.REMISES.MENUACTION.LIST");
  const ParametreButton = getComponentById("FIN.REMISES.MENUACTION.PARAMETRE");
  const AddButton = getComponentById("FIN.REMISES.MENUACTION.ADD");

  useEffect(() => {
    if (renderedElement) setRender(renderedElement);
  }, [renderedElement]);

  return (
    <ERPPage
      title="Remises"
      description="Regles et reductions applicables aux frais et facturations."
      headerActions={[
        <OptionButton
          key="FIN.REMISES.MENUACTION"
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
        />,
      ]}
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">{render}</div>
        <PageSidebarPopup open={menuListIsVisible} onClose={() => setMenuListIsVisible(false)}>
          <ListContainer
            onItemClick={() => setMenuListIsVisible(false)}
            selected={renderState}
            setSelected={setRenderState}
            components={[
              <DashboardButton onClick={() => setRenderedComponent("dashboard")} />,
              <ListButton onClick={() => setRenderedComponent("list")} />,
              <ParametreButton onClick={() => setRenderedComponent("parametre")} />,
              <AddButton onClick={() => setRenderedComponent("add")} />,
            ]}
          />
        </PageSidebarPopup>
      </div>
    </ERPPage>
  );
}
