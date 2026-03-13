import { FiBarChart2, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const inscriptionComponents: ComponentIdentifierType[] = [
  {
    id: "SC.INSCRIPTIONS.MENUACTION",
    name: "Inscriptions - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "SC.INSCRIPTIONS.MENUACTION.DASHBOARD",
    name: "Inscriptions - menu action - tableau de bord",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "SC.INSCRIPTIONS.MENUACTION.LIST",
    name: "Inscriptions - menu action - list",
    component: menuItem(FiMenu, "List"),
  },
  {
    id: "SC.INSCRIPTIONS.MENUACTION.PARAMETRE",
    name: "Inscriptions - menu action - paramètre",
    component: menuItem(FiSettings, "Paramètre"),
  },
  {
    id: "SC.INSCRIPTIONS.MENUACTION.ADD",
    name: "Inscriptions - menu action - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
