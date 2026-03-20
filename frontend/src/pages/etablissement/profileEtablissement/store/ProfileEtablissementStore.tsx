import { create } from "zustand";
import NotFound from "../../../NotFound";
import type { JSX } from "react";
import EtablissementList from "../components/table/EtablissementsTable";
import EtablissementForm from "../components/form/EtablissementForm";
import EtablissementProfileOverview from "../components/dashboard/EtablissementProfileOverview";

type menuItemToComponentType = {
  id: string;
  component: JSX.Element;
  renderState: number;
};

const renderList: menuItemToComponentType[] = [
  {
    id: "dashboard",
    component: <EtablissementProfileOverview />,
    renderState: 0,
  },
  {
    id: "list",
    component: <EtablissementList />,
    renderState: 1,
  },
  {
    id: "parametre",
    component: <EtablissementProfileOverview mode="settings" />,
    renderState: 2,
  },
  {
    id: "add",
    component: <EtablissementForm />,
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

export const useProfileEtablissementStore = create<State>((set) => {
  return {
    menuListIsVisible: false,
    renderedComponent: <EtablissementProfileOverview />,
    renderState: 0,
    setRenderState: (value: number) => set({ renderState: value }),
    setMenuListIsVisible: (value: boolean) => set({ menuListIsVisible: value }),
    setRenderedComponent: (value: string) => {
      const item = renderList.find((entry) => entry.id === value);

      if (item !== undefined) {
        set({
          renderedComponent: item.component,
          renderState: item.renderState,
        });
      } else {
        set({ renderedComponent: <NotFound />, renderState: -1 });
      }
    },
  };
});
