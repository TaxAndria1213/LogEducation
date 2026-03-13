import { FiBarChart2, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const niveauComponents: ComponentIdentifierType[] = [
  {
    id: "SC.NIVEAUX.MENUACTION",
    name: "Niveaux - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "SC.NIVEAUX.MENUACTION.DASHBOARD",
    name: "Niveaux - menu action - tableau de bord",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "SC.NIVEAUX.MENUACTION.LIST",
    name: "Niveaux - menu action - list",
    component: menuItem(FiMenu, "List"),
  },
  {
    id: "SC.NIVEAUX.MENUACTION.PARAMETRE",
    name: "Niveaux - menu action - paramètre",
    component: menuItem(FiSettings, "Paramètre"),
  },
  {
    id: "SC.NIVEAUX.MENUACTION.ADD",
    name: "Niveaux - menu action - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
