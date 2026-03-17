import { FiBarChart2, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const regleNoteComponents: ComponentIdentifierType[] = [
  {
    id: "PD.REGLESNOTES.MENUACTION",
    name: "Règles de notes - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "PD.REGLESNOTES.MENUACTION.DASHBOARD",
    name: "Règles de notes - menu action - tableau de bord",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "PD.REGLESNOTES.MENUACTION.LIST",
    name: "Règles de notes - menu action - liste",
    component: menuItem(FiMenu, "Liste"),
  },
  {
    id: "PD.REGLESNOTES.MENUACTION.PARAMETRE",
    name: "Règles de notes - menu action - paramètre",
    component: menuItem(FiSettings, "Paramètre"),
  },
  {
    id: "PD.REGLESNOTES.MENUACTION.ADD",
    name: "Règles de notes - menu action - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
