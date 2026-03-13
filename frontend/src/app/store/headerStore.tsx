import type { JSX } from "react";
import { create } from "zustand";
import ProfilePopup from "../layouts/header/ProfilePopup";

export type PopupUserValueType = "profil" | "notification" | "message";

type ComponentsType = {
  id: PopupUserValueType;
  component: JSX.Element;
};


const components: ComponentsType[] = [
  { id: "profil", component: <ProfilePopup /> },
];

type HeaderStore = {
  popupType: "left" | "center" | "right" | null;
  popupOpen: boolean;
  popupContent: JSX.Element | null;
  setPopupContent: (value: PopupUserValueType) => void;
  setPopupOpen: (
    value: boolean,
    type?: "left" | "center" | "right" | null,
  ) => void;
};

export const useHeaderStore = create<HeaderStore>()((set) => ({
  popupOpen: false,
  popupType: null,
  popupContent: <></>,
  setPopupOpen: (value, type) => set({ popupOpen: value, popupType: type }),
  setPopupContent: (value: PopupUserValueType) => {
    const component = components.find((c) => c.id === value)?.component || null;
    set({ popupContent: component });
  },
}));
