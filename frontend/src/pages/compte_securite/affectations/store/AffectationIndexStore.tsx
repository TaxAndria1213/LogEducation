import { create } from "zustand";
import NotFound from "../../../NotFound";
import type { JSX } from "react";
import AffectationDashboard from "../components/dashboard/AffectationDashboard";
import RolePermissionManager from "../components/role_permission/RolePermissionManager";
import UserRoleScopeManager from "../components/user_role/UserRoleScopeManager";
import AffectationSettings from "../components/settings/AffectationSettings";

type MenuItemToComponentType = {
  id: string;
  component: JSX.Element;
};

const renderList: MenuItemToComponentType[] = [
  { id: "dashboard", component: <AffectationDashboard /> },
  { id: "list", component: <RolePermissionManager /> },
  { id: "add", component: <UserRoleScopeManager /> },
  { id: "parametre", component: <AffectationSettings /> },
];

type State = {
  menuListIsVisible: boolean;
  renderedComponent: JSX.Element;
  renderState: number;
  setRenderState: (value: number) => void;
  setMenuListIsVisible: (value: boolean) => void;
  setRenderedComponent: (value: string) => void;
};

export const useAffectationStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <AffectationDashboard />,
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
