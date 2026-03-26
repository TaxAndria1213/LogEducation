import { create } from "zustand";
import type { JSX } from "react";
import NotFound from "../../../NotFound";
import EmpruntBibliothequeOverview from "../components/dashboard/EmpruntBibliothequeOverview";
import EmpruntBibliothequeForm from "../components/form/EmpruntBibliothequeForm";
import EmpruntBibliothequeTable from "../components/table/EmpruntBibliothequeTable";

const renderList = [
  { id: "dashboard", component: <EmpruntBibliothequeOverview />, renderState: 0 },
  { id: "list", component: <EmpruntBibliothequeTable />, renderState: 1 },
  { id: "parametre", component: <EmpruntBibliothequeOverview mode="settings" />, renderState: 2 },
  { id: "add", component: <EmpruntBibliothequeForm />, renderState: 3 },
];

type State = {
  menuListIsVisible: boolean;
  renderedComponent: JSX.Element;
  renderState: number;
  setRenderState: (value: number) => void;
  setMenuListIsVisible: (value: boolean) => void;
  setRenderedComponent: (value: string) => void;
};

export const useEmpruntBibliothequeStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <EmpruntBibliothequeOverview />,
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
