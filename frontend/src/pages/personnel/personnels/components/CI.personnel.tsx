import { FiBarChart2, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const personnelComponents: ComponentIdentifierType[] = [
  {
    id: "PE.PERSONNELS.MENUACTION",
    name: "Personnels - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "PE.PERSONNELS.MENUACTION.DASHBOARD",
    name: "Personnels - menu action - tableau de bord",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "PE.PERSONNELS.MENUACTION.LIST",
    name: "Personnels - menu action - liste",
    component: menuItem(FiMenu, "Liste"),
  },
  {
    id: "PE.PERSONNELS.MENUACTION.PARAMETRE",
    name: "Personnels - menu action - paramètre",
    component: menuItem(FiSettings, "Paramètre"),
  },
  {
    id: "PE.PERSONNELS.MENUACTION.ADD",
    name: "Personnels - menu action - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
