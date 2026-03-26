import { useEffect, useState, type JSX } from "react";
import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import NotFound from "../../NotFound";
import { useEmpruntBibliothequeStore } from "./store/EmpruntBibliothequeIndexStore";

export default function EmpruntsIndex() {
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
  const menuListIsVisible = useEmpruntBibliothequeStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = useEmpruntBibliothequeStore((state) => state.setMenuListIsVisible);
  const renderState = useEmpruntBibliothequeStore((state) => state.renderState);
  const renderedElement = useEmpruntBibliothequeStore((state) => state.renderedComponent);
  const setRenderState = useEmpruntBibliothequeStore((state) => state.setRenderState);
  const setRenderedComponent = useEmpruntBibliothequeStore((state) => state.setRenderedComponent);
  const OptionButton = getComponentById("BI.EMPRUNTS.MENUACTION");
  const DashboardButton = getComponentById("BI.EMPRUNTS.MENUACTION.DASHBOARD");
  const ListButton = getComponentById("BI.EMPRUNTS.MENUACTION.LIST");
  const ParametreButton = getComponentById("BI.EMPRUNTS.MENUACTION.PARAMETRE");
  const AddButton = getComponentById("BI.EMPRUNTS.MENUACTION.ADD");

  useEffect(() => {
    if (renderedElement) setRender(renderedElement);
  }, [renderedElement]);

  return (
    <ERPPage
      title="Bibliotheque - Emprunts"
      description="Suivi des sorties, retours et retards des ressources de bibliotheque."
      headerActions={[
        <OptionButton
          key="BI.EMPRUNTS.MENUACTION"
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
