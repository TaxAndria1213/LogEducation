import { create } from "zustand";

type State = {
  menuListIsVisible: boolean;
  renderedComponent: string;
  renderState: number;
  setRenderState: (value: number) => void;
  setMenuListIsVisible: (value: boolean) => void;
  setRenderedComponent: (value: string) => void;
};

const allowedViews = ["add", "list", "dashboard"] as const;

export const useInscriptionStore = create<State>((set) => {
  return {
    menuListIsVisible: false,
    renderedComponent: "dashboard",
    renderState: 0,
    setRenderState: (value: number) => set({ renderState: value }),
    setMenuListIsVisible: (value: boolean) => set({ menuListIsVisible: value }),
    setRenderedComponent: (value: string) => {
      if (allowedViews.includes(value as (typeof allowedViews)[number])) {
        set({ renderedComponent: value });
      } else {
        set({ renderedComponent: "notfound", renderState: -1 });
      }
    },
  };
});