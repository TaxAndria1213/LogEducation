import { FiBarChart2, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const noteComponents: ComponentIdentifierType[] = [
  {
    id: "PD.NOTES.MENUACTION",
    name: "Notes - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "PD.NOTES.MENUACTION.DASHBOARD",
    name: "Notes - menu action - tableau de bord",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "PD.NOTES.MENUACTION.LIST",
    name: "Notes - menu action - liste",
    component: menuItem(FiMenu, "Liste"),
  },
  {
    id: "PD.NOTES.MENUACTION.PARAMETRE",
    name: "Notes - menu action - paramètre",
    component: menuItem(FiSettings, "Paramètre"),
  },
  {
    id: "PD.NOTES.MENUACTION.ADD",
    name: "Notes - menu action - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
