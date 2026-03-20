import { create } from "zustand";
import NotFound from "../../../NotFound";
import type { JSX } from "react";
import MatiereList from "../components/table/MatiereTable";
import MatiereForm from "../components/form/MatiereForm";
import MatiereOverview from "../components/dashboard/MatiereOverview";

type MenuItemToComponent = {
  id: string;
  component: JSX.Element;
  renderState: number;
};

const renderList: MenuItemToComponent[] = [
  { id: "dashboard", component: <MatiereOverview />, renderState: 0 },
  { id: "add", component: <MatiereForm />, renderState: 3 },
  { id: "list", component: <MatiereList />, renderState: 1 },
  {
    id: "parametre",
    component: <MatiereOverview mode="settings" />,
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

export const useMatiereStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <MatiereOverview />,
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
