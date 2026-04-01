import { FiBarChart2, FiList, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import type { ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const transportComponents: ComponentIdentifierType[] = [
  { id: "TC.TRANSPORT.MENUACTION", name: "Transport - menu action", component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />) },
  { id: "TC.TRANSPORT.MENUACTION.DASHBOARD", name: "Transport - dashboard", component: menuItem(FiBarChart2, "Dashboard") },
  { id: "TC.TRANSPORT.MENUACTION.LIST", name: "Transport - liste", component: menuItem(FiList, "Liste") },
  { id: "TC.TRANSPORT.MENUACTION.PARAMETRE", name: "Transport - parametre", component: menuItem(FiSettings, "Parametre") },
  { id: "TC.TRANSPORT.MENUACTION.ADD", name: "Transport - ajouter", component: menuItem(FiPlus, "Ajouter") },
];
