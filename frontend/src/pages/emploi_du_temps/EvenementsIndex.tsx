import ERPPage from "../../components/page/ERPPage";
import { getComponentById } from "../../components/components.build";
import ListContainer from "../../components/sidebar/ListContainer";
import { useEvenementStore } from "./store/EvenementIndexStore";

function EvenementsIndex() {
  const menuListIsVisible = useEvenementStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = useEvenementStore(
    (state) => state.setMenuListIsVisible,
  );
  const renderState = useEvenementStore((state) => state.renderState);
  const renderedComponent = useEvenementStore((state) => state.renderedComponent);
  const setRenderState = useEvenementStore((state) => state.setRenderState);
  const setRenderedComponent = useEvenementStore(
    (state) => state.setRenderedComponent,
  );

  const OptionButton = getComponentById("EDT.EVENEMENTS.MENUACTION");
  const ListButtonComponent = getComponentById("EDT.EVENEMENTS.MENUACTION.LIST");
  const ParametreButtonComponent = getComponentById(
    "EDT.EVENEMENTS.MENUACTION.PARAMETRE",
  );
  const AddButtonComponent = getComponentById("EDT.EVENEMENTS.MENUACTION.ADD");
  const DashboardButton = getComponentById("EDT.EVENEMENTS.MENUACTION.DASHBOARD");

  return (
    <ERPPage
      title="Evenements"
      description="Gerer le calendrier et les temps forts de l'etablissement"
      headerActions={[
        <OptionButton
          key="EDT.EVENEMENTS.MENUACTION"
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
        />,
      ]}
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">{renderedComponent}</div>
        {menuListIsVisible ? (
          <div className="w-52 shrink-0 border-l border-slate-200 pl-4">
            <ListContainer
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
          </div>
        ) : null}
      </div>
    </ERPPage>
  );
}

export default EvenementsIndex;
