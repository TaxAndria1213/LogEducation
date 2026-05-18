import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import { useEffect, useState, type JSX } from "react";
import PreloadPage from "../../PreloadPage";
import { useTypeEvaluationRefStore } from "./store/TypeEvaluationRefIndexStore";

function TypesEvaluationsIndex() {
  const [render, setRender] = useState<JSX.Element>(<PreloadPage />);
  const menuListIsVisible = useTypeEvaluationRefStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = useTypeEvaluationRefStore(
    (state) => state.setMenuListIsVisible,
  );
  const renderState = useTypeEvaluationRefStore((state) => state.renderState);
  const renderedElement = useTypeEvaluationRefStore((state) => state.renderedComponent);
  const setRenderState = useTypeEvaluationRefStore((state) => state.setRenderState);
  const setRenderedComponent = useTypeEvaluationRefStore(
    (state) => state.setRenderedComponent,
  );

  useEffect(() => {
    if (renderedElement) setRender(renderedElement);
  }, [renderedElement]);

  const OptionButton = getComponentById("PD.TYPESEVALUATIONS.MENUACTION");
  const ListButtonComponent = getComponentById(
    "PD.TYPESEVALUATIONS.MENUACTION.LIST",
  );
  const ParametreButtonComponent = getComponentById(
    "PD.TYPESEVALUATIONS.MENUACTION.PARAMETRE",
  );
  const AddButtonComponent = getComponentById("PD.TYPESEVALUATIONS.MENUACTION.ADD");
  const DashboardButton = getComponentById(
    "PD.TYPESEVALUATIONS.MENUACTION.DASHBOARD",
  );

  return (
    <ERPPage
      title="Types d'evaluation"
      description="Gerer les types d'evaluation et leurs regles par defaut"
      headerActions={[
        <OptionButton
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
          key={"PD.TYPESEVALUATIONS.MENUACTION"}
        />,
      ]}
    >
      <div className="flex">
        <div className="flex-1">{render}</div>
        <PageSidebarPopup
          open={menuListIsVisible}
          onClose={() => setMenuListIsVisible(false)}
        >
          <ListContainer
            onItemClick={() => setMenuListIsVisible(false)}
            selected={renderState}
            setSelected={setRenderState}
            components={[
              <DashboardButton onClick={() => setRenderedComponent("dashboard")} />,
              <ListButtonComponent onClick={() => setRenderedComponent("list")} />,
              <ParametreButtonComponent onClick={() => setRenderedComponent("parametre")} />,
              <AddButtonComponent onClick={() => setRenderedComponent("add")} />,
            ]}
          />
        </PageSidebarPopup>
      </div>
    </ERPPage>
  );
}

export default TypesEvaluationsIndex;
