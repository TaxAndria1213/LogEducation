import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import { useAnneeScolaireStore } from "./store/AnneeScolaireIndexStore";
import { useEffect, useState, type JSX } from "react";
import NotFound from "../../NotFound";

function AnneeScolaireIndex() {
  //states
  const [render, setRender] = useState<JSX.Element>(<NotFound />);

  const menuListIsVisible = useAnneeScolaireStore(
    (state) => state.menuListIsVisible,
  );
  const setMenuListIsVisible = useAnneeScolaireStore(
    (state) => state.setMenuListIsVisible,
  );

  const renderState = useAnneeScolaireStore(
    (state) => state.renderState,
  );
  const renderedElement = useAnneeScolaireStore(
    (state) => state.renderedComponent,
  );

  const setRenderState = useAnneeScolaireStore(
    (state) => state.setRenderState,
  );
  const setRenderedComponent = useAnneeScolaireStore(
    (state) => state.setRenderedComponent,
  );

  useEffect(() => {
    if (renderedElement) {
      setRender(renderedElement);
    }
  }, [renderedElement]);

  //composants
  const OptionButton = getComponentById("ET.ANNEESCOLAIRES.MENUACTION");
  const ListButtonComponent = getComponentById("ET.ANNEESCOLAIRES.MENUACTION.LIST");
  const ParametreButtonComponent = getComponentById(
    "ET.ANNEESCOLAIRES.MENUACTION.PARAMETRE",
  );
  const AddButtonComponent = getComponentById("ET.ANNEESCOLAIRES.MENUACTION.ADD");
  const DashboardButton = getComponentById("ET.ANNEESCOLAIRES.MENUACTION.DASHBOARD");

  return (
    <ERPPage
      title="Année scolaire"
      description="Gérer l'année scolaire de l'établissement"
      headerActions={[
        <OptionButton
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
          key={"ET.ANNEESCOLAIRES.MENUACTION"}
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

export default AnneeScolaireIndex;
