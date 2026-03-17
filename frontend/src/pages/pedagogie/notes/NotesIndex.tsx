import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import { useEffect, useState, type JSX } from "react";
import NotFound from "../../NotFound";
import { useNoteStore } from "./store/NoteIndexStore";

function NotesIndex() {
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
  const menuListIsVisible = useNoteStore((s) => s.menuListIsVisible);
  const setMenuListIsVisible = useNoteStore((s) => s.setMenuListIsVisible);
  const renderState = useNoteStore((s) => s.renderState);
  const renderedElement = useNoteStore((s) => s.renderedComponent);
  const setRenderState = useNoteStore((s) => s.setRenderState);
  const setRenderedComponent = useNoteStore((s) => s.setRenderedComponent);

  useEffect(() => {
    if (renderedElement) setRender(renderedElement);
  }, [renderedElement]);

  const OptionButton = getComponentById("PD.NOTES.MENUACTION");
  const ListButtonComponent = getComponentById("PD.NOTES.MENUACTION.LIST");
  const ParametreButtonComponent = getComponentById(
    "PD.NOTES.MENUACTION.PARAMETRE",
  );
  const AddButtonComponent = getComponentById("PD.NOTES.MENUACTION.ADD");
  const DashboardButton = getComponentById("PD.NOTES.MENUACTION.DASHBOARD");

  return (
    <ERPPage
      title="Notes"
      description="Gérer les notes"
      headerActions={[
        <OptionButton
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
          key={"PD.NOTES.MENUACTION"}
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

export default NotesIndex;


