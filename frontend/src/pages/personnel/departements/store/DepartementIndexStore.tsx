import { create } from "zustand";
import NotFound from "../../../NotFound";
import type { JSX } from "react";
import DepartementList from "../components/table/DepartementTable";
import DepartementForm from "../components/form/DepartementForm";
import DepartementOverview from "../components/dashboard/DepartementOverview";

type MenuItemToComponent = {
  id: string;
  component: JSX.Element;
  renderState: number;
};

const renderList: MenuItemToComponent[] = [
  {
    id: "dashboard",
    component: <DepartementOverview />,
    renderState: 0,
  },
  {
    id: "add",
    component: <DepartementForm />,
    renderState: 3,
  },
  {
    id: "list",
    component: <DepartementList />,
    renderState: 1,
  },
  {
    id: "parametre",
    component: <DepartementOverview mode="settings" />,
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

export const useDepartementStore = create<State>((set) => {
  return {
    menuListIsVisible: false,
    renderedComponent: <DepartementOverview />,
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
