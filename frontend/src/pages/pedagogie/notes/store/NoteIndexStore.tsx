import { create } from "zustand";
import NotFound from "../../../NotFound";
import type { JSX } from "react";
import NoteList from "../components/table/NoteTable";
import NoteForm from "../components/form/NoteForm";

type menuItemToComponentType = { id: string; component: JSX.Element };

const renderList: menuItemToComponentType[] = [
  { id: "add", component: <NoteForm /> },
  { id: "list", component: <NoteList /> },
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

