import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import { useEffect, useState, type JSX } from "react";
import NotFound from "../../NotFound";
import { useEvaluationStore } from "./store/EvaluationIndexStore";

function EvaluationsIndex() {
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
  const menuListIsVisible = useEvaluationStore((s) => s.menuListIsVisible);
  const setMenuListIsVisible = useEvaluationStore((s) => s.setMenuListIsVisible);
  const renderState = useEvaluationStore((s) => s.renderState);
  const renderedElement = useEvaluationStore((s) => s.renderedComponent);
  const setRenderState = useEvaluationStore((s) => s.setRenderState);
  const setRenderedComponent = useEvaluationStore((s) => s.setRenderedComponent);

  useEffect(() => {
    if (renderedElement) setRender(renderedElement);
  }, [renderedElement]);

  const OptionButton = getComponentById("PD.EVALUATIONS.MENUACTION");
  const ListButtonComponent = getComponentById("PD.EVALUATIONS.MENUACTION.LIST");
  const ParametreButtonComponent = getComponentById(
    "PD.EVALUATIONS.MENUACTION.PARAMETRE",
  );
  const AddButtonComponent = getComponentById("PD.EVALUATIONS.MENUACTION.ADD");
  const DashboardButton = getComponentById(
    "PD.EVALUATIONS.MENUACTION.DASHBOARD",
  );

  return (
    <ERPPage
      title="Evaluations"
      description="Gérer les évaluations"
      headerActions={[
        <OptionButton
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
          key={"PD.EVALUATIONS.MENUACTION"}
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

export default EvaluationsIndex;


