import { create } from "zustand";
import type { JSX } from "react";
import NotFound from "../../../NotFound";
import PlanPaiementOverview from "../components/dashboard/PlanPaiementOverview";
import PlanPaiementForm from "../components/form/PlanPaiementForm";
import PlanPaiementTable from "../components/table/PlanPaiementTable";

const renderList = [
  { id: "dashboard", component: <PlanPaiementOverview />, renderState: 0 },
  { id: "list", component: <PlanPaiementTable />, renderState: 1 },
  { id: "parametre", component: <PlanPaiementOverview mode="settings" />, renderState: 2 },
  { id: "add", component: <PlanPaiementForm />, renderState: 3 },
];

type State = {
  menuListIsVisible: boolean;
  renderedComponent: JSX.Element;
  renderState: number;
  setRenderState: (value: number) => void;
  setMenuListIsVisible: (value: boolean) => void;
  setRenderedComponent: (value: string) => void;
};

export const usePlanPaiementStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <PlanPaiementOverview />,
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
