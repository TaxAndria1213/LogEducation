import { create } from "zustand";
import type { JSX } from "react";
import NotFound from "../../../NotFound";
import PresenceEleveOverview from "../components/dashboard/PresenceEleveOverview";
import PresenceEleveForm from "../components/form/PresenceEleveForm";
import PresenceEleveTable from "../components/table/PresenceEleveTable";

const renderList = [
  { id: "dashboard", component: <PresenceEleveOverview />, renderState: 0 },
  { id: "list", component: <PresenceEleveTable />, renderState: 1 },
  { id: "parametre", component: <PresenceEleveOverview mode="settings" />, renderState: 2 },
  { id: "add", component: <PresenceEleveForm />, renderState: 3 },
];

type State = { menuListIsVisible: boolean; renderedComponent: JSX.Element; renderState: number; setRenderState: (value: number) => void; setMenuListIsVisible: (value: boolean) => void; setRenderedComponent: (value: string) => void; };
export const usePresenceEleveStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <PresenceEleveOverview />,
  renderState: 0,
  setRenderState: (value) => set({ renderState: value }),
  setMenuListIsVisible: (value) => set({ menuListIsVisible: value }),
  setRenderedComponent: (value) => {
    const found = renderList.find((item) => item.id === value);
    if (found) { set({ renderedComponent: found.component, renderState: found.renderState }); return; }
    set({ renderedComponent: <NotFound />, renderState: -1 });
  },
}));
