import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import { useSessionAppelStore } from "./store/SessionAppelIndexStore";

export default function SessionsAppelIndex() {
  const menuListIsVisible = useSessionAppelStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = useSessionAppelStore((state) => state.setMenuListIsVisible);
  const renderState = useSessionAppelStore((state) => state.renderState);
  const renderedComponent = useSessionAppelStore((state) => state.renderedComponent);
  const setRenderState = useSessionAppelStore((state) => state.setRenderState);
  const setRenderedComponent = useSessionAppelStore((state) => state.setRenderedComponent);

  const OptionButton = getComponentById("PR.SESSIONSAPPEL.MENUACTION");
  const DashboardButton = getComponentById("PR.SESSIONSAPPEL.MENUACTION.DASHBOARD");
  const ListButton = getComponentById("PR.SESSIONSAPPEL.MENUACTION.LIST");
  const ParametreButton = getComponentById("PR.SESSIONSAPPEL.MENUACTION.PARAMETRE");
  const AddButton = getComponentById("PR.SESSIONSAPPEL.MENUACTION.ADD");

  return (
    <ERPPage
      title="Sessions d'appel"
      description="Planifier et suivre les sessions d'appel des classes"
      headerActions={[
        <OptionButton
          key="PR.SESSIONSAPPEL.MENUACTION"
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
