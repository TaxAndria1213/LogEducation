import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import { useProfileEtablissementStore } from "./store/SiteIndexStore";
import { useEffect, useState, type JSX } from "react";
import NotFound from "../../NotFound";

function SitesIndex() {
  //states
  const [render, setRender] = useState<JSX.Element>(<NotFound />);

  const menuListIsVisible = useProfileEtablissementStore(
    (state) => state.menuListIsVisible,
  );
  const setMenuListIsVisible = useProfileEtablissementStore(
    (state) => state.setMenuListIsVisible,
  );

  const renderState = useProfileEtablissementStore(
    (state) => state.renderState,
  );
  const renderedElement = useProfileEtablissementStore(
    (state) => state.renderedComponent,
  );

  const setRenderState = useProfileEtablissementStore(
    (state) => state.setRenderState,
  );
  const setRenderedComponent = useProfileEtablissementStore(
    (state) => state.setRenderedComponent,
  );

  useEffect(() => {
    if (renderedElement) {
      setRender(renderedElement);
    }
  }, [renderedElement]);

  //composants
  const OptionButton = getComponentById("ET.SITES.MENUACTION");
  const ListButtonComponent = getComponentById("ET.SITES.MENUACTION.LIST");
  const ParametreButtonComponent = getComponentById(
    "ET.SITES.MENUACTION.PARAMETRE",
  );
  const AddButtonComponent = getComponentById("ET.SITES.MENUACTION.ADD");
  const DashboardButton = getComponentById("ET.SITES.MENUACTION.DASHBOARD");

  return (
    <ERPPage
      title="Site"
      description="Gérer les sites de l'établissement"
      headerActions={[
        <OptionButton
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
          key={"ET.SITES.MENUACTION"}
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

export default SitesIndex;
