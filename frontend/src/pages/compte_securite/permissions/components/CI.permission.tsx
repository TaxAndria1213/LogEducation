import { FiBarChart2, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const permissionComponents: ComponentIdentifierType[] = [
  {
    id: "CS.PERMISSIONS.MENUACTION",
    name: "Permissions - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "CS.PERMISSIONS.MENUACTION.DASHBOARD",
    name: "Permissions - menu action - tableau de bord",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "CS.PERMISSIONS.MENUACTION.LIST",
    name: "Permissions - menu action - list",
    component: menuItem(FiMenu, "List"),
  },
  {
    id: "CS.PERMISSIONS.MENUACTION.PARAMETRE",
    name: "Permissions - menu action - parametre",
    component: menuItem(FiSettings, "Parametre"),
  },
  {
    id: "CS.PERMISSIONS.MENUACTION.ADD",
    name: "Permissions - menu action - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
