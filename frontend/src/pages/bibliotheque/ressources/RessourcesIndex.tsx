import { useEffect, useState, type JSX } from "react";
import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import NotFound from "../../NotFound";
import { useRessourceBibliothequeStore } from "./store/RessourceBibliothequeIndexStore";

export default function RessourcesIndex() {
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
  const menuListIsVisible = useRessourceBibliothequeStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = useRessourceBibliothequeStore((state) => state.setMenuListIsVisible);
  const renderState = useRessourceBibliothequeStore((state) => state.renderState);
  const renderedElement = useRessourceBibliothequeStore((state) => state.renderedComponent);
  const setRenderState = useRessourceBibliothequeStore((state) => state.setRenderState);
  const setRenderedComponent = useRessourceBibliothequeStore((state) => state.setRenderedComponent);
  const OptionButton = getComponentById("BI.RESSOURCES.MENUACTION");
  const DashboardButton = getComponentById("BI.RESSOURCES.MENUACTION.DASHBOARD");
  const ListButton = getComponentById("BI.RESSOURCES.MENUACTION.LIST");
  const ParametreButton = getComponentById("BI.RESSOURCES.MENUACTION.PARAMETRE");
  const AddButton = getComponentById("BI.RESSOURCES.MENUACTION.ADD");

  useEffect(() => {
    if (renderedElement) setRender(renderedElement);
  }, [renderedElement]);

  return (
    <ERPPage
      title="Bibliotheque - Ressources"
      description="Catalogue des livres et materiels disponibles dans la bibliotheque de l'etablissement."
      headerActions={[
        <OptionButton
          key="BI.RESSOURCES.MENUACTION"
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
        />,
      ]}
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">{render}</div>
        <PageSidebarPopup open={menuListIsVisible} onClose={() => setMenuListIsVisible(false)}>
          <ListContainer
            onItemClick={() => setMenuListIsVisible(false)}
            selected={renderState}
            setSelected={setRenderState}
            components={[
              <DashboardButton onClick={() => setRenderedComponent("dashboard")} />,
              <ListButton onClick={() => setRenderedComponent("list")} />,
              <ParametreButton onClick={() => setRenderedComponent("parametre")} />,
              <AddButton onClick={() => setRenderedComponent("add")} />,
            ]}
          />
        </PageSidebarPopup>
      </div>
    </ERPPage>
  );
}
