import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import { useEffect, useState, type JSX } from "react";
import NotFound from "../../NotFound";
import { usePersonnelStore } from "./store/PersonnelIndexStore";

function PersonnelsIndex() {
  //states
  const [render, setRender] = useState<JSX.Element>(<NotFound />);

  const menuListIsVisible = usePersonnelStore(
    (state) => state.menuListIsVisible,
  );
  const setMenuListIsVisible = usePersonnelStore(
    (state) => state.setMenuListIsVisible,
  );

  const renderState = usePersonnelStore(
    (state) => state.renderState,
  );
  const renderedElement = usePersonnelStore(
    (state) => state.renderedComponent,
  );

  const setRenderState = usePersonnelStore(
    (state) => state.setRenderState,
  );
  const setRenderedComponent = usePersonnelStore(
    (state) => state.setRenderedComponent,
  );

  useEffect(() => {
    if (renderedElement) {
      setRender(renderedElement);
    }
  }, [renderedElement]);

  //composants
  const OptionButton = getComponentById("PE.PERSONNELS.MENUACTION");
  const ListButtonComponent = getComponentById("PE.PERSONNELS.MENUACTION.LIST");
  const ParametreButtonComponent = getComponentById(
    "PE.PERSONNELS.MENUACTION.PARAMETRE",
  );
  const AddButtonComponent = getComponentById("PE.PERSONNELS.MENUACTION.ADD");
  const DashboardButton = getComponentById("PE.PERSONNELS.MENUACTION.DASHBOARD");

  return (
    <ERPPage
      title="Personnels"
      description="Gérer les personnels de l'établissement"
      headerActions={[
        <OptionButton
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
          key={"PE.PERSONNELS.MENUACTION"}
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

export default PersonnelsIndex;
