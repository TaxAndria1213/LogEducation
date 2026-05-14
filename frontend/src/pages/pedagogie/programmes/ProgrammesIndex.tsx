import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import { useProgrammeStore } from "./store/ProgrammeIndexStore";
import { useProgrammeCreateStore } from "./store/ProgrammeCreateStore";

function ProgrammesIndex() {
  const menuListIsVisible = useProgrammeStore((s) => s.menuListIsVisible);
  const setMenuListIsVisible = useProgrammeStore((s) => s.setMenuListIsVisible);
  const renderState = useProgrammeStore((s) => s.renderState);
  const renderedElement = useProgrammeStore((s) => s.renderedComponent);
  const setRenderState = useProgrammeStore((s) => s.setRenderState);
  const setRenderedComponent = useProgrammeStore((s) => s.setRenderedComponent);
  const clearInitialData = useProgrammeCreateStore((s) => s.clearInitialData);

  const OptionButton = getComponentById("PD.PROGRAMMES.MENUACTION");
  const ListButtonComponent = getComponentById("PD.PROGRAMMES.MENUACTION.LIST");
  const ParametreButtonComponent = getComponentById(
    "PD.PROGRAMMES.MENUACTION.PARAMETRE",
  );
  const AddButtonComponent = getComponentById("PD.PROGRAMMES.MENUACTION.ADD");
  const DashboardButton = getComponentById(
    "PD.PROGRAMMES.MENUACTION.DASHBOARD",
  );

  return (
    <ERPPage
      title="Programmes"
      description="Gérer les programmes pédagogiques"
      headerActions={[
        <OptionButton
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
          key={"PD.PROGRAMMES.MENUACTION"}
        />,
      ]}
    >
      <div className="flex">
        <div className="flex-1">{renderedElement}</div>
        <PageSidebarPopup open={menuListIsVisible} onClose={() => setMenuListIsVisible(false)}>
            <ListContainer
              onItemClick={() => setMenuListIsVisible(false)}
              selected={renderState}
              setSelected={setRenderState}
              components={[
                <DashboardButton onClick={() => setRenderedComponent("dashboard")} />,
                <ListButtonComponent onClick={() => setRenderedComponent("list")} />,
                <ParametreButtonComponent onClick={() => setRenderedComponent("parametre")} />,
                <AddButtonComponent
                  onClick={() => {
                    clearInitialData();
                    setRenderedComponent("add");
                  }}
                />,
              ]}
            />
          </PageSidebarPopup>
      </div>
    </ERPPage>
  );
}

export default ProgrammesIndex;
