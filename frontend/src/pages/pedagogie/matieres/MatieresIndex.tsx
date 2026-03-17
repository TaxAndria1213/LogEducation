import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import { useEffect, useState, type JSX } from "react";
import NotFound from "../../NotFound";
import { useMatiereStore } from "./store/MatiereIndexStore";

function MatieresIndex() {
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
  const menuListIsVisible = useMatiereStore((s) => s.menuListIsVisible);
  const setMenuListIsVisible = useMatiereStore((s) => s.setMenuListIsVisible);
  const renderState = useMatiereStore((s) => s.renderState);
  const renderedElement = useMatiereStore((s) => s.renderedComponent);
  const setRenderState = useMatiereStore((s) => s.setRenderState);
  const setRenderedComponent = useMatiereStore((s) => s.setRenderedComponent);

  useEffect(() => {
    if (renderedElement) setRender(renderedElement);
  }, [renderedElement]);

  const OptionButton = getComponentById("PD.MATIERES.MENUACTION");
  const ListButtonComponent = getComponentById("PD.MATIERES.MENUACTION.LIST");
  const ParametreButtonComponent = getComponentById(
    "PD.MATIERES.MENUACTION.PARAMETRE",
  );
  const AddButtonComponent = getComponentById("PD.MATIERES.MENUACTION.ADD");
  const DashboardButton = getComponentById("PD.MATIERES.MENUACTION.DASHBOARD");

  return (
    <ERPPage
      title="Matières"
      description="Gérer les matières de l'établissement"
      headerActions={[
        <OptionButton
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
          key={"PD.MATIERES.MENUACTION"}
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
                <ParametreButtonComponent onClick={() => setRenderedComponent("parametre")} />,
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

export default MatieresIndex;


