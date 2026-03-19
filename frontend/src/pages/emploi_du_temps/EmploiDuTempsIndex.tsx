import ERPPage from "../../components/page/ERPPage";
import { getComponentById } from "../../components/components.build";
import ListContainer from "../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../components/sidebar/PageSidebarPopup";
import { useEmploiDuTempsStore } from "./store/EmploiDuTempsIndexStore";

function EmploiDuTempsIndex() {
  const menuListIsVisible = useEmploiDuTempsStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = useEmploiDuTempsStore((state) => state.setMenuListIsVisible);
  const renderState = useEmploiDuTempsStore((state) => state.renderState);
  const renderedComponent = useEmploiDuTempsStore((state) => state.renderedComponent);
  const setRenderState = useEmploiDuTempsStore((state) => state.setRenderState);
  const setRenderedComponent = useEmploiDuTempsStore((state) => state.setRenderedComponent);

  const OptionButton = getComponentById("EDT.EMPLOIDUTEMPS.MENUACTION");
  const ListButtonComponent = getComponentById("EDT.EMPLOIDUTEMPS.MENUACTION.LIST");
  const ParametreButtonComponent = getComponentById(
    "EDT.EMPLOIDUTEMPS.MENUACTION.PARAMETRE",
  );
  const AddButtonComponent = getComponentById("EDT.EMPLOIDUTEMPS.MENUACTION.ADD");
  const DashboardButton = getComponentById(
    "EDT.EMPLOIDUTEMPS.MENUACTION.DASHBOARD",
  );

  return (
    <ERPPage
      title="Emploi du temps"
      description="Gerer les lignes d'emploi du temps"
      headerActions={[
        <OptionButton
          key="EDT.EMPLOIDUTEMPS.MENUACTION"
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
                <ListButtonComponent onClick={() => setRenderedComponent("list")} />,
                <ParametreButtonComponent
                  onClick={() => setRenderedComponent("parametre")}
                />,
                <AddButtonComponent onClick={() => setRenderedComponent("add")} />,
              ]}
            />
          </PageSidebarPopup>
      </div>
    </ERPPage>
  );
}

export default EmploiDuTempsIndex;
