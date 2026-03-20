import { create } from "zustand";
import type { JSX } from "react";
import NotFound from "../../../NotFound";
import SessionAppelOverview from "../components/dashboard/SessionAppelOverview";
import SessionAppelForm from "../components/form/SessionAppelForm";
import SessionAppelTable from "../components/table/SessionAppelTable";

type MenuItem = { id: string; component: JSX.Element; renderState: number };
const renderList: MenuItem[] = [
  { id: "dashboard", component: <SessionAppelOverview />, renderState: 0 },
  { id: "list", component: <SessionAppelTable />, renderState: 1 },
  { id: "parametre", component: <SessionAppelOverview mode="settings" />, renderState: 2 },
  { id: "add", component: <SessionAppelForm />, renderState: 3 },
];

type State = {
  menuListIsVisible: boolean;
  renderedComponent: JSX.Element;
  renderState: number;
  setRenderState: (value: number) => void;
  setMenuListIsVisible: (value: boolean) => void;
  setRenderedComponent: (value: string) => void;
};

export const useSessionAppelStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <SessionAppelOverview />,
  renderState: 0,
  setRenderState: (value) => set({ renderState: value }),
  setMenuListIsVisible: (value) => set({ menuListIsVisible: value }),
  setRenderedComponent: (value) => {
    const found = renderList.find((item) => item.id === value);
    if (found) {
      set({ renderedComponent: found.component, renderState: found.renderState });
      return;
    }
    set({ renderedComponent: <NotFound />, renderState: -1 });
  },
}));
