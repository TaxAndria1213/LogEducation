import { create } from "zustand";
import NotFound from "../../../NotFound";
import type { JSX } from "react";
import NiveauList from "../components/table/NiveauTable";
import NiveauForm from "../components/form/NiveauForm";
import NiveauOverview from "../components/dashboard/NiveauOverview";

type MenuItemToComponent = {
  id: string;
  component: JSX.Element;
  renderState: number;
};

const renderList: MenuItemToComponent[] = [
  {
    id: "dashboard",
    component: <NiveauOverview />,
    renderState: 0,
  },
  {
    id: "add",
    component: <NiveauForm />,
    renderState: 3,
  },
  {
    id: "list",
    component: <NiveauList />,
    renderState: 1,
  },
  {
    id: "parametre",
    component: <NiveauOverview mode="settings" />,
    renderState: 2,
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

export const useNiveauStore = create<State>((set) => {
  return {
    menuListIsVisible: false,
    renderedComponent: <NiveauOverview />,
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
