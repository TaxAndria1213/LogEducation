import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import { useProfileEtablissementStore } from "./store/ProfileEtablissementStore";
import { useEffect, useState, type JSX } from "react";
import NotFound from "../../NotFound";

function ProfileEtablissementIndex() {
  //states
  const [render, setRender] = useState<JSX.Element>(<NotFound />);

  const menuListIsVisible = useProfileEtablissementStore(
    (state) => state.menuListIsVisible,
  );
  const setMenuListIsVisible = useProfileEtablissementStore(
    (state) => state.setMenuListIsVisible,
  );

  const renderState = useProfileEtablissementStore(
    (state) => state.renderState,
  );
  const renderedElement = useProfileEtablissementStore(
    (state) => state.renderedComponent,
  );

  const setRenderState = useProfileEtablissementStore(
    (state) => state.setRenderState,
  );
  const setRenderedComponent = useProfileEtablissementStore(
    (state) => state.setRenderedComponent,
  );

  useEffect(() => {
    if (renderedElement) {
      setRender(renderedElement);
    }
  }, [renderedElement]);

  //composants
  const OptionButton = getComponentById("ET.PROFILE.MENUACTION");
  const ListButtonComponent = getComponentById("ET.PROFILE.MENUACTION.LIST");
  const ParametreButtonComponent = getComponentById(
    "ET.PROFILE.MENUACTION.PARAMETRE",
  );
  const AddButtonComponent = getComponentById("ET.PROFILE.MENUACTION.ADD");
  const DashboardButton = getComponentById("ET.PROFILE.MENUACTION.DASHBOARD");

  return (
    <ERPPage
      title="Profil de l'etablissement"
      description="Informations et parametres de l'etablissement rattache a l'utilisateur"
      headerActions={[
        <OptionButton
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
          key={"ET.PROFILE.MENUACTION"}
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
                <DashboardButton
                  onClick={() => setRenderedComponent("dashboard")}
                />,
                <ListButtonComponent
                  onClick={() => setRenderedComponent("list")}
                />,
                <ParametreButtonComponent
                  onClick={() => setRenderedComponent("parametre")}
                />,
                <AddButtonComponent
                  onClick={() => {
                    setRenderedComponent("add");
                  }}
                />,
              ]}
            />
          </PageSidebarPopup>
      </div>
    </ERPPage>
  );
}

export default ProfileEtablissementIndex;
