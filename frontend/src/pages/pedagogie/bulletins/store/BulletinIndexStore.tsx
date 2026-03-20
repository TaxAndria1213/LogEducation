import { create } from "zustand";
import type { JSX } from "react";
import NotFound from "../../../NotFound";
import BulletinOverview from "../components/dashboard/BulletinOverview";
import BulletinForm from "../components/form/BulletinForm";
import BulletinList from "../components/table/BulletinTable";

type MenuItemToComponentType = {
  id: string;
  component: JSX.Element;
  renderState: number;
};

const renderList: MenuItemToComponentType[] = [
  { id: "dashboard", component: <BulletinOverview />, renderState: 0 },
  { id: "list", component: <BulletinList />, renderState: 1 },
  { id: "parametre", component: <BulletinOverview mode="settings" />, renderState: 2 },
  { id: "add", component: <BulletinForm />, renderState: 3 },
];

type State = {
  menuListIsVisible: boolean;
  renderedComponent: JSX.Element;
  renderState: number;
  setRenderState: (value: number) => void;
  setMenuListIsVisible: (value: boolean) => void;
  setRenderedComponent: (value: string) => void;
};

export const useBulletinStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <BulletinOverview />,
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
