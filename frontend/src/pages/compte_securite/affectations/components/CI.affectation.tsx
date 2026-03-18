import { FiBarChart2, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const affectationComponents: ComponentIdentifierType[] = [
  {
    id: "CS.AFFECTATIONS.MENUACTION",
    name: "Affectations - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "CS.AFFECTATIONS.MENUACTION.DASHBOARD",
    name: "Affectations - menu action - tableau de bord",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "CS.AFFECTATIONS.MENUACTION.LIST",
    name: "Affectations - menu action - roles permissions",
    component: menuItem(FiMenu, "Roles / permissions"),
  },
  {
    id: "CS.AFFECTATIONS.MENUACTION.ADD",
    name: "Affectations - menu action - utilisateurs roles scope",
    component: menuItem(FiPlus, "Utilisateurs / scope"),
  },
  {
    id: "CS.AFFECTATIONS.MENUACTION.PARAMETRE",
    name: "Affectations - menu action - parametre",
    component: menuItem(FiSettings, "Parametre"),
  },
];
