import type { JSX } from "react";
import { create } from "zustand";
import NotFound from "../../../NotFound";
import SallesOverview from "../components/dashboard/SallesOverview";
import SalleForm from "../components/form/SalleForm";
import SalleList from "../components/table/SalleTable";

type MenuItemToComponentType = {
  id: string;
  component: JSX.Element;
  renderState: number;
};

const renderList: MenuItemToComponentType[] = [
  {
    id: "dashboard",
    component: <SallesOverview />,
    renderState: 0,
  },
  {
    id: "list",
    component: <SalleList />,
    renderState: 1,
  },
  {
    id: "parametre",
    component: <SallesOverview mode="settings" />,
    renderState: 2,
  },
  {
    id: "add",
    component: <SalleForm />,
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

export const useSalleStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <SallesOverview />,
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
