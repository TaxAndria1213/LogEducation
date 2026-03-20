import { create } from "zustand";
import NotFound from "../../../NotFound";
import type { JSX } from "react";
import ClasseList from "../components/table/ClasseTable";
import ClasseForm from "../components/form/ClasseForm";
import ClasseOverview from "../components/dashboard/ClasseOverview";

type MenuItemToComponent = {
  id: string;
  component: JSX.Element;
  renderState: number;
};

const renderList: MenuItemToComponent[] = [
  {
    id: "dashboard",
    component: <ClasseOverview />,
    renderState: 0,
  },
  {
    id: "add",
    component: <ClasseForm />,
    renderState: 3,
  },
  {
    id: "list",
    component: <ClasseList />,
    renderState: 1,
  },
  {
    id: "parametre",
    component: <ClasseOverview mode="settings" />,
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

export const useClasseStore = create<State>((set) => {
  return {
    menuListIsVisible: false,
    renderedComponent: <ClasseOverview />,
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
