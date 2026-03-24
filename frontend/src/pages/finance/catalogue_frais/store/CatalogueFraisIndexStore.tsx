import { create } from "zustand";
import type { JSX } from "react";
import NotFound from "../../../NotFound";
import CatalogueFraisOverview from "../components/dashboard/CatalogueFraisOverview";
import CatalogueFraisForm from "../components/form/CatalogueFraisForm";
import CatalogueFraisTable from "../components/table/CatalogueFraisTable";

const renderList = [
  { id: "dashboard", component: <CatalogueFraisOverview />, renderState: 0 },
  { id: "list", component: <CatalogueFraisTable />, renderState: 1 },
  { id: "parametre", component: <CatalogueFraisOverview mode="settings" />, renderState: 2 },
  { id: "add", component: <CatalogueFraisForm />, renderState: 3 },
];

type State = {
  menuListIsVisible: boolean;
  renderedComponent: JSX.Element;
  renderState: number;
  setRenderState: (value: number) => void;
  setMenuListIsVisible: (value: boolean) => void;
  setRenderedComponent: (value: string) => void;
};

export const useCatalogueFraisStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <CatalogueFraisOverview />,
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
