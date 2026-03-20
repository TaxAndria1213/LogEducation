import type { JSX } from "react";
import { create } from "zustand";
import NotFound from "../../../NotFound";
import PeriodeOverview from "../components/dashboard/PeriodeOverview";
import PeriodeForm from "../components/form/PeriodeForm";
import PeriodeList from "../components/table/PeriodeTable";

type MenuItemToComponentType = {
  id: string;
  component: JSX.Element;
  renderState: number;
};

const renderList: MenuItemToComponentType[] = [
  {
    id: "dashboard",
    component: <PeriodeOverview />,
    renderState: 0,
  },
  {
    id: "list",
    component: <PeriodeList />,
    renderState: 1,
  },
  {
    id: "parametre",
    component: <PeriodeOverview mode="settings" />,
    renderState: 2,
  },
  {
    id: "add",
    component: <PeriodeForm />,
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

export const usePeriodeStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <PeriodeOverview />,
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
