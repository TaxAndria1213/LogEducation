import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import { useJustificatifStore } from "./store/JustificatifIndexStore";

export default function JustificatifsIndex() {
  const menuListIsVisible = useJustificatifStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = useJustificatifStore((state) => state.setMenuListIsVisible);
  const renderState = useJustificatifStore((state) => state.renderState);
  const renderedComponent = useJustificatifStore((state) => state.renderedComponent);
  const setRenderState = useJustificatifStore((state) => state.setRenderState);
  const setRenderedComponent = useJustificatifStore((state) => state.setRenderedComponent);
  const OptionButton = getComponentById("PR.JUSTIFICATIFS.MENUACTION");
  const DashboardButton = getComponentById("PR.JUSTIFICATIFS.MENUACTION.DASHBOARD");
  const ListButton = getComponentById("PR.JUSTIFICATIFS.MENUACTION.LIST");
  const ParametreButton = getComponentById("PR.JUSTIFICATIFS.MENUACTION.PARAMETRE");
  const AddButton = getComponentById("PR.JUSTIFICATIFS.MENUACTION.ADD");
  return <ERPPage title="Justificatifs d'absence" description="Suivre et traiter les justificatifs eleves" headerActions={[<OptionButton key="PR.JUSTIFICATIFS.MENUACTION" onClick={() => setMenuListIsVisible(!menuListIsVisible)} />]}><div className="flex items-start gap-4"><div className="min-w-0 flex-1">{renderedComponent}</div><PageSidebarPopup open={menuListIsVisible} onClose={() => setMenuListIsVisible(false)}><ListContainer onItemClick={() => setMenuListIsVisible(false)} selected={renderState} setSelected={setRenderState} components={[<DashboardButton onClick={() => setRenderedComponent("dashboard")} />,<ListButton onClick={() => setRenderedComponent("list")} />,<ParametreButton onClick={() => setRenderedComponent("parametre")} />,<AddButton onClick={() => setRenderedComponent("add")} />]} /></PageSidebarPopup></div></ERPPage>;
}
