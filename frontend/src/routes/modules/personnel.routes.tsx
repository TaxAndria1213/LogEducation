import type { menu } from "../../types/types";

export const personnel: menu = {
    key: "personnel",
    name: "Personnel",
    submodules: [
      {
        key: "personnels",
        name: "Personnels",
        path: "/personnel/personnels",
      },
      {
        key: "enseignants",
        name: "Enseignants",
        path: "/personnel/enseignants",
      },
      {
        key: "departements",
        name: "Départements",
        path: "/personnel/departements",
      },
    ],
  }