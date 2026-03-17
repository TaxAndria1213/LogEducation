import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import { useEffect, useState, type JSX } from "react";
import NotFound from "../../NotFound";
import { useBulletinStore } from "./store/BulletinIndexStore";

function BulletinsIndex() {
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
  const menuListIsVisible = useBulletinStore((s) => s.menuListIsVisible);
  const setMenuListIsVisible = useBulletinStore((s) => s.setMenuListIsVisible);
  const renderState = useBulletinStore((s) => s.renderState);
  const renderedElement = useBulletinStore((s) => s.renderedComponent);
  const setRenderState = useBulletinStore((s) => s.setRenderState);
  const setRenderedComponent = useBulletinStore((s) => s.setRenderedComponent);

  useEffect(() => {
    if (renderedElement) setRender(renderedElement);
  }, [renderedElement]);

  const OptionButton = getComponentById("PD.BULLETINS.MENUACTION");
  const ListButtonComponent = getComponentById("PD.BULLETINS.MENUACTION.LIST");
  const ParametreButtonComponent = getComponentById(
    "PD.BULLETINS.MENUACTION.PARAMETRE",
  );
  const AddButtonComponent = getComponentById("PD.BULLETINS.MENUACTION.ADD");
  const DashboardButton = getComponentById("PD.BULLETINS.MENUACTION.DASHBOARD");

  return (
    <ERPPage
      title="Bulletins"
      description="Gérer les bulletins"
      headerActions={[
        <OptionButton
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
          key={"PD.BULLETINS.MENUACTION"}
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

export default BulletinsIndex;


