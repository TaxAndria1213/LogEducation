import { create } from "zustand";
import NotFound from "../../../NotFound";
import type { JSX } from "react";
import EvaluationList from "../components/table/EvaluationTable";
import EvaluationForm from "../components/form/EvaluationForm";

type menuItemToComponentType = { id: string; component: JSX.Element };

const renderList: menuItemToComponentType[] = [
  { id: "add", component: <EvaluationForm /> },
  { id: "list", component: <EvaluationList /> },
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
  renderedComponent: <NotFound />,
  renderState: 0,
  setRenderState: (value: number) => set({ renderState: value }),
  setMenuListIsVisible: (value: boolean) => set({ menuListIsVisible: value }),
  setRenderedComponent: (value: string) => {
    const found = renderList.find((item) => item.id === value);
    if (found) set({ renderedComponent: found.component });
    else set({ renderedComponent: <NotFound />, renderState: -1 });
  },
}));

