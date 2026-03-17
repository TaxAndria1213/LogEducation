import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import { useEffect, useState, type JSX } from "react";
import NotFound from "../../NotFound";
import { useRegleNoteStore } from "./store/RegleNoteIndexStore";

function ReglesNotesIndex() {
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
  const menuListIsVisible = useRegleNoteStore((s) => s.menuListIsVisible);
  const setMenuListIsVisible = useRegleNoteStore((s) => s.setMenuListIsVisible);
  const renderState = useRegleNoteStore((s) => s.renderState);
  const renderedElement = useRegleNoteStore((s) => s.renderedComponent);
  const setRenderState = useRegleNoteStore((s) => s.setRenderState);
  const setRenderedComponent = useRegleNoteStore((s) => s.setRenderedComponent);

  useEffect(() => {
    if (renderedElement) setRender(renderedElement);
  }, [renderedElement]);

  const OptionButton = getComponentById("PD.REGLESNOTES.MENUACTION");
  const ListButtonComponent = getComponentById("PD.REGLESNOTES.MENUACTION.LIST");
  const ParametreButtonComponent = getComponentById(
    "PD.REGLESNOTES.MENUACTION.PARAMETRE",
  );
  const AddButtonComponent = getComponentById("PD.REGLESNOTES.MENUACTION.ADD");
  const DashboardButton = getComponentById(
    "PD.REGLESNOTES.MENUACTION.DASHBOARD",
  );

  return (
    <ERPPage
      title="Règles de notes"
      description="Gérer les règles de notation"
      headerActions={[
        <OptionButton
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
          key={"PD.REGLESNOTES.MENUACTION"}
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

export default ReglesNotesIndex;


