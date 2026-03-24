import { create } from "zustand";
import type { JSX } from "react";
import NotFound from "../../../NotFound";
import RemiseOverview from "../components/dashboard/RemiseOverview";
import RemiseForm from "../components/form/RemiseForm";
import RemiseTable from "../components/table/RemiseTable";

const renderList = [
  { id: "dashboard", component: <RemiseOverview />, renderState: 0 },
  { id: "list", component: <RemiseTable />, renderState: 1 },
  { id: "parametre", component: <RemiseOverview mode="settings" />, renderState: 2 },
  { id: "add", component: <RemiseForm />, renderState: 3 },
];

type State = {
  menuListIsVisible: boolean;
  renderedComponent: JSX.Element;
  renderState: number;
  setRenderState: (value: number) => void;
  setMenuListIsVisible: (value: boolean) => void;
  setRenderedComponent: (value: string) => void;
};

export const useRemiseStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <RemiseOverview />,
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
