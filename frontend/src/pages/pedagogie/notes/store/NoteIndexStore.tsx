import { create } from "zustand";
import NotFound from "../../../NotFound";
import type { JSX } from "react";
import NoteList from "../components/table/NoteTable";
import NoteForm from "../components/form/NoteForm";
import NoteOverview from "../components/dashboard/NoteOverview";

type MenuItemToComponent = {
  id: string;
  component: JSX.Element;
  renderState: number;
};

const renderList: MenuItemToComponent[] = [
  { id: "dashboard", component: <NoteOverview />, renderState: 0 },
  { id: "add", component: <NoteForm />, renderState: 3 },
  { id: "list", component: <NoteList />, renderState: 1 },
  {
    id: "parametre",
    component: <NoteOverview mode="settings" />,
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

export const useNoteStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <NoteOverview />,
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
