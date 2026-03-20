import { useEffect, useState, type JSX } from "react";
import { getComponentById } from "../../../components/components.build";
import ERPPage from "../../../components/page/ERPPage";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import NotFound from "../../NotFound";
import { usePeriodeStore } from "./store/PeriodeIndexStore";

function PeriodeIndex() {
  const [render, setRender] = useState<JSX.Element>(<NotFound />);

  const menuListIsVisible = usePeriodeStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = usePeriodeStore((state) => state.setMenuListIsVisible);
  const renderState = usePeriodeStore((state) => state.renderState);
  const renderedElement = usePeriodeStore((state) => state.renderedComponent);
  const setRenderState = usePeriodeStore((state) => state.setRenderState);
  const setRenderedComponent = usePeriodeStore((state) => state.setRenderedComponent);

  useEffect(() => {
    if (renderedElement) {
      setRender(renderedElement);
    }
  }, [renderedElement]);

  const OptionButton = getComponentById("ET.PERIODES.MENUACTION");
  const ListButtonComponent = getComponentById("ET.PERIODES.MENUACTION.LIST");
  const ParametreButtonComponent = getComponentById(
    "ET.PERIODES.MENUACTION.PARAMETRE",
  );
  const AddButtonComponent = getComponentById("ET.PERIODES.MENUACTION.ADD");
  const DashboardButton = getComponentById("ET.PERIODES.MENUACTION.DASHBOARD");

  return (
    <ERPPage
      title="Periodes"
      description="Gestion des periodes rattachees aux annees scolaires de l'etablissement"
      headerActions={[
        <OptionButton
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
          key="ET.PERIODES.MENUACTION"
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
              <ListButtonComponent
                key="list"
                onClick={() => setRenderedComponent("list")}
              />,
              <ParametreButtonComponent
                key="parametre"
                onClick={() => setRenderedComponent("parametre")}
              />,
              <AddButtonComponent
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

export default PeriodeIndex;
