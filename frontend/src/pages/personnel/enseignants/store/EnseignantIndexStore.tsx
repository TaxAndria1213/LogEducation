import { create } from "zustand";
import NotFound from "../../../NotFound";
import type { JSX } from "react";
import EnseignantList from "../components/table/EnseignantsTable";
import EnseignantForm from "../components/form/EnseignantForm";
import EnseignantOverview from "../components/dashboard/EnseignantOverview";

type MenuItemToComponent = {
  id: string;
  component: JSX.Element;
  renderState: number;
};

const renderList: MenuItemToComponent[] = [
  {
    id: "dashboard",
    component: <EnseignantOverview />,
    renderState: 0,
  },
  {
    id: "add",
    component: <EnseignantForm />,
    renderState: 3,
  },
  {
    id: "list",
    component: <EnseignantList />,
    renderState: 1,
  },
  {
    id: "parametre",
    component: <EnseignantOverview mode="settings" />,
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

export const useEnseignantStore = create<State>((set) => {
  return {
    menuListIsVisible: false,
    renderedComponent: <EnseignantOverview />,
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
