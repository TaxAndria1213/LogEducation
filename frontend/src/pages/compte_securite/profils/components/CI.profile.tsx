import { FiBarChart2, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const profileComponents: ComponentIdentifierType[] = [
  {
    id: "CS.PROFILS.MENUACTION",
    name: "Profils - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "CS.PROFILS.MENUACTION.DASHBOARD",
    name: "Profils - menu action - tableau de bord",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "CS.PROFILS.MENUACTION.LIST",
    name: "Profils - menu action - list",
    component: menuItem(FiMenu, "List"),
  },
  {
    id: "CS.PROFILS.MENUACTION.PARAMETRE",
    name: "Profils - menu action - parametre",
    component: menuItem(FiSettings, "Parametre"),
  },
  {
    id: "CS.PROFILS.MENUACTION.ADD",
    name: "Profils - menu action - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
