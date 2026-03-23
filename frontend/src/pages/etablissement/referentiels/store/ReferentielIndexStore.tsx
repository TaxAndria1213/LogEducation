import { create } from "zustand";
import type { JSX } from "react";
import NotFound from "../../../NotFound";
import ReferentielOverview from "../components/dashboard/ReferentielOverview";
import ReferentielTable from "../components/table/ReferentielTable";
import ReferentielForm from "../components/form/ReferentielForm";

type MenuItemToComponentType = {
  id: string;
  component: JSX.Element;
  renderState: number;
};

const renderList: MenuItemToComponentType[] = [
  {
    id: "dashboard",
    component: <ReferentielOverview />,
    renderState: 0,
  },
  {
    id: "list",
    component: <ReferentielTable />,
    renderState: 1,
  },
  {
    id: "parametre",
    component: <ReferentielOverview mode="settings" />,
    renderState: 2,
  },
  {
    id: "add",
    component: <ReferentielForm />,
    renderState: 3,
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

export const useReferentielIndexStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <ReferentielOverview />,
  renderState: 0,
  setRenderState: (value: number) => set({ renderState: value }),
  setMenuListIsVisible: (value: boolean) => set({ menuListIsVisible: value }),
  setRenderedComponent: (value: string) => {
    const item = renderList.find((entry) => entry.id === value);

    if (item) {
      set({
        renderedComponent: item.component,
        renderState: item.renderState,
      });
      return;
    }

    set({
      renderedComponent: <NotFound />,
      renderState: -1,
    });
  },
}));
