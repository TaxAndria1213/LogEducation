import type { JSX } from "react";
import { create } from "zustand";
import NotFound from "../../../NotFound";
import InitialisationEtablissementOverview from "../components/dashboard/InitialisationEtablissementOverview";
import InitialisationTemplateSettings from "../components/settings/InitialisationTemplateSettings";
import InitialisationSessionTable from "../components/table/InitialisationSessionTable";

type MenuItemToComponentType = {
  id: string;
  component: JSX.Element;
  renderState: number;
};

const renderList: MenuItemToComponentType[] = [
  {
    id: "dashboard",
    component: <InitialisationEtablissementOverview />,
    renderState: 0,
  },
  {
    id: "list",
    component: <InitialisationSessionTable />,
    renderState: 1,
  },
  {
    id: "parametre",
    component: <InitialisationTemplateSettings />,
    renderState: 2,
  },
  {
    id: "add",
    component: <InitialisationEtablissementOverview autoOpenInitialWizard />,
    renderState: 3,
  },
];

type State = {
  menuListIsVisible: boolean;
  renderedComponent: JSX.Element;
  renderState: number;
  setRenderState: (value: number) => void;
  setMenuListIsVisible: (value: boolean) => void;
  setRenderedComponent: (value: string) => void;
};

export const useInitialisationEtablissementStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <InitialisationEtablissementOverview />,
  renderState: 0,
  setRenderState: (value) => set({ renderState: value }),
  setMenuListIsVisible: (value) => set({ menuListIsVisible: value }),
  setRenderedComponent: (value) => {
    const item = renderList.find((entry) => entry.id === value);

    if (item) {
      set({
        renderedComponent: item.component,
        renderState: item.renderState,
      });
      return;
    }

    set({ renderedComponent: <NotFound />, renderState: -1 });
  },
}));
