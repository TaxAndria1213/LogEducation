import { create } from "zustand";
import NotFound from "../../../NotFound";
import type { JSX } from "react";
import ParentTuteurList from "../components/table/ParentTuteurTable";
import ParentTuteurForm from "../components/form/ParentTuteurForm";
import ParentTuteurOverview from "../components/dashboard/ParentTuteurOverview";

type MenuItemToComponent = {
  id: string;
  component: JSX.Element;
  renderState: number;
};

const renderList: MenuItemToComponent[] = [
  {
    id: "dashboard",
    component: <ParentTuteurOverview />,
    renderState: 0,
  },
  {
    id: "add",
    component: <ParentTuteurForm />,
    renderState: 3,
  },
  {
    id: "list",
    component: <ParentTuteurList />,
    renderState: 1,
  },
  {
    id: "parametre",
    component: <ParentTuteurOverview mode="settings" />,
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

export const useParentTuteurStore = create<State>((set) => {
  return {
    menuListIsVisible: false,
    renderedComponent: <ParentTuteurOverview />,
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
