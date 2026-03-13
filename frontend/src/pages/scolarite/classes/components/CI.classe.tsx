import { FiBarChart2, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const classeComponents: ComponentIdentifierType[] = [
  {
    id: "SC.CLASSES.MENUACTION",
    name: "Classes - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "SC.CLASSES.MENUACTION.DASHBOARD",
    name: "Classes - menu action - tableau de bord",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "SC.CLASSES.MENUACTION.LIST",
    name: "Classes - menu action - list",
    component: menuItem(FiMenu, "List"),
  },
  {
    id: "SC.CLASSES.MENUACTION.PARAMETRE",
    name: "Classes - menu action - paramètre",
    component: menuItem(FiSettings, "Paramètre"),
  },
  {
    id: "SC.CLASSES.MENUACTION.ADD",
    name: "Classes - menu action - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
