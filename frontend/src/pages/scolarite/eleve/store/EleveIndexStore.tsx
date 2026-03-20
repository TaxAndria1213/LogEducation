import { create } from "zustand";
import NotFound from "../../../NotFound";
import type { JSX } from "react";
import EleveList from "../components/table/EleveTable";
import EleveForm from "../components/form/EleveForm";
import EleveOverview from "../components/dashboard/EleveOverview";

type MenuItemToComponent = {
  id: string;
  component: JSX.Element;
  renderState: number;
};

const renderList: MenuItemToComponent[] = [
  {
    id: "dashboard",
    component: <EleveOverview />,
    renderState: 0,
  },
  {
    id: "list",
    component: <EleveList />,
    renderState: 1,
  },
  {
    id: "parametre",
    component: <EleveOverview mode="settings" />,
    renderState: 2,
  },
  {
    id: "add",
    component: <EleveForm />,
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

export const useEleveStore = create<State>((set) => {
  return {
    menuListIsVisible: false,
    renderedComponent: <EleveOverview />,
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
