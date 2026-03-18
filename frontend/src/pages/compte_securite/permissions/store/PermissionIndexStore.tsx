import { create } from "zustand";
import NotFound from "../../../NotFound";
import type { JSX } from "react";
import PermissionDashboard from "../components/dashboard/PermissionDashboard";
import PermissionList from "../components/table/PermissionTable";
import PermissionForm from "../components/form/PermissionForm";
import PermissionSettings from "../components/settings/PermissionSettings";

type MenuItemToComponentType = {
  id: string;
  component: JSX.Element;
};

const renderList: MenuItemToComponentType[] = [
  {
    id: "dashboard",
    component: <PermissionDashboard />,
  },
  {
    id: "add",
    component: <PermissionForm />,
  },
  {
    id: "list",
    component: <PermissionList />,
  },
  {
    id: "parametre",
    component: <PermissionSettings />,
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

export const usePermissionStore = create<State>((set) => {
  return {
    menuListIsVisible: false,
    renderedComponent: <PermissionDashboard />,
    renderState: 0,
    setRenderState: (value: number) => set({ renderState: value }),
    setMenuListIsVisible: (value: boolean) => set({ menuListIsVisible: value }),
    setRenderedComponent: (value: string) => {
      if (renderList.find((item) => item.id === value) !== undefined) {
        set({
          renderedComponent: renderList.find((item) => item.id === value)!
            .component,
        });
      } else {
        set({ renderedComponent: <NotFound />, renderState: -1 });
      }
    },
  };
});
