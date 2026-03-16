import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import { useEffect, useState, type JSX } from "react";
import NotFound from "../../NotFound";
import { useDepartementStore } from "./store/DepartementIndexStore";

function DepartementIndex() {
  //states
  const [render, setRender] = useState<JSX.Element>(<NotFound />);

  const menuListIsVisible = useDepartementStore(
    (state) => state.menuListIsVisible,
  );
  const setMenuListIsVisible = useDepartementStore(
    (state) => state.setMenuListIsVisible,
  );

  const renderState = useDepartementStore(
    (state) => state.renderState,
  );
  const renderedElement = useDepartementStore(
    (state) => state.renderedComponent,
  );

  const setRenderState = useDepartementStore(
    (state) => state.setRenderState,
  );
  const setRenderedComponent = useDepartementStore(
    (state) => state.setRenderedComponent,
  );

  useEffect(() => {
    if (renderedElement) {
      setRender(renderedElement);
    }
  }, [renderedElement]);

  //composants
  const OptionButton = getComponentById("PE.DEPARTEMENTS.MENUACTION");
  const ListButtonComponent = getComponentById("PE.DEPARTEMENTS.MENUACTION.LIST");
  const ParametreButtonComponent = getComponentById(
    "PE.DEPARTEMENTS.MENUACTION.PARAMETRE",
  );
  const AddButtonComponent = getComponentById("PE.DEPARTEMENTS.MENUACTION.ADD");
  const DashboardButton = getComponentById("PE.DEPARTEMENTS.MENUACTION.DASHBOARD");

  return (
    <ERPPage
      title="Départements"
      description="Gérer les départements de l'établissement"
      headerActions={[
        <OptionButton
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
          key={"PE.DEPARTEMENTS.MENUACTION"}
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

export default DepartementIndex;
