import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import { useIncidentStore } from "./store/IncidentIndexStore";

export default function IncidentsIndex() {
  const menuListIsVisible = useIncidentStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = useIncidentStore((state) => state.setMenuListIsVisible);
  const renderState = useIncidentStore((state) => state.renderState);
  const renderedComponent = useIncidentStore((state) => state.renderedComponent);
  const setRenderState = useIncidentStore((state) => state.setRenderState);
  const setRenderedComponent = useIncidentStore((state) => state.setRenderedComponent);
  const OptionButton = getComponentById("DI.INCIDENTS.MENUACTION");
  const DashboardButton = getComponentById("DI.INCIDENTS.MENUACTION.DASHBOARD");
  const ListButton = getComponentById("DI.INCIDENTS.MENUACTION.LIST");
  const ParametreButton = getComponentById("DI.INCIDENTS.MENUACTION.PARAMETRE");
  const AddButton = getComponentById("DI.INCIDENTS.MENUACTION.ADD");

  return (
    <ERPPage
      title="Discipline - Incidents"
      description="Signaler, suivre et traiter les incidents disciplinaires."
      headerActions={[
        <OptionButton
          key="DI.INCIDENTS.MENUACTION"
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
        />,
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
