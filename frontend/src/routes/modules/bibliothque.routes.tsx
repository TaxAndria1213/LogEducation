import type { menu } from "../../types/types";

export const bibliothque: menu = {
  key: "bibliothque",
  name: "Bibliothèque",
  submodules: [
    {
      key: "ressources",
      name: "Ressources",
      path: "/bibliothque/ressources",
    },
    {
      key: "emprunts",
      name: "Emprunts",
      path: "/bibliothque/emprunts",
    },
  ],
};
