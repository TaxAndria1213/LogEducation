import { FiBarChart2, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const utilisateurComponents: ComponentIdentifierType[] = [
  {
    id: "CS.UTILISATEURS.MENUACTION",
    name: "Utilisateurs - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "CS.UTILISATEURS.MENUACTION.DASHBOARD",
    name: "Utilisateurs - menu action - tableau de bord",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "CS.UTILISATEURS.MENUACTION.LIST",
    name: "Utilisateurs - menu action - list",
    component: menuItem(FiMenu, "List"),
  },
  {
    id: "CS.UTILISATEURS.MENUACTION.PARAMETRE",
    name: "Utilisateurs - menu action - paramètre",
    component: menuItem(FiSettings, "Paramètre"),
  },
  {
    id: "CS.UTILISATEURS.MENUACTION.ADD",
    name: "Utilisateurs - menu action - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
  {
    id: "CS.UTILISATEURS.MENUACTION.APPROV.LIST",
    name: "Utilisateurs - menu action - list approbation",
    component: menuItem(FiMenu, "List d'approbation"),
    adminOnly: true,
  }
];
