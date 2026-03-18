import { useEffect, useState, type JSX } from "react";
import ERPPage from "../../components/page/ERPPage";
import { getComponentById } from "../../components/components.build";
import ListContainer from "../../components/sidebar/ListContainer";
import NotFound from "../NotFound";
import { useEmploiDuTempsStore } from "./store/EmploiDuTempsIndexStore";

function EmploiDuTempsIndex() {
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
  const menuListIsVisible = useEmploiDuTempsStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = useEmploiDuTempsStore((state) => state.setMenuListIsVisible);
  const renderState = useEmploiDuTempsStore((state) => state.renderState);
  const renderedComponent = useEmploiDuTempsStore((state) => state.renderedComponent);
  const setRenderState = useEmploiDuTempsStore((state) => state.setRenderState);
  const setRenderedComponent = useEmploiDuTempsStore((state) => state.setRenderedComponent);

  useEffect(() => {
    if (renderedComponent) setRender(renderedComponent);
  }, [renderedComponent]);

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

export default EmploiDuTempsIndex;
