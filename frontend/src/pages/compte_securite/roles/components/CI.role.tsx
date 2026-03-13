import { FiBarChart2, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const roleComponents: ComponentIdentifierType[] = [
  {
    id: "CS.ROLES.MENUACTION",
    name: "Roles - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "CS.ROLES.MENUACTION.DASHBOARD",
    name: "Roles - menu action - tableau de bord",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "CS.ROLES.MENUACTION.LIST",
    name: "Roles - menu action - list",
    component: menuItem(FiMenu, "List"),
  },
  {
    id: "CS.ROLES.MENUACTION.PARAMETRE",
    name: "Roles - menu action - paramètre",
    component: menuItem(FiSettings, "Paramètre"),
  },
  {
    id: "CS.ROLES.MENUACTION.ADD",
    name: "Roles - menu action - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
