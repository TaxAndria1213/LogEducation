import { FiBarChart2, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const periodeComponents: ComponentIdentifierType[] = [
  {
    id: "ET.PERIODES.MENUACTION",
    name: "Périodes - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "ET.PERIODES.MENUACTION.DASHBOARD",
    name: "Périodes - menu action - tableau de bord",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "ET.PERIODES.MENUACTION.LIST",
    name: "Périodes - menu action - list",
    component: menuItem(FiMenu, "List"),
  },
  {
    id: "ET.PERIODES.MENUACTION.PARAMETRE",
    name: "Périodes - menu action - paramètre",
    component: menuItem(FiSettings, "Paramètre"),
  },
  {
    id: "ET.PERIODES.MENUACTION.ADD",
    name: "Périodes - menu action - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
