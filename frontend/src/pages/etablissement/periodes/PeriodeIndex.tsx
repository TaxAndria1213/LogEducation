import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import { usePeriodeStore } from "./store/PeriodeIndexStore";
import { useEffect, useState, type JSX } from "react";
import NotFound from "../../NotFound";

function PeriodeIndex() {
  //states
  const [render, setRender] = useState<JSX.Element>(<NotFound />);

  const menuListIsVisible = usePeriodeStore(
    (state) => state.menuListIsVisible,
  );
  const setMenuListIsVisible = usePeriodeStore(
    (state) => state.setMenuListIsVisible,
  );

  const renderState = usePeriodeStore(
    (state) => state.renderState,
  );
  const renderedElement = usePeriodeStore(
    (state) => state.renderedComponent,
  );

  const setRenderState = usePeriodeStore(
    (state) => state.setRenderState,
  );
  const setRenderedComponent = usePeriodeStore(
    (state) => state.setRenderedComponent,
  );

  useEffect(() => {
    if (renderedElement) {
      setRender(renderedElement);
    }
  }, [renderedElement]);

  //composants
  const OptionButton = getComponentById("ET.PERIODES.MENUACTION");
  const ListButtonComponent = getComponentById("ET.PERIODES.MENUACTION.LIST");
  const ParametreButtonComponent = getComponentById(
    "ET.PERIODES.MENUACTION.PARAMETRE",
  );
  const AddButtonComponent = getComponentById("ET.PERIODES.MENUACTION.ADD");
  const DashboardButton = getComponentById("ET.PERIODES.MENUACTION.DASHBOARD");

  return (
    <ERPPage
      title="Période"
      description="Gérer les périodes de l'établissement"
      headerActions={[
        <OptionButton
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
          key={"ET.PERIODES.MENUACTION"}
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
                <DashboardButton
                  onClick={() => setRenderedComponent("dashboard")}
                />,
                <ListButtonComponent
                  onClick={() => setRenderedComponent("list")}
                />,
                <ParametreButtonComponent
                  onClick={() => setRenderedComponent("parametre")}
                />,
                <AddButtonComponent
                  onClick={() => {
                    setRenderedComponent("add");
                  }}
                />,
              ]}
            />
          </PageSidebarPopup>
      </div>
    </ERPPage>
  );
}

export default PeriodeIndex;
