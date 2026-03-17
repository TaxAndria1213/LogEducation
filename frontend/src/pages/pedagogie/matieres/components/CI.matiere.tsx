import { FiBarChart2, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const matiereComponents: ComponentIdentifierType[] = [
  {
    id: "PD.MATIERES.MENUACTION",
    name: "Matières - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "PD.MATIERES.MENUACTION.DASHBOARD",
    name: "Matières - menu action - tableau de bord",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "PD.MATIERES.MENUACTION.LIST",
    name: "Matières - menu action - liste",
    component: menuItem(FiMenu, "Liste"),
  },
  {
    id: "PD.MATIERES.MENUACTION.PARAMETRE",
    name: "Matières - menu action - paramètre",
    component: menuItem(FiSettings, "Paramètre"),
  },
  {
    id: "PD.MATIERES.MENUACTION.ADD",
    name: "Matières - menu action - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
