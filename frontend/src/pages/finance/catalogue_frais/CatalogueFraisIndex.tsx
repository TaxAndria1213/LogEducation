import { useEffect, useState, type JSX } from "react";
import ERPPage from "../../../components/page/ERPPage";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import { getComponentById } from "../../../components/components.build";
import NotFound from "../../NotFound";
import { useCatalogueFraisStore } from "./store/CatalogueFraisIndexStore";

export default function CatalogueFraisIndex() {
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
  const menuListIsVisible = useCatalogueFraisStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = useCatalogueFraisStore((state) => state.setMenuListIsVisible);
  const renderState = useCatalogueFraisStore((state) => state.renderState);
  const renderedElement = useCatalogueFraisStore((state) => state.renderedComponent);
  const setRenderState = useCatalogueFraisStore((state) => state.setRenderState);
  const setRenderedComponent = useCatalogueFraisStore((state) => state.setRenderedComponent);

  useEffect(() => {
    if (renderedElement) setRender(renderedElement);
  }, [renderedElement]);

  const OptionButton = getComponentById("FIN.CATALOGUEFRAIS.MENUACTION");
  const DashboardButton = getComponentById("FIN.CATALOGUEFRAIS.MENUACTION.DASHBOARD");
  const ListButton = getComponentById("FIN.CATALOGUEFRAIS.MENUACTION.LIST");
  const ParametreButton = getComponentById("FIN.CATALOGUEFRAIS.MENUACTION.PARAMETRE");
  const AddButton = getComponentById("FIN.CATALOGUEFRAIS.MENUACTION.ADD");

  return (
    <ERPPage
      title="Catalogue de frais"
      description="Tarifs et frais reutilisables pour l'inscription, la facturation et les services."
      headerActions={[
        <OptionButton
          key="FIN.CATALOGUEFRAIS.MENUACTION"
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
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
              <DashboardButton key="dashboard" onClick={() => setRenderedComponent("dashboard")} />,
              <ListButton key="list" onClick={() => setRenderedComponent("list")} />,
              <ParametreButton key="parametre" onClick={() => setRenderedComponent("parametre")} />,
              <AddButton key="add" onClick={() => setRenderedComponent("add")} />,
            ]}
          />
        </PageSidebarPopup>
      </div>
    </ERPPage>
  );
}
