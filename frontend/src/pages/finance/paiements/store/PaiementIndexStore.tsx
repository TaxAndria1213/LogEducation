import { create } from "zustand";
import type { JSX } from "react";
import NotFound from "../../../NotFound";
import PaiementOverview from "../components/dashboard/PaiementOverview";
import PaiementForm from "../components/form/PaiementForm";
import PaiementTable from "../components/table/PaiementTable";

const renderList = [
  { id: "dashboard", component: <PaiementOverview />, renderState: 0 },
  { id: "list", component: <PaiementTable />, renderState: 1 },
  { id: "parametre", component: <PaiementOverview mode="settings" />, renderState: 2 },
  { id: "add", component: <PaiementForm />, renderState: 3 },
];

type State = {
  menuListIsVisible: boolean;
  renderedComponent: JSX.Element;
  renderState: number;
  setRenderState: (value: number) => void;
  setMenuListIsVisible: (value: boolean) => void;
  setRenderedComponent: (value: string) => void;
};

export const usePaiementStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <PaiementOverview />,
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
