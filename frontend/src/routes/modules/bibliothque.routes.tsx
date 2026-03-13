import { FiBook } from "react-icons/fi";
import type { menu } from "../../types/types";

export const bibliothque: menu = {
  key: "bibliothque",
  name: "Bibliothèque",
  icon: <FiBook />,
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
