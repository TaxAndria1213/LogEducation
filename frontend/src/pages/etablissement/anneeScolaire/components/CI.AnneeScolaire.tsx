import { FiBarChart2, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const anneeScolaireComponents: ComponentIdentifierType[] = [
  {
    id: "ET.ANNEESCOLAIRES.MENUACTION",
    name: "Année scolaire - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "ET.ANNEESCOLAIRES.MENUACTION.DASHBOARD",
    name: "Année scolaire - menu action - tableau de bord",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "ET.ANNEESCOLAIRES.MENUACTION.LIST",
    name: "Année scolaire - menu action - list",
    component: menuItem(FiMenu, "List"),
  },
  {
    id: "ET.ANNEESCOLAIRES.MENUACTION.PARAMETRE",
    name: "Année scolaire - menu action - paramètre",
    component: menuItem(FiSettings, "Paramètre"),
  },
  {
    id: "ET.ANNEESCOLAIRES.MENUACTION.ADD",
    name: "Année scolaire - menu action - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
