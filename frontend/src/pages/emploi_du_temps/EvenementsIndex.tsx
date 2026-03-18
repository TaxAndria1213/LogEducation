import { useEffect, useState, type JSX } from "react";
import ERPPage from "../../components/page/ERPPage";
import { getComponentById } from "../../components/components.build";
import ListContainer from "../../components/sidebar/ListContainer";
import NotFound from "../NotFound";
import { useEvenementStore } from "./store/EvenementIndexStore";

function EvenementsIndex() {
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
  const menuListIsVisible = useEvenementStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = useEvenementStore((state) => state.setMenuListIsVisible);
  const renderState = useEvenementStore((state) => state.renderState);
  const renderedComponent = useEvenementStore((state) => state.renderedComponent);
  const setRenderState = useEvenementStore((state) => state.setRenderState);
  const setRenderedComponent = useEvenementStore((state) => state.setRenderedComponent);

  useEffect(() => {
    if (renderedComponent) setRender(renderedComponent);
  }, [renderedComponent]);

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
      description="Gerer le calendrier de l'etablissement"
      headerActions={[
        <OptionButton
          key="EDT.EVENEMENTS.MENUACTION"
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
        />,
      ]}
    >
      <div className="flex">
        <div className="flex-1">{render}</div>
        {menuListIsVisible ? (
          <div className="border-l border-slate-200 pl-4 ml-4">
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
        ) : (
          <div className="none"></div>
        )}
      </div>
    </ERPPage>
  );
}

export default EvenementsIndex;
