import { create } from "zustand";
import NotFound from "../../../NotFound";
import type { JSX } from "react";
import ProgrammeList from "../components/table/ProgrammeTable";
import ProgrammeForm from "../components/form/ProgrammeForm";

type menuItemToComponentType = { id: string; component: JSX.Element };

const renderList: menuItemToComponentType[] = [
  { id: "add", component: <ProgrammeForm /> },
  { id: "list", component: <ProgrammeList /> },
];

type State = {
  menuListIsVisible: boolean;
  renderedComponent: JSX.Element;
  renderState: number;
  setRenderState: (value: number) => void;
  setMenuListIsVisible: (value: boolean) => void;
  setRenderedComponent: (value: string) => void;
};

export const useProgrammeStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <NotFound />,
  renderState: 0,
  setRenderState: (value: number) => set({ renderState: value }),
  setMenuListIsVisible: (value: boolean) => set({ menuListIsVisible: value }),
  setRenderedComponent: (value: string) => {
    const found = renderList.find((item) => item.id === value);
    if (found) {
      set({ renderedComponent: found.component });
    } else {
      set({ renderedComponent: <NotFound />, renderState: -1 });
    }
  },
}));

