import { FiBarChart2, FiList, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import type { ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const remiseComponents: ComponentIdentifierType[] = [
  { id: "FIN.REMISES.MENUACTION", name: "Remises - menu action", component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />) },
  { id: "FIN.REMISES.MENUACTION.DASHBOARD", name: "Remises - dashboard", component: menuItem(FiBarChart2, "Dashboard") },
  { id: "FIN.REMISES.MENUACTION.LIST", name: "Remises - liste", component: menuItem(FiList, "Liste") },
  { id: "FIN.REMISES.MENUACTION.PARAMETRE", name: "Remises - parametre", component: menuItem(FiSettings, "Parametre") },
  { id: "FIN.REMISES.MENUACTION.ADD", name: "Remises - ajouter", component: menuItem(FiPlus, "Ajouter") },
];
