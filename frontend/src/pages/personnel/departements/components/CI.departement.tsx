import { FiBarChart2, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const departementComponents: ComponentIdentifierType[] = [
  {
    id: "PE.DEPARTEMENTS.MENUACTION",
    name: "Départements - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "PE.DEPARTEMENTS.MENUACTION.DASHBOARD",
    name: "Départements - menu action - tableau de bord",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "PE.DEPARTEMENTS.MENUACTION.LIST",
    name: "Départements - menu action - liste",
    component: menuItem(FiMenu, "Liste"),
  },
  {
    id: "PE.DEPARTEMENTS.MENUACTION.PARAMETRE",
    name: "Départements - menu action - paramètre",
    component: menuItem(FiSettings, "Paramètre"),
  },
  {
    id: "PE.DEPARTEMENTS.MENUACTION.ADD",
    name: "Départements - menu action - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
