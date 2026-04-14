import { create } from "zustand";
import type { JSX } from "react";
import EtablissementProfileOverview from "../components/dashboard/EtablissementProfileOverview";

type MenuItemToComponent = {
  id: string;
  component: JSX.Element;
  renderState: number;
};

const renderList: MenuItemToComponent[] = [
  {
    id: "dashboard",
    component: <EtablissementProfileOverview />,
    renderState: 0,
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

export const useProfileEtablissementStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <EtablissementProfileOverview />,
  renderState: 0,
  setRenderState: (value: number) => set({ renderState: value }),
  setMenuListIsVisible: (value: boolean) => set({ menuListIsVisible: value }),
  setRenderedComponent: (value: string) => {
    const item = renderList.find((entry) => entry.id === value) ?? renderList[0];

    set({
      renderedComponent: item.component,
      renderState: item.renderState,
    });
  },
}));
