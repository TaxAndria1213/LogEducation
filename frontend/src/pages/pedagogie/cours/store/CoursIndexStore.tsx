import { create } from "zustand";
import NotFound from "../../../NotFound";
import type { JSX } from "react";
import CoursList from "../components/table/CoursTable";
import CoursForm from "../components/form/CoursForm";
import CoursOverview from "../components/dashboard/CoursOverview";

type MenuItemToComponent = {
  id: string;
  component: JSX.Element;
  renderState: number;
};

const renderList: MenuItemToComponent[] = [
  { id: "dashboard", component: <CoursOverview />, renderState: 0 },
  { id: "add", component: <CoursForm />, renderState: 3 },
  { id: "list", component: <CoursList />, renderState: 1 },
  {
    id: "parametre",
    component: <CoursOverview mode="settings" />,
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

export const useCoursStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <CoursOverview />,
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
