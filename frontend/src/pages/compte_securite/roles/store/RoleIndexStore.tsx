import { create } from "zustand";
import NotFound from "../../../NotFound";
import type { JSX } from "react";
import RoleList from "../components/table/RoleTable";
import RoleForm from "../components/form/RoleForm";

type menuItemToComponentType = {
  id: string;
  component: JSX.Element;
};

const renderList: menuItemToComponentType[] = [
  {
    id: "add",
    component: <RoleForm />,
  },
  {
    id: "list",
    component: <RoleList />,
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
    renderedComponent: <NotFound />,
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
