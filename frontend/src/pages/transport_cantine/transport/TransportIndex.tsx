import { useEffect, useState, type JSX } from "react";
import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import NotFound from "../../NotFound";
import { useTransportStore } from "./store/TransportIndexStore";

export default function TransportIndex() {
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
  const menuListIsVisible = useTransportStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = useTransportStore((state) => state.setMenuListIsVisible);
  const renderState = useTransportStore((state) => state.renderState);
  const renderedElement = useTransportStore((state) => state.renderedComponent);
  const setRenderState = useTransportStore((state) => state.setRenderState);
  const setRenderedComponent = useTransportStore((state) => state.setRenderedComponent);
  const OptionButton = getComponentById("TC.TRANSPORT.MENUACTION");
  const DashboardButton = getComponentById("TC.TRANSPORT.MENUACTION.DASHBOARD");
  const ListButton = getComponentById("TC.TRANSPORT.MENUACTION.LIST");
  const ParametreButton = getComponentById("TC.TRANSPORT.MENUACTION.PARAMETRE");
  const AddButton = getComponentById("TC.TRANSPORT.MENUACTION.ADD");

  useEffect(() => {
    if (renderedElement) setRender(renderedElement);
  }, [renderedElement]);

  return (
    <ERPPage
      title="Transport"
      description="Gestion des lignes, arrets et abonnements transport lies aux eleves."
      headerActions={[
        <OptionButton
          key="TC.TRANSPORT.MENUACTION"
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
        />,
      ]}
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">{render}</div>
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
                onClick={() => setRenderedComponent("dashboard")}
              />,
              <ListButton onClick={() => setRenderedComponent("list")} />,
              <ParametreButton
                onClick={() => setRenderedComponent("parametre")}
              />,
              <AddButton onClick={() => setRenderedComponent("add")} />,
            ]}
          />
        </PageSidebarPopup>
      </div>
    </ERPPage>
  );
}
