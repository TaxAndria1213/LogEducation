import type { JSX } from "react";
import { create } from "zustand";
import NotFound from "../../../NotFound";
import AnneeScolaireOverview from "../components/dashboard/AnneeScolaireOverview";
import AnneeScolaireForm from "../components/form/AnneeScolaireForm";
import AnneeScolaireList from "../components/table/AnneeScolaireTable";

type MenuItemToComponentType = {
  id: string;
  component: JSX.Element;
  renderState: number;
};

const renderList: MenuItemToComponentType[] = [
  {
    id: "dashboard",
    component: <AnneeScolaireOverview />,
    renderState: 0,
  },
  {
    id: "list",
    component: <AnneeScolaireList />,
    renderState: 1,
  },
  {
    id: "parametre",
    component: <AnneeScolaireOverview mode="settings" />,
    renderState: 2,
  },
  {
    id: "add",
    component: <AnneeScolaireForm />,
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

export const useAnneeScolaireStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <AnneeScolaireOverview />,
  renderState: 0,
  setRenderState: (value: number) => set({ renderState: value }),
  setMenuListIsVisible: (value: boolean) => set({ menuListIsVisible: value }),
  setRenderedComponent: (value: string) => {
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
