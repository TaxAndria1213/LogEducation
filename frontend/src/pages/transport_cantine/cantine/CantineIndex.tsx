import { useEffect, useState, type JSX } from "react";
import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import NotFound from "../../NotFound";
import { useCantineStore } from "./store/CantineIndexStore";

export default function CantineIndex() {
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
  const menuListIsVisible = useCantineStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = useCantineStore((state) => state.setMenuListIsVisible);
  const renderState = useCantineStore((state) => state.renderState);
  const renderedElement = useCantineStore((state) => state.renderedComponent);
  const setRenderState = useCantineStore((state) => state.setRenderState);
  const setRenderedComponent = useCantineStore((state) => state.setRenderedComponent);
  const OptionButton = getComponentById("TC.CANTINE.MENUACTION");
  const DashboardButton = getComponentById("TC.CANTINE.MENUACTION.DASHBOARD");
  const ListButton = getComponentById("TC.CANTINE.MENUACTION.LIST");
  const ParametreButton = getComponentById("TC.CANTINE.MENUACTION.PARAMETRE");
  const AddButton = getComponentById("TC.CANTINE.MENUACTION.ADD");

  useEffect(() => {
    if (renderedElement) setRender(renderedElement);
  }, [renderedElement]);

  return (
    <ERPPage
      title="Cantine"
      description="Gestion des formules de cantine et des abonnements lies aux eleves."
      headerActions={[
        <OptionButton
          key="TC.CANTINE.MENUACTION"
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
