import { FiBarChart2, FiList, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../../components/components.build";
import { menuItem, withAccess } from "../../../../../components/accessComponent";

export const presenceEleveComponents: ComponentIdentifierType[] = [
  { id: "PR.PRESENCESELEVES.MENUACTION", name: "Presences eleves - menu action", component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />) },
  { id: "PR.PRESENCESELEVES.MENUACTION.DASHBOARD", name: "Presences eleves - dashboard", component: menuItem(FiBarChart2, "Dashboard") },
  { id: "PR.PRESENCESELEVES.MENUACTION.LIST", name: "Presences eleves - liste", component: menuItem(FiList, "Liste") },
  { id: "PR.PRESENCESELEVES.MENUACTION.PARAMETRE", name: "Presences eleves - parametre", component: menuItem(FiSettings, "Parametre") },
  { id: "PR.PRESENCESELEVES.MENUACTION.ADD", name: "Presences eleves - ajouter", component: menuItem(FiPlus, "Ajouter") },
];
