import { create } from "zustand";
import type { JSX } from "react";
import NotFound from "../../NotFound";
import ScheduleForm from "../components/EmploiDuTemps/ScheduleForm";
import ScheduleList from "../components/EmploiDuTemps/ScheduleList";

type MenuComponent = {
  id: string;
  component: JSX.Element;
};

const renderList: MenuComponent[] = [
  { id: "add", component: <ScheduleForm /> },
  { id: "list", component: <ScheduleList /> },
];

type State = {
  menuListIsVisible: boolean;
  renderedComponent: JSX.Element;
  renderState: number;
  setRenderState: (value: number) => void;
  setMenuListIsVisible: (value: boolean) => void;
  setRenderedComponent: (value: string) => void;
};

export const useEmploiDuTempsStore = create<State>((set) => ({
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
