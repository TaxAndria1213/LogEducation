import { create } from "zustand";
import type { JSX } from "react";
import NotFound from "../../../NotFound";
import SanctionOverview from "../components/dashboard/SanctionOverview";
import SanctionForm from "../components/form/SanctionForm";
import SanctionTable from "../components/table/SanctionTable";

const renderList = [
  { id: "dashboard", component: <SanctionOverview />, renderState: 0 },
  { id: "list", component: <SanctionTable />, renderState: 1 },
  { id: "parametre", component: <SanctionOverview mode="settings" />, renderState: 2 },
  { id: "add", component: <SanctionForm />, renderState: 3 },
];

type State = {
  menuListIsVisible: boolean;
  renderedComponent: JSX.Element;
  renderState: number;
  setRenderState: (value: number) => void;
  setMenuListIsVisible: (value: boolean) => void;
  setRenderedComponent: (value: string) => void;
};

export const useSanctionStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <SanctionOverview />,
  renderState: 0,
  setRenderState: (value) => set({ renderState: value }),
  setMenuListIsVisible: (value) => set({ menuListIsVisible: value }),
  setRenderedComponent: (value: string) => {
    const found = renderList.find((item) => item.id === value);
    if (found) {
      set({ renderedComponent: found.component, renderState: found.renderState });
      return;
    }
    set({ renderedComponent: <NotFound />, renderState: -1 });
  },
}));
