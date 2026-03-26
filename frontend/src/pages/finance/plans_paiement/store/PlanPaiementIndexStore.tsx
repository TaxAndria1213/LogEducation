import { create } from "zustand";
import type { JSX } from "react";
import NotFound from "../../../NotFound";
import PlanPaiementOverview from "../components/dashboard/PlanPaiementOverview";
import PlanPaiementForm from "../components/form/PlanPaiementForm";
import PlanPaiementTable from "../components/table/PlanPaiementTable";
import PlanPaiementDetail from "../components/detail/PlanPaiementDetail";
import type { PlanPaiementEleveWithRelations } from "../../../../services/planPaiementEleve.service";

const renderList = [
  { id: "dashboard", component: <PlanPaiementOverview />, renderState: 0 },
  { id: "list", component: <PlanPaiementTable />, renderState: 1 },
  { id: "parametre", component: <PlanPaiementOverview mode="settings" />, renderState: 2 },
  { id: "add", component: <PlanPaiementForm />, renderState: 3 },
  { id: "detail", component: <PlanPaiementDetail />, renderState: 4 },
  { id: "edit", component: <PlanPaiementForm mode="edit" />, renderState: 5 },
];

type State = {
  menuListIsVisible: boolean;
  renderedComponent: JSX.Element;
  renderState: number;
  selectedPlanPaiement: PlanPaiementEleveWithRelations | null;
  setRenderState: (value: number) => void;
  setMenuListIsVisible: (value: boolean) => void;
  setRenderedComponent: (value: string) => void;
  setSelectedPlanPaiement: (value: PlanPaiementEleveWithRelations | null) => void;
};

export const usePlanPaiementStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <PlanPaiementOverview />,
  renderState: 0,
  selectedPlanPaiement: null,
  setRenderState: (value) => set({ renderState: value }),
  setMenuListIsVisible: (value) => set({ menuListIsVisible: value }),
  setSelectedPlanPaiement: (value) => set({ selectedPlanPaiement: value }),
  setRenderedComponent: (value) => {
    const found = renderList.find((item) => item.id === value);
    if (found) {
      set((state) => ({
        renderedComponent: found.component,
        renderState: found.renderState,
        selectedPlanPaiement:
          value === "dashboard" || value === "list" || value === "parametre" || value === "add"
            ? null
            : state.selectedPlanPaiement,
      }));
      return;
    }
    set({ renderedComponent: <NotFound />, renderState: -1 });
  },
}));
