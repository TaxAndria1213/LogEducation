import { create } from "zustand";
import NotFound from "../../../NotFound";
import type { JSX } from "react";
import ProfileDashboard from "../components/dashboard/ProfileDashboard";
import ProfileList from "../components/table/ProfileTable";
import ProfileForm from "../components/form/ProfileForm";
import ProfileSettings from "../components/settings/ProfileSettings";

type MenuItemToComponentType = {
  id: string;
  component: JSX.Element;
};

const renderList: MenuItemToComponentType[] = [
  {
    id: "dashboard",
    component: <ProfileDashboard />,
  },
  {
    id: "add",
    component: <ProfileForm />,
  },
  {
    id: "list",
    component: <ProfileList />,
  },
  {
    id: "parametre",
    component: <ProfileSettings />,
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

export const useProfileStore = create<State>((set) => {
  return {
    menuListIsVisible: false,
    renderedComponent: <ProfileDashboard />,
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
