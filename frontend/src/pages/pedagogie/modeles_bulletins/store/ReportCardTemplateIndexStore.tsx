import { create } from "zustand";
import type { JSX } from "react";
import NotFound from "../../../NotFound";
import ReportCardTemplateTable from "../components/table/ReportCardTemplateTable";
import ReportCardTemplateForm from "../components/form/ReportCardTemplateForm";
import ReportCardTemplateOverview from "../components/dashboard/ReportCardTemplateOverview";
import type { ReportCardTemplateWithRelations } from "../../../../services/reportCardTemplate.service";

type MenuItemToComponent = {
  id: string;
  component: JSX.Element;
  renderState: number;
};

const renderList: MenuItemToComponent[] = [
  { id: "dashboard", component: <ReportCardTemplateOverview />, renderState: 0 },
  { id: "add", component: <ReportCardTemplateForm />, renderState: 3 },
  { id: "list", component: <ReportCardTemplateTable />, renderState: 1 },
  {
    id: "parametre",
    component: <ReportCardTemplateOverview mode="settings" />,
    renderState: 2,
  },
];

type State = {
  menuListIsVisible: boolean;
  renderedComponent: JSX.Element;
  renderState: number;
  editingItem: ReportCardTemplateWithRelations | null;
  setRenderState: (value: number) => void;
  setMenuListIsVisible: (value: boolean) => void;
  setRenderedComponent: (value: string) => void;
  setEditingItem: (value: ReportCardTemplateWithRelations | null) => void;
  clearEditingItem: () => void;
};

export const useReportCardTemplateStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <ReportCardTemplateOverview />,
  renderState: 0,
  editingItem: null,
  setRenderState: (value: number) => set({ renderState: value }),
  setMenuListIsVisible: (value: boolean) => set({ menuListIsVisible: value }),
  setRenderedComponent: (value: string) => {
    const found = renderList.find((item) => item.id === value);
    if (found) {
      set({
        renderedComponent: found.component,
        renderState: found.renderState,
      });
    } else {
      set({ renderedComponent: <NotFound />, renderState: -1 });
    }
  },
  setEditingItem: (value) => set({ editingItem: value }),
  clearEditingItem: () => set({ editingItem: null }),
}));
