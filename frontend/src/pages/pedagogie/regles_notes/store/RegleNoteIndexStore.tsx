import { create } from "zustand";
import NotFound from "../../../NotFound";
import type { JSX } from "react";
import RegleNoteList from "../components/table/RegleNoteTable";
import RegleNoteForm from "../components/form/RegleNoteForm";
import RegleNoteOverview from "../components/dashboard/RegleNoteOverview";

type MenuItemToComponent = {
  id: string;
  component: JSX.Element;
  renderState: number;
};

const renderList: MenuItemToComponent[] = [
  { id: "dashboard", component: <RegleNoteOverview />, renderState: 0 },
  { id: "add", component: <RegleNoteForm />, renderState: 3 },
  { id: "list", component: <RegleNoteList />, renderState: 1 },
  {
    id: "parametre",
    component: <RegleNoteOverview mode="settings" />,
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

export const useRegleNoteStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <RegleNoteOverview />,
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
