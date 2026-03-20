import { create } from "zustand";
import NotFound from "../../../NotFound";
import type { JSX } from "react";
import ProgrammeList from "../components/table/ProgrammeTable";
import ProgrammeForm from "../components/form/ProgrammeForm";
import ProgrammeOverview from "../components/dashboard/ProgrammeOverview";

type MenuItemToComponent = {
  id: string;
  component: JSX.Element;
  renderState: number;
};

const renderList: MenuItemToComponent[] = [
  { id: "dashboard", component: <ProgrammeOverview />, renderState: 0 },
  { id: "add", component: <ProgrammeForm />, renderState: 3 },
  { id: "list", component: <ProgrammeList />, renderState: 1 },
  {
    id: "parametre",
    component: <ProgrammeOverview mode="settings" />,
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

export const useProgrammeStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <ProgrammeOverview />,
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
