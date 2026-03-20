import { create } from "zustand";
import type { JSX } from "react";
import NotFound from "../../../NotFound";
import PresencePersonnelOverview from "../components/dashboard/PresencePersonnelOverview";
import PresencePersonnelForm from "../components/form/PresencePersonnelForm";
import PresencePersonnelTable from "../components/table/PresencePersonnelTable";

const renderList = [
  { id: "dashboard", component: <PresencePersonnelOverview />, renderState: 0 },
  { id: "list", component: <PresencePersonnelTable />, renderState: 1 },
  { id: "parametre", component: <PresencePersonnelOverview mode="settings" />, renderState: 2 },
  { id: "add", component: <PresencePersonnelForm />, renderState: 3 },
];

type State = { menuListIsVisible: boolean; renderedComponent: JSX.Element; renderState: number; setRenderState: (value: number) => void; setMenuListIsVisible: (value: boolean) => void; setRenderedComponent: (value: string) => void; };
export const usePresencePersonnelStore = create<State>((set) => ({ menuListIsVisible: false, renderedComponent: <PresencePersonnelOverview />, renderState: 0, setRenderState: (value) => set({ renderState: value }), setMenuListIsVisible: (value) => set({ menuListIsVisible: value }), setRenderedComponent: (value) => { const found = renderList.find((item) => item.id === value); if (found) { set({ renderedComponent: found.component, renderState: found.renderState }); return; } set({ renderedComponent: <NotFound />, renderState: -1 }); } }));
