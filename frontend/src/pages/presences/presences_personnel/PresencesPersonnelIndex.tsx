import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import { usePresencePersonnelStore } from "./store/PresencePersonnelIndexStore";

export default function PresencesPersonnelIndex() {
  const menuListIsVisible = usePresencePersonnelStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = usePresencePersonnelStore((state) => state.setMenuListIsVisible);
  const renderState = usePresencePersonnelStore((state) => state.renderState);
  const renderedComponent = usePresencePersonnelStore((state) => state.renderedComponent);
  const setRenderState = usePresencePersonnelStore((state) => state.setRenderState);
  const setRenderedComponent = usePresencePersonnelStore((state) => state.setRenderedComponent);
  const OptionButton = getComponentById("PR.PRESENCESPERSONNEL.MENUACTION");
  const DashboardButton = getComponentById("PR.PRESENCESPERSONNEL.MENUACTION.DASHBOARD");
  const ListButton = getComponentById("PR.PRESENCESPERSONNEL.MENUACTION.LIST");
  const ParametreButton = getComponentById("PR.PRESENCESPERSONNEL.MENUACTION.PARAMETRE");
  const AddButton = getComponentById("PR.PRESENCESPERSONNEL.MENUACTION.ADD");
  return <ERPPage title="Presences personnel" description="Suivre les presences quotidiennes du personnel" headerActions={[<OptionButton key="PR.PRESENCESPERSONNEL.MENUACTION" onClick={() => setMenuListIsVisible(!menuListIsVisible)} />]}><div className="flex items-start gap-4"><div className="min-w-0 flex-1">{renderedComponent}</div><PageSidebarPopup open={menuListIsVisible} onClose={() => setMenuListIsVisible(false)}><ListContainer onItemClick={() => setMenuListIsVisible(false)} selected={renderState} setSelected={setRenderState} components={[<DashboardButton onClick={() => setRenderedComponent("dashboard")} />,<ListButton onClick={() => setRenderedComponent("list")} />,<ParametreButton onClick={() => setRenderedComponent("parametre")} />,<AddButton onClick={() => setRenderedComponent("add")} />]} /></PageSidebarPopup></div></ERPPage>;
}
