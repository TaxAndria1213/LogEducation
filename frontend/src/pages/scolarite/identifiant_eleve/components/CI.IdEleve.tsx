import { FiBarChart2, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const identifiantEleveComponents: ComponentIdentifierType[] = [
  {
    id: "SC.IDENTIFIANTS.MENUACTION",
    name: "Identifiants élève - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "SC.IDENTIFIANTS.MENUACTION.DASHBOARD",
    name: "Identifiants élève - menu action - tableau de bord",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "SC.IDENTIFIANTS.MENUACTION.LIST",
    name: "Identifiants élève - menu action - list",
    component: menuItem(FiMenu, "List"),
  },
  {
    id: "SC.IDENTIFIANTS.MENUACTION.PARAMETRE",
    name: "Identifiants élève - menu action - paramètre",
    component: menuItem(FiSettings, "Paramètre"),
  },
  {
    id: "SC.IDENTIFIANTS.MENUACTION.ADD",
    name: "Identifiants élève - menu action - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
