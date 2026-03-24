import { create } from "zustand";
import type { JSX } from "react";
import NotFound from "../../../NotFound";
import RecompenseOverview from "../components/dashboard/RecompenseOverview";
import RecompenseForm from "../components/form/RecompenseForm";
import RecompenseTable from "../components/table/RecompenseTable";

const renderList = [
  { id: "dashboard", component: <RecompenseOverview />, renderState: 0 },
  { id: "list", component: <RecompenseTable />, renderState: 1 },
  { id: "parametre", component: <RecompenseOverview mode="settings" />, renderState: 2 },
  { id: "add", component: <RecompenseForm />, renderState: 3 },
];

type State = {
  menuListIsVisible: boolean;
  renderedComponent: JSX.Element;
  renderState: number;
  setRenderState: (value: number) => void;
  setMenuListIsVisible: (value: boolean) => void;
  setRenderedComponent: (value: string) => void;
};

export const useRecompenseStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <RecompenseOverview />,
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
