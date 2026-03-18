import { create } from "zustand";
import NotFound from "../../../NotFound";
import type { JSX } from "react";
import RoleDashboard from "../components/dashboard/RoleDashboard";
import RoleList from "../components/table/RoleTable";
import RoleForm from "../components/form/RoleForm";
import RoleSettings from "../components/settings/RoleSettings";

type menuItemToComponentType = {
  id: string;
  component: JSX.Element;
};

const renderList: menuItemToComponentType[] = [
  {
    id: "dashboard",
    component: <RoleDashboard />,
  },
  {
    id: "add",
    component: <RoleForm />,
  },
  {
    id: "list",
    component: <RoleList />,
  },
  {
    id: "parametre",
    component: <RoleSettings />,
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

export const useRoleStore = create<State>((set) => {
  return {
    menuListIsVisible: false,
    renderedComponent: <RoleDashboard />,
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
