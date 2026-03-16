import { FiBarChart2, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const enseignantComponents: ComponentIdentifierType[] = [
  {
    id: "PE.ENSEIGNANTS.MENUACTION",
    name: "Enseignants - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "PE.ENSEIGNANTS.MENUACTION.DASHBOARD",
    name: "Enseignants - menu action - tableau de bord",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "PE.ENSEIGNANTS.MENUACTION.LIST",
    name: "Enseignants - menu action - liste",
    component: menuItem(FiMenu, "Liste"),
  },
  {
    id: "PE.ENSEIGNANTS.MENUACTION.PARAMETRE",
    name: "Enseignants - menu action - paramètre",
    component: menuItem(FiSettings, "Paramètre"),
  },
  {
    id: "PE.ENSEIGNANTS.MENUACTION.ADD",
    name: "Enseignants - menu action - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
