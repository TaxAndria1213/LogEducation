import { create } from "zustand";
import type { JSX } from "react";
import NotFound from "../../../NotFound";
import TypeEvaluationRefTable from "../components/table/TypeEvaluationRefTable";
import TypeEvaluationRefForm from "../components/form/TypeEvaluationRefForm";
import TypeEvaluationRefOverview from "../components/dashboard/TypeEvaluationRefOverview";
import type { TypeEvaluationRef } from "../../../../types/models";

type MenuItemToComponent = {
  id: string;
  component: JSX.Element;
  renderState: number;
};

const renderList: MenuItemToComponent[] = [
  { id: "dashboard", component: <TypeEvaluationRefOverview />, renderState: 0 },
  { id: "add", component: <TypeEvaluationRefForm />, renderState: 3 },
  { id: "list", component: <TypeEvaluationRefTable />, renderState: 1 },
  {
    id: "parametre",
    component: <TypeEvaluationRefOverview mode="settings" />,
    renderState: 2,
  },
];

type State = {
  menuListIsVisible: boolean;
  renderedComponent: JSX.Element;
  renderState: number;
  editingItem: TypeEvaluationRef | null;
  setRenderState: (value: number) => void;
  setMenuListIsVisible: (value: boolean) => void;
  setRenderedComponent: (value: string) => void;
  setEditingItem: (value: TypeEvaluationRef | null) => void;
  clearEditingItem: () => void;
};

export const useTypeEvaluationRefStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <TypeEvaluationRefOverview />,
  renderState: 0,
  editingItem: null,
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
  setEditingItem: (value) => set({ editingItem: value }),
  clearEditingItem: () => set({ editingItem: null }),
}));
