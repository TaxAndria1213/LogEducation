import { create } from "zustand";
import type { JSX } from "react";
import NotFound from "../../../NotFound";
import IncidentOverview from "../components/dashboard/IncidentOverview";
import IncidentForm from "../components/form/IncidentForm";
import IncidentTable from "../components/table/IncidentTable";

const renderList = [
  { id: "dashboard", component: <IncidentOverview />, renderState: 0 },
  { id: "list", component: <IncidentTable />, renderState: 1 },
  { id: "parametre", component: <IncidentOverview mode="settings" />, renderState: 2 },
  { id: "add", component: <IncidentForm />, renderState: 3 },
];

type State = {
  menuListIsVisible: boolean;
  renderedComponent: JSX.Element;
  renderState: number;
  setRenderState: (value: number) => void;
  setMenuListIsVisible: (value: boolean) => void;
  setRenderedComponent: (value: string) => void;
};

export const useIncidentStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <IncidentOverview />,
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
