import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import { useRecompenseStore } from "./store/RecompenseIndexStore";

export default function RecompensesIndex() {
  const menuListIsVisible = useRecompenseStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = useRecompenseStore((state) => state.setMenuListIsVisible);
  const renderState = useRecompenseStore((state) => state.renderState);
  const renderedComponent = useRecompenseStore((state) => state.renderedComponent);
  const setRenderState = useRecompenseStore((state) => state.setRenderState);
  const setRenderedComponent = useRecompenseStore((state) => state.setRenderedComponent);
  const OptionButton = getComponentById("DI.RECOMPENSES.MENUACTION");
  const DashboardButton = getComponentById("DI.RECOMPENSES.MENUACTION.DASHBOARD");
  const ListButton = getComponentById("DI.RECOMPENSES.MENUACTION.LIST");
  const ParametreButton = getComponentById("DI.RECOMPENSES.MENUACTION.PARAMETRE");
  const AddButton = getComponentById("DI.RECOMPENSES.MENUACTION.ADD");

  return (
    <ERPPage
      title="Discipline - Recompenses"
      description="Valoriser les comportements positifs et les efforts remarquables."
      headerActions={[
        <OptionButton key="DI.RECOMPENSES.MENUACTION" onClick={() => setMenuListIsVisible(!menuListIsVisible)} />,
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
