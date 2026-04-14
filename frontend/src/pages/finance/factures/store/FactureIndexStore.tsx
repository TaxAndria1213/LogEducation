import { create } from "zustand";
import type { JSX } from "react";
import NotFound from "../../../NotFound";
import FactureOverview from "../components/dashboard/FactureOverview";
import FactureForm from "../components/form/FactureForm";
import FactureTable from "../components/table/FactureTable";
import type { FactureWithRelations } from "../../../../services/facture.service";

const renderList = [
  { id: "dashboard", component: <FactureOverview />, renderState: 0 },
  { id: "list", component: <FactureTable />, renderState: 1 },
  { id: "parametre", component: <FactureOverview mode="settings" />, renderState: 2 },
  { id: "add", component: <FactureForm />, renderState: 3 },
  { id: "edit", component: <FactureForm mode="edit" />, renderState: 4 },
];

type State = {
  menuListIsVisible: boolean;
  renderedComponent: JSX.Element;
  renderState: number;
  selectedFacture: FactureWithRelations | null;
  setRenderState: (value: number) => void;
  setMenuListIsVisible: (value: boolean) => void;
  setRenderedComponent: (value: string) => void;
  setSelectedFacture: (value: FactureWithRelations | null) => void;
};

export const useFactureStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <FactureOverview />,
  renderState: 0,
  selectedFacture: null,
  setRenderState: (value) => set({ renderState: value }),
  setMenuListIsVisible: (value) => set({ menuListIsVisible: value }),
  setSelectedFacture: (value) => set({ selectedFacture: value }),
  setRenderedComponent: (value) => {
    const found = renderList.find((item) => item.id === value);
    if (found) {
      set((state) => ({
        renderedComponent: found.component,
        renderState: found.renderState,
        selectedFacture:
          value === "dashboard" || value === "parametre" || value === "add"
            ? null
            : state.selectedFacture,
      }));
      return;
    }
    set({ renderedComponent: <NotFound />, renderState: -1 });
  },
}));
