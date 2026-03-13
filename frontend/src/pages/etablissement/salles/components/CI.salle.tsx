import { FiBarChart2, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const salleComponents: ComponentIdentifierType[] = [
  {
    id: "ET.SALLES.MENUACTION",
    name: "Salles - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "ET.SALLES.MENUACTION.DASHBOARD",
    name: "Salles - menu action - tableau de bord",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "ET.SALLES.MENUACTION.LIST",
    name: "Salles - menu action - list",
    component: menuItem(FiMenu, "List"),
  },
  {
    id: "ET.SALLES.MENUACTION.PARAMETRE",
    name: "Salles - menu action - paramètre",
    component: menuItem(FiSettings, "Paramètre"),
  },
  {
    id: "ET.SALLES.MENUACTION.ADD",
    name: "Salles - menu action - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
