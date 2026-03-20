import { create } from "zustand";
import NotFound from "../../../NotFound";
import type { JSX } from "react";
import EvaluationList from "../components/table/EvaluationTable";
import EvaluationForm from "../components/form/EvaluationForm";
import EvaluationOverview from "../components/dashboard/EvaluationOverview";

type MenuItemToComponent = {
  id: string;
  component: JSX.Element;
  renderState: number;
};

const renderList: MenuItemToComponent[] = [
  { id: "dashboard", component: <EvaluationOverview />, renderState: 0 },
  { id: "add", component: <EvaluationForm />, renderState: 3 },
  { id: "list", component: <EvaluationList />, renderState: 1 },
  {
    id: "parametre",
    component: <EvaluationOverview mode="settings" />,
    renderState: 2,
  },
];

type State = {
  menuListIsVisible: boolean;
  renderedComponent: JSX.Element;
  renderState: number;
  setRenderState: (value: number) => void;
  setMenuListIsVisible: (value: boolean) => void;
  setRenderedComponent: (value: string) => void;
};

export const useEvaluationStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <EvaluationOverview />,
  renderState: 0,
  setRenderState: (value: number) => set({ renderState: value }),
  setMenuListIsVisible: (value: boolean) => set({ menuListIsVisible: value }),
  setRenderedComponent: (value: string) => {
    const found = renderList.find((item) => item.id === value);
    if (found) {
      set({
        renderedComponent: found.component,
        renderState: found.renderState,
      });
    } else {
      set({ renderedComponent: <NotFound />, renderState: -1 });
    }
  },
}));
