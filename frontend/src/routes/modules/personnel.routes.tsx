import { FiUsers } from "react-icons/fi";
import type { menu } from "../../types/types";
import PersonnelsIndex from "../../pages/personnel/personnels/PersonnelIndex";
import EnseignantsIndex from "../../pages/personnel/enseignants/EnseignantsIndex";
import DepartementIndex from "../../pages/personnel/departements/DepartementIndex";

export const personnel: menu = {
    key: "personnel",
    name: "Personnel",
    icon: <FiUsers />,
    submodules: [
      {
        key: "personnels",
        name: "Personnels",
        path: "/personnel/personnels",
        permission: "PE.PERSONNELS.MENUACTION",
        elements: <PersonnelsIndex />
      },
      {
        key: "enseignants",
        name: "Enseignants",
        path: "/personnel/enseignants",
        permission: "PE.ENSEIGNANTS.MENUACTION",
        elements: <EnseignantsIndex />
      },
      {
        key: "departements",
        name: "Départements",
        path: "/personnel/departements",
        permission: "PE.DEPARTEMENTS.MENUACTION",
        elements: <DepartementIndex />
      },
    ],
  }
