import { FiBarChart2, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const programmeComponents: ComponentIdentifierType[] = [
  {
    id: "PD.PROGRAMMES.MENUACTION",
    name: "Programmes - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "PD.PROGRAMMES.MENUACTION.DASHBOARD",
    name: "Programmes - menu action - tableau de bord",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "PD.PROGRAMMES.MENUACTION.LIST",
    name: "Programmes - menu action - liste",
    component: menuItem(FiMenu, "Liste"),
  },
  {
    id: "PD.PROGRAMMES.MENUACTION.PARAMETRE",
    name: "Programmes - menu action - paramètre",
    component: menuItem(FiSettings, "Paramètre"),
  },
  {
    id: "PD.PROGRAMMES.MENUACTION.ADD",
    name: "Programmes - menu action - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
