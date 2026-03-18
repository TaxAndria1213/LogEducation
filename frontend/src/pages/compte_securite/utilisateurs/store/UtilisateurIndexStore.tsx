import { create } from "zustand";
import NotFound from "../../../NotFound";
import type { JSX } from "react";
import UtilisateurDashboard from "../components/dashboard/UtilisateurDashboard";
import UtilisateurList from "../components/table/UtilisateursTable";
import UtilisateurForm from "../components/form/UtilisateurForm";
import ApprobationList from "../components/table/Utilisateur.AprobationTable";
import UtilisateurSettings from "../components/settings/UtilisateurSettings";

type menuItemToComponentType = {
  id: string;
  component: JSX.Element;
};

const renderList: menuItemToComponentType[] = [
  {
    id: "dashboard",
    component: <UtilisateurDashboard />,
  },
  {
    id: "add",
    component: <UtilisateurForm />,
  },
  {
    id: "list",
    component: <UtilisateurList />,
  },
  {
    id: "approbation",
    component: <ApprobationList />,
  },
  {
    id: "parametre",
    component: <UtilisateurSettings />,
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

export const useUtilisateurStore = create<State>((set) => {
  return {
    menuListIsVisible: false,
    renderedComponent: <UtilisateurDashboard />,
    renderState: 0,
    setRenderState: (value: number) => set({ renderState: value }),
    setMenuListIsVisible: (value: boolean) => set({ menuListIsVisible: value }),
    setRenderedComponent: (value: string) => {
      if (renderList.find((item) => item.id === value) !== undefined) {
        set({
          renderedComponent: renderList.find((item) => item.id === value)!
            .component,
        });
      } else {
        set({ renderedComponent: <NotFound />, renderState: -1 });
      }
    },
  };
});
