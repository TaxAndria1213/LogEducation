import { create } from "zustand";
import NotFound from "../../../NotFound";
import type { JSX } from "react";
import PersonnelList from "../components/table/PersonnelTable";
import PersonnelForm from "../components/form/PersonnelForm";
import PersonnelOverview from "../components/dashboard/PersonnelOverview";

type MenuItemToComponent = {
  id: string;
  component: JSX.Element;
  renderState: number;
};

const renderList: MenuItemToComponent[] = [
  {
    id: "dashboard",
    component: <PersonnelOverview />,
    renderState: 0,
  },
  {
    id: "add",
    component: <PersonnelForm />,
    renderState: 3,
  },
  {
    id: "list",
    component: <PersonnelList />,
    renderState: 1,
  },
  {
    id: "parametre",
    component: <PersonnelOverview mode="settings" />,
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

export const usePersonnelStore = create<State>((set) => {
  return {
    menuListIsVisible: false,
    renderedComponent: <PersonnelOverview />,
    renderState: 0,
    setRenderState: (value: number) => set({ renderState: value }),
    setMenuListIsVisible: (value: boolean) => set({ menuListIsVisible: value }),
    setRenderedComponent: (value: string) => {
      const item = renderList.find((entry) => entry.id === value);

      if (item !== undefined) {
        set({
          renderedComponent: item.component,
          renderState: item.renderState,
        });
      } else {
        set({ renderedComponent: <NotFound />, renderState: -1 });
      }
    },
  };
});
