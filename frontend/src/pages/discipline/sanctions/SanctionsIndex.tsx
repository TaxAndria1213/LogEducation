import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import { useSanctionStore } from "./store/SanctionIndexStore";

export default function SanctionsIndex() {
  const menuListIsVisible = useSanctionStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = useSanctionStore((state) => state.setMenuListIsVisible);
  const renderState = useSanctionStore((state) => state.renderState);
  const renderedComponent = useSanctionStore((state) => state.renderedComponent);
  const setRenderState = useSanctionStore((state) => state.setRenderState);
  const setRenderedComponent = useSanctionStore((state) => state.setRenderedComponent);
  const OptionButton = getComponentById("DI.SANCTIONS.MENUACTION");
  const DashboardButton = getComponentById("DI.SANCTIONS.MENUACTION.DASHBOARD");
  const ListButton = getComponentById("DI.SANCTIONS.MENUACTION.LIST");
  const ParametreButton = getComponentById("DI.SANCTIONS.MENUACTION.PARAMETRE");
  const AddButton = getComponentById("DI.SANCTIONS.MENUACTION.ADD");

  return (
    <ERPPage
      title="Discipline - Sanctions"
      description="Suivre les decisions disciplinaires et leurs periodes d'application."
      headerActions={[
        <OptionButton key="DI.SANCTIONS.MENUACTION" onClick={() => setMenuListIsVisible(!menuListIsVisible)} />,
      ]}
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">{renderedComponent}</div>
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
