import { useEffect, useState, type JSX } from "react";
import { getComponentById } from "../../../components/components.build";
import ERPPage from "../../../components/page/ERPPage";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import NotFound from "../../NotFound";
import { useSalleStore } from "./store/SalleIndexStore";

function SalleIndex() {
  const [render, setRender] = useState<JSX.Element>(<NotFound />);

  const menuListIsVisible = useSalleStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = useSalleStore((state) => state.setMenuListIsVisible);
  const renderState = useSalleStore((state) => state.renderState);
  const renderedElement = useSalleStore((state) => state.renderedComponent);
  const setRenderState = useSalleStore((state) => state.setRenderState);
  const setRenderedComponent = useSalleStore((state) => state.setRenderedComponent);

  useEffect(() => {
    if (renderedElement) {
      setRender(renderedElement);
    }
  }, [renderedElement]);

  const OptionButton = getComponentById("ET.SALLES.MENUACTION");
  const ListButtonComponent = getComponentById("ET.SALLES.MENUACTION.LIST");
  const ParametreButtonComponent = getComponentById(
    "ET.SALLES.MENUACTION.PARAMETRE",
  );
  const AddButtonComponent = getComponentById("ET.SALLES.MENUACTION.ADD");
  const DashboardButton = getComponentById("ET.SALLES.MENUACTION.DASHBOARD");

  return (
    <ERPPage
      title="Salles"
      description="Gestion des salles rattachees aux sites de l'etablissement"
      headerActions={[
        <OptionButton
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
          key="ET.SALLES.MENUACTION"
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

export default SalleIndex;
