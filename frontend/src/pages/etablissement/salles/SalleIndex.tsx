import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import { useSalleStore } from "./store/SalleIndexStore";
import { useEffect, useState, type JSX } from "react";
import NotFound from "../../NotFound";

function SalleIndex() {
  //states
  const [render, setRender] = useState<JSX.Element>(<NotFound />);

  const menuListIsVisible = useSalleStore(
    (state) => state.menuListIsVisible,
  );
  const setMenuListIsVisible = useSalleStore(
    (state) => state.setMenuListIsVisible,
  );

  const renderState = useSalleStore(
    (state) => state.renderState,
  );
  const renderedElement = useSalleStore(
    (state) => state.renderedComponent,
  );

  const setRenderState = useSalleStore(
    (state) => state.setRenderState,
  );
  const setRenderedComponent = useSalleStore(
    (state) => state.setRenderedComponent,
  );

  useEffect(() => {
    if (renderedElement) {
      setRender(renderedElement);
    }
  }, [renderedElement]);

  //composants
  const OptionButton = getComponentById("ET.SALLES.MENUACTION");
  const ListButtonComponent = getComponentById("ET.SALLES.MENUACTION.LIST");
  const ParametreButtonComponent = getComponentById(
    "ET.SALLES.MENUACTION.PARAMETRE",
  );
  const AddButtonComponent = getComponentById("ET.SALLES.MENUACTION.ADD");
  const DashboardButton = getComponentById("ET.SALLES.MENUACTION.DASHBOARD");

  return (
    <ERPPage
      title="Salle"
      description="Gérer les salles de l'établissement"
      headerActions={[
        <OptionButton
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
          key={"ET.SALLES.MENUACTION"}
        />,
      ]}
    >
      <div className="flex">
        <div className="flex-1">{render}</div>
        {menuListIsVisible ? (
          <div className="border-l border-slate-200 pl-4 ml-4">
            <ListContainer
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
          </div>
        ) : (
          <div className="none"></div>
        )}
      </div>
    </ERPPage>
  );
}

export default SalleIndex;
