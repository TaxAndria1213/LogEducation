import { useEffect, useState, type JSX } from "react";
import { getComponentById } from "../../../components/components.build";
import ERPPage from "../../../components/page/ERPPage";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import NotFound from "../../NotFound";
import { useProfileEtablissementStore } from "./store/SiteIndexStore";

function SitesIndex() {
  const [render, setRender] = useState<JSX.Element>(<NotFound />);

  const menuListIsVisible = useProfileEtablissementStore(
    (state) => state.menuListIsVisible,
  );
  const setMenuListIsVisible = useProfileEtablissementStore(
    (state) => state.setMenuListIsVisible,
  );

  const renderState = useProfileEtablissementStore((state) => state.renderState);
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

  const OptionButton = getComponentById("ET.SITES.MENUACTION");
  const ListButtonComponent = getComponentById("ET.SITES.MENUACTION.LIST");
  const ParametreButtonComponent = getComponentById(
    "ET.SITES.MENUACTION.PARAMETRE",
  );
  const AddButtonComponent = getComponentById("ET.SITES.MENUACTION.ADD");
  const DashboardButton = getComponentById("ET.SITES.MENUACTION.DASHBOARD");

  return (
    <ERPPage
      title="Sites"
      description="Gestion des sites rattaches a l'etablissement de l'utilisateur"
      headerActions={[
        <OptionButton
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
          key="ET.SITES.MENUACTION"
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

export default SitesIndex;
