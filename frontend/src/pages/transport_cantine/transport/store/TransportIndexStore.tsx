import { create } from "zustand";
import type { JSX } from "react";
import NotFound from "../../../NotFound";
import TransportOverview from "../components/dashboard/TransportOverview";
import TransportTable from "../components/table/TransportTable";
import TransportForm from "../components/form/TransportForm";

const renderList = [
  { id: "dashboard", component: <TransportOverview />, renderState: 0 },
  { id: "list", component: <TransportTable />, renderState: 1 },
  { id: "parametre", component: <TransportOverview mode="settings" />, renderState: 2 },
  { id: "add", component: <TransportForm />, renderState: 3 },
];

type State = {
  menuListIsVisible: boolean;
  renderedComponent: JSX.Element;
  renderState: number;
  setRenderState: (value: number) => void;
  setMenuListIsVisible: (value: boolean) => void;
  setRenderedComponent: (value: string) => void;
};

export const useTransportStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <TransportOverview />,
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
