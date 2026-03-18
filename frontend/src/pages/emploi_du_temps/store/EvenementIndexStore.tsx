import { create } from "zustand";
import type { JSX } from "react";
import NotFound from "../../NotFound";
import EventDashboard from "../components/Evenement/EventDashboard";
import EventForm from "../components/Evenement/EventForm";
import EventsList from "../components/Evenement/EventsList";
import EventSettings from "../components/Evenement/EventSettings";

type MenuComponent = {
  id: string;
  component: JSX.Element;
};

const renderList: MenuComponent[] = [
  { id: "dashboard", component: <EventDashboard /> },
  { id: "add", component: <EventForm /> },
  { id: "list", component: <EventsList /> },
  { id: "parametre", component: <EventSettings /> },
];

type State = {
  menuListIsVisible: boolean;
  renderedComponent: JSX.Element;
  renderState: number;
  setRenderState: (value: number) => void;
  setMenuListIsVisible: (value: boolean) => void;
  setRenderedComponent: (value: string) => void;
};

export const useEvenementStore = create<State>((set) => ({
  menuListIsVisible: false,
  renderedComponent: <EventDashboard />,
  renderState: 0,
  setRenderState: (value: number) => set({ renderState: value }),
  setMenuListIsVisible: (value: boolean) => set({ menuListIsVisible: value }),
  setRenderedComponent: (value: string) => {
    const found = renderList.find((item) => item.id === value);
    if (found) set({ renderedComponent: found.component });
    else set({ renderedComponent: <NotFound />, renderState: -1 });
  },
}));
