import { create } from "zustand";
import type { JSX } from "react";
import NotFound from "../../../NotFound";
import JustificatifOverview from "../components/dashboard/JustificatifOverview";
import JustificatifForm from "../components/form/JustificatifForm";
import JustificatifTable from "../components/table/JustificatifTable";

const renderList = [
  { id: "dashboard", component: <JustificatifOverview />, renderState: 0 },
  { id: "list", component: <JustificatifTable />, renderState: 1 },
  { id: "parametre", component: <JustificatifOverview mode="settings" />, renderState: 2 },
  { id: "add", component: <JustificatifForm />, renderState: 3 },
];

type State = { menuListIsVisible: boolean; renderedComponent: JSX.Element; renderState: number; setRenderState: (value: number) => void; setMenuListIsVisible: (value: boolean) => void; setRenderedComponent: (value: string) => void; };
export const useJustificatifStore = create<State>((set) => ({ menuListIsVisible: false, renderedComponent: <JustificatifOverview />, renderState: 0, setRenderState: (value) => set({ renderState: value }), setMenuListIsVisible: (value) => set({ menuListIsVisible: value }), setRenderedComponent: (value) => { const found = renderList.find((item) => item.id === value); if (found) { set({ renderedComponent: found.component, renderState: found.renderState }); return; } set({ renderedComponent: <NotFound />, renderState: -1 }); }, }));
