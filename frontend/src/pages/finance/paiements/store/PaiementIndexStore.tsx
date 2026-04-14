import { create } from "zustand";
import type { JSX } from "react";
import NotFound from "../../../NotFound";
import PaiementOverview from "../components/dashboard/PaiementOverview";
import PaiementForm from "../components/form/PaiementForm";
import PaiementTable from "../components/table/PaiementTable";
import type { PaiementWithRelations } from "../../../../services/paiement.service";

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
  selectedPaiement: PaiementWithRelations | null;
  setRenderState: (value: number) => void;
  setMenuListIsVisible: (value: boolean) => void;
  setRenderedComponent: (value: string) => void;
  setSelectedPaiement: (value: PaiementWithRelations | null) => void;
};

export const usePaiementStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <PaiementOverview />,
  renderState: 0,
  selectedPaiement: null,
  setRenderState: (value) => set({ renderState: value }),
  setMenuListIsVisible: (value) => set({ menuListIsVisible: value }),
  setSelectedPaiement: (value) => set({ selectedPaiement: value }),
  setRenderedComponent: (value) => {
    const found = renderList.find((item) => item.id === value);
    if (found) {
      set((state) => ({
        renderedComponent: found.component,
        renderState: found.renderState,
        selectedPaiement:
          value === "dashboard" || value === "parametre" || value === "add"
            ? null
            : state.selectedPaiement,
      }));
      return;
    }
    set({ renderedComponent: <NotFound />, renderState: -1 });
  },
}));
