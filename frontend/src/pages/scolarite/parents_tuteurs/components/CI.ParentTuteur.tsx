import { FiBarChart2, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const parentTuteurComponents: ComponentIdentifierType[] = [
  {
    id: "SC.PARENTSTUTEURS.MENUACTION",
    name: "Parent/Tuteur - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "SC.PARENTSTUTEURS.MENUACTION.DASHBOARD",
    name: "Parent/Tuteur - menu action - tableau de bord",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "SC.PARENTSTUTEURS.MENUACTION.LIST",
    name: "Parent/Tuteur - menu action - list",
    component: menuItem(FiMenu, "List"),
  },
  {
    id: "SC.PARENTSTUTEURS.MENUACTION.PARAMETRE",
    name: "Parent/Tuteur - menu action - paramètre",
    component: menuItem(FiSettings, "Paramètre"),
  },
  {
    id: "SC.PARENTSTUTEURS.MENUACTION.ADD",
    name: "Parent/Tuteur - menu action - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
