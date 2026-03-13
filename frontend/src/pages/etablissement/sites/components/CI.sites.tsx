import { FiBarChart2, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const siteComponents: ComponentIdentifierType[] = [
  {
    id: "ET.SITES.MENUACTION",
    name: "Sites - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "ET.SITES.MENUACTION.DASHBOARD",
    name: "Sites - menu action - tableau de bord",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "ET.SITES.MENUACTION.LIST",
    name: "Sites - menu action - list",
    component: menuItem(FiMenu, "List"),
  },
  {
    id: "ET.SITES.MENUACTION.PARAMETRE",
    name: "Sites - menu action - paramètre",
    component: menuItem(FiSettings, "Paramètre"),
  },
  {
    id: "ET.SITES.MENUACTION.ADD",
    name: "Sites - menu action - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
