import { create } from "zustand";
import NotFound from "../../../NotFound";
import type { JSX } from "react";
import IdentifiantEleveList from "../components/table/IdEleveTable";
import IdentifiantEleveForm from "../components/form/IdEleveForm";
import IdentifiantEleveOverview from "../components/dashboard/IdentifiantEleveOverview";

type MenuItemToComponent = {
  id: string;
  component: JSX.Element;
  renderState: number;
};

const renderList: MenuItemToComponent[] = [
  {
    id: "dashboard",
    component: <IdentifiantEleveOverview />,
    renderState: 0,
  },
  {
    id: "add",
    component: <IdentifiantEleveForm />,
    renderState: 3,
  },
  {
    id: "list",
    component: <IdentifiantEleveList />,
    renderState: 1,
  },
  {
    id: "parametre",
    component: <IdentifiantEleveOverview mode="settings" />,
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

export const useIdentifiantEleveStore = create<State>((set) => {
  return {
    menuListIsVisible: false,
    renderedComponent: <IdentifiantEleveOverview />,
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
