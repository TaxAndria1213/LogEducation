import { create } from "zustand";
import type { JSX } from "react";
import NotFound from "../../NotFound";
import CreneauManager from "../components/EmploiDuTemps/CreneauManager";
import ScheduleDashboard from "../components/EmploiDuTemps/ScheduleDashboard";
import ScheduleForm from "../components/EmploiDuTemps/ScheduleForm";
import ScheduleList from "../components/EmploiDuTemps/ScheduleList";

type MenuComponent = {
  id: string;
  component: JSX.Element;
  renderState: number;
};

const renderList: MenuComponent[] = [
  { id: "dashboard", component: <ScheduleDashboard />, renderState: 0 },
  { id: "list", component: <ScheduleList />, renderState: 1 },
  { id: "parametre", component: <CreneauManager />, renderState: 2 },
  { id: "add", component: <ScheduleForm />, renderState: 3 },
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
  renderedComponent: <ScheduleDashboard />,
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
      return;
    }

    set({ renderedComponent: <NotFound />, renderState: -1 });
  },
}));
