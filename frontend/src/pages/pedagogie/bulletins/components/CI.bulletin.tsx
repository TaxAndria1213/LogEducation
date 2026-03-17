import { FiBarChart2, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const bulletinComponents: ComponentIdentifierType[] = [
  {
    id: "PD.BULLETINS.MENUACTION",
    name: "Bulletins - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "PD.BULLETINS.MENUACTION.DASHBOARD",
    name: "Bulletins - menu action - tableau de bord",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "PD.BULLETINS.MENUACTION.LIST",
    name: "Bulletins - menu action - liste",
    component: menuItem(FiMenu, "Liste"),
  },
  {
    id: "PD.BULLETINS.MENUACTION.PARAMETRE",
    name: "Bulletins - menu action - paramètre",
    component: menuItem(FiSettings, "Paramètre"),
  },
  {
    id: "PD.BULLETINS.MENUACTION.ADD",
    name: "Bulletins - menu action - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
