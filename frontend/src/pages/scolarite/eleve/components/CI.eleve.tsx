import { FiBarChart2, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const eleveComponents: ComponentIdentifierType[] = [
  {
    id: "SC.ELEVES.MENUACTION",
    name: "Elèves - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "SC.ELEVES.MENUACTION.DASHBOARD",
    name: "Elèves - menu action - tableau de bord",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "SC.ELEVES.MENUACTION.LIST",
    name: "Elèves - menu action - list",
    component: menuItem(FiMenu, "List"),
  },
  {
    id: "SC.ELEVES.MENUACTION.PARAMETRE",
    name: "Elèves - menu action - paramètre",
    component: menuItem(FiSettings, "Paramètre"),
  },
  {
    id: "SC.ELEVES.MENUACTION.ADD",
    name: "Elèves - menu action - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
