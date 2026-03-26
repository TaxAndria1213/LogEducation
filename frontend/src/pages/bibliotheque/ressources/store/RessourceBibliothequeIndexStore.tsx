import { create } from "zustand";
import type { JSX } from "react";
import NotFound from "../../../NotFound";
import RessourceBibliothequeOverview from "../components/dashboard/RessourceBibliothequeOverview";
import RessourceBibliothequeForm from "../components/form/RessourceBibliothequeForm";
import RessourceBibliothequeTable from "../components/table/RessourceBibliothequeTable";

const renderList = [
  { id: "dashboard", component: <RessourceBibliothequeOverview />, renderState: 0 },
  { id: "list", component: <RessourceBibliothequeTable />, renderState: 1 },
  { id: "parametre", component: <RessourceBibliothequeOverview mode="settings" />, renderState: 2 },
  { id: "add", component: <RessourceBibliothequeForm />, renderState: 3 },
];

type State = {
  menuListIsVisible: boolean;
  renderedComponent: JSX.Element;
  renderState: number;
  setRenderState: (value: number) => void;
  setMenuListIsVisible: (value: boolean) => void;
  setRenderedComponent: (value: string) => void;
};

export const useRessourceBibliothequeStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <RessourceBibliothequeOverview />,
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
