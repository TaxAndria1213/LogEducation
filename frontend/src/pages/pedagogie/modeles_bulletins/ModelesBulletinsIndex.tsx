import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import { useEffect, useState, type JSX } from "react";
import NotFound from "../../NotFound";
import { useReportCardTemplateStore } from "./store/ReportCardTemplateIndexStore";

function ModelesBulletinsIndex() {
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
  const menuListIsVisible = useReportCardTemplateStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = useReportCardTemplateStore(
    (state) => state.setMenuListIsVisible,
  );
  const renderState = useReportCardTemplateStore((state) => state.renderState);
  const renderedElement = useReportCardTemplateStore((state) => state.renderedComponent);
  const setRenderState = useReportCardTemplateStore((state) => state.setRenderState);
  const setRenderedComponent = useReportCardTemplateStore(
    (state) => state.setRenderedComponent,
  );

  useEffect(() => {
    if (renderedElement) setRender(renderedElement);
  }, [renderedElement]);

  const OptionButton = getComponentById("PD.MODELESBULLETINS.MENUACTION");
  const ListButtonComponent = getComponentById(
    "PD.MODELESBULLETINS.MENUACTION.LIST",
  );
  const ParametreButtonComponent = getComponentById(
    "PD.MODELESBULLETINS.MENUACTION.PARAMETRE",
  );
  const AddButtonComponent = getComponentById("PD.MODELESBULLETINS.MENUACTION.ADD");
  const DashboardButton = getComponentById(
    "PD.MODELESBULLETINS.MENUACTION.DASHBOARD",
  );

  return (
    <ERPPage
      title="Modeles de bulletin"
      description="Gerer les niveaux de detail affiches dans les bulletins"
      headerActions={[
        <OptionButton
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
          key={"PD.MODELESBULLETINS.MENUACTION"}
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

export default ModelesBulletinsIndex;
