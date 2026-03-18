import { FiCalendar, FiList, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../components/components.build";
import { menuItem, withAccess } from "../../../components/accessComponent";

export const emploiDuTempsComponents: ComponentIdentifierType[] = [
  {
    id: "EDT.EMPLOIDUTEMPS.MENUACTION",
    name: "Emploi du temps - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "EDT.EMPLOIDUTEMPS.MENUACTION.DASHBOARD",
    name: "Emploi du temps - dashboard",
    component: menuItem(FiCalendar, "Dashboard"),
  },
  {
    id: "EDT.EMPLOIDUTEMPS.MENUACTION.LIST",
    name: "Emploi du temps - liste",
    component: menuItem(FiList, "Liste"),
  },
  {
    id: "EDT.EMPLOIDUTEMPS.MENUACTION.PARAMETRE",
    name: "Emploi du temps - parametre",
    component: menuItem(FiSettings, "Parametre"),
  },
  {
    id: "EDT.EMPLOIDUTEMPS.MENUACTION.ADD",
    name: "Emploi du temps - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
