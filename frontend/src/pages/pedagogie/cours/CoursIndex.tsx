import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import { useEffect, useState, type JSX } from "react";
import NotFound from "../../NotFound";
import { useCoursStore } from "./store/CoursIndexStore";

function CoursIndex() {
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
  const menuListIsVisible = useCoursStore((s) => s.menuListIsVisible);
  const setMenuListIsVisible = useCoursStore((s) => s.setMenuListIsVisible);
  const renderState = useCoursStore((s) => s.renderState);
  const renderedElement = useCoursStore((s) => s.renderedComponent);
  const setRenderState = useCoursStore((s) => s.setRenderState);
  const setRenderedComponent = useCoursStore((s) => s.setRenderedComponent);

  useEffect(() => {
    if (renderedElement) setRender(renderedElement);
  }, [renderedElement]);

  const OptionButton = getComponentById("PD.COURS.MENUACTION");
  const ListButtonComponent = getComponentById("PD.COURS.MENUACTION.LIST");
  const ParametreButtonComponent = getComponentById(
    "PD.COURS.MENUACTION.PARAMETRE",
  );
  const AddButtonComponent = getComponentById("PD.COURS.MENUACTION.ADD");
  const DashboardButton = getComponentById("PD.COURS.MENUACTION.DASHBOARD");

  return (
    <ERPPage
      title="Cours"
      description="Gérer les cours"
      headerActions={[
        <OptionButton
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
          key={"PD.COURS.MENUACTION"}
        />,
      ]}
    >
      <div className="flex">
        <div className="flex-1">{render}</div>
        <PageSidebarPopup open={menuListIsVisible} onClose={() => setMenuListIsVisible(false)}>
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

export default CoursIndex;


