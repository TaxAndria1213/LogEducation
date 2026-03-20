import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import { usePresenceEleveStore } from "./store/PresenceEleveIndexStore";

export default function PresencesElevesIndex() {
  const menuListIsVisible = usePresenceEleveStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = usePresenceEleveStore((state) => state.setMenuListIsVisible);
  const renderState = usePresenceEleveStore((state) => state.renderState);
  const renderedComponent = usePresenceEleveStore((state) => state.renderedComponent);
  const setRenderState = usePresenceEleveStore((state) => state.setRenderState);
  const setRenderedComponent = usePresenceEleveStore((state) => state.setRenderedComponent);
  const OptionButton = getComponentById("PR.PRESENCESELEVES.MENUACTION");
  const DashboardButton = getComponentById("PR.PRESENCESELEVES.MENUACTION.DASHBOARD");
  const ListButton = getComponentById("PR.PRESENCESELEVES.MENUACTION.LIST");
  const ParametreButton = getComponentById("PR.PRESENCESELEVES.MENUACTION.PARAMETRE");
  const AddButton = getComponentById("PR.PRESENCESELEVES.MENUACTION.ADD");
  return (
    <ERPPage title="Presences eleves" description="Suivre les statuts de presence des eleves" headerActions={[<OptionButton key="PR.PRESENCESELEVES.MENUACTION" onClick={() => setMenuListIsVisible(!menuListIsVisible)} />]}>
      <div className="flex items-start gap-4"><div className="min-w-0 flex-1">{renderedComponent}</div><PageSidebarPopup open={menuListIsVisible} onClose={() => setMenuListIsVisible(false)}><ListContainer onItemClick={() => setMenuListIsVisible(false)} selected={renderState} setSelected={setRenderState} components={[<DashboardButton onClick={() => setRenderedComponent("dashboard")} />,<ListButton onClick={() => setRenderedComponent("list")} />,<ParametreButton onClick={() => setRenderedComponent("parametre")} />,<AddButton onClick={() => setRenderedComponent("add")} />]} /></PageSidebarPopup></div>
    </ERPPage>
  );
}
