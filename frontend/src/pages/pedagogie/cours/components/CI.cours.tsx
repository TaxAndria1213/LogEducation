import { FiBarChart2, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const coursComponents: ComponentIdentifierType[] = [
  {
    id: "PD.COURS.MENUACTION",
    name: "Cours - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "PD.COURS.MENUACTION.DASHBOARD",
    name: "Cours - menu action - tableau de bord",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "PD.COURS.MENUACTION.LIST",
    name: "Cours - menu action - liste",
    component: menuItem(FiMenu, "Liste"),
  },
  {
    id: "PD.COURS.MENUACTION.PARAMETRE",
    name: "Cours - menu action - paramètre",
    component: menuItem(FiSettings, "Paramètre"),
  },
  {
    id: "PD.COURS.MENUACTION.ADD",
    name: "Cours - menu action - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
