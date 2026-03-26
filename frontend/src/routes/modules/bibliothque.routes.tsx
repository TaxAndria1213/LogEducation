import { FiBook } from "react-icons/fi";
import type { menu } from "../../types/types";
import RessourcesIndex from "../../pages/bibliotheque/ressources/RessourcesIndex";
import EmpruntsIndex from "../../pages/bibliotheque/emprunts/EmpruntsIndex";

export const bibliothque: menu = {
  key: "bibliothque",
  name: "Bibliotheque",
  icon: <FiBook />,
  submodules: [
    {
      key: "ressources",
      name: "Ressources",
      path: "/bibliothque/ressources",
      elements: <RessourcesIndex />,
    },
    {
      key: "emprunts",
      name: "Emprunts",
      path: "/bibliothque/emprunts",
      elements: <EmpruntsIndex />,
    },
  ],
};
