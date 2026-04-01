import { create } from "zustand";
import type { JSX } from "react";
import NotFound from "../../../NotFound";
import CantineOverview from "../components/dashboard/CantineOverview";
import CantineTable from "../components/table/CantineTable";
import CantineForm from "../components/form/CantineForm";

const renderList = [
  { id: "dashboard", component: <CantineOverview />, renderState: 0 },
  { id: "list", component: <CantineTable />, renderState: 1 },
  { id: "parametre", component: <CantineOverview mode="settings" />, renderState: 2 },
  { id: "add", component: <CantineForm />, renderState: 3 },
];

type State = {
  menuListIsVisible: boolean;
  renderedComponent: JSX.Element;
  renderState: number;
  setRenderState: (value: number) => void;
  setMenuListIsVisible: (value: boolean) => void;
  setRenderedComponent: (value: string) => void;
};

export const useCantineStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <CantineOverview />,
  renderState: 0,
  setRenderState: (value) => set({ renderState: value }),
  setMenuListIsVisible: (value) => set({ menuListIsVisible: value }),
  setRenderedComponent: (value) => {
    const found = renderList.find((item) => item.id === value);
    if (found) {
      set({ renderedComponent: found.component, renderState: found.renderState });
      return;
    }
    set({ renderedComponent: <NotFound />, renderState: -1 });
  },
}));
