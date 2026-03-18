import { FiCalendar, FiList, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../components/components.build";
import { menuItem, withAccess } from "../../../components/accessComponent";

export const evenementCalendrierComponents: ComponentIdentifierType[] = [
  {
    id: "EDT.EVENEMENTS.MENUACTION",
    name: "Evenements - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "EDT.EVENEMENTS.MENUACTION.DASHBOARD",
    name: "Evenements - dashboard",
    component: menuItem(FiCalendar, "Dashboard"),
  },
  {
    id: "EDT.EVENEMENTS.MENUACTION.LIST",
    name: "Evenements - liste",
    component: menuItem(FiList, "Liste"),
  },
  {
    id: "EDT.EVENEMENTS.MENUACTION.PARAMETRE",
    name: "Evenements - parametre",
    component: menuItem(FiSettings, "Parametre"),
  },
  {
    id: "EDT.EVENEMENTS.MENUACTION.ADD",
    name: "Evenements - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
