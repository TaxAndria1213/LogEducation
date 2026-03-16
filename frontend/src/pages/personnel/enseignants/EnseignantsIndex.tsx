import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import { useEffect, useState, type JSX } from "react";
import NotFound from "../../NotFound";
import { useEnseignantStore } from "./store/EnseignantIndexStore";

function EnseignantsIndex() {
  //states
  const [render, setRender] = useState<JSX.Element>(<NotFound />);

  const menuListIsVisible = useEnseignantStore(
    (state) => state.menuListIsVisible,
  );
  const setMenuListIsVisible = useEnseignantStore(
    (state) => state.setMenuListIsVisible,
  );

  const renderState = useEnseignantStore(
    (state) => state.renderState,
  );
  const renderedElement = useEnseignantStore(
    (state) => state.renderedComponent,
  );

  const setRenderState = useEnseignantStore(
    (state) => state.setRenderState,
  );
  const setRenderedComponent = useEnseignantStore(
    (state) => state.setRenderedComponent,
  );

  useEffect(() => {
    if (renderedElement) {
      setRender(renderedElement);
    }
  }, [renderedElement]);

  //composants
  const OptionButton = getComponentById("PE.ENSEIGNANTS.MENUACTION");
  const ListButtonComponent = getComponentById("PE.ENSEIGNANTS.MENUACTION.LIST");
  const ParametreButtonComponent = getComponentById(
    "PE.ENSEIGNANTS.MENUACTION.PARAMETRE",
  );
  const AddButtonComponent = getComponentById("PE.ENSEIGNANTS.MENUACTION.ADD");
  const DashboardButton = getComponentById("PE.ENSEIGNANTS.MENUACTION.DASHBOARD");

  return (
    <ERPPage
      title="Enseignants"
      description="Gérer les enseignants de l'établissement"
      headerActions={[
        <OptionButton
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
          key={"PE.ENSEIGNANTS.MENUACTION"}
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

export default EnseignantsIndex;
