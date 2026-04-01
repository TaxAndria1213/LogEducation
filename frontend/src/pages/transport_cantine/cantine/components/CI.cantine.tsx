import { FiBarChart2, FiList, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import type { ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const cantineComponents: ComponentIdentifierType[] = [
  { id: "TC.CANTINE.MENUACTION", name: "Cantine - menu action", component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />) },
  { id: "TC.CANTINE.MENUACTION.DASHBOARD", name: "Cantine - dashboard", component: menuItem(FiBarChart2, "Dashboard") },
  { id: "TC.CANTINE.MENUACTION.LIST", name: "Cantine - liste", component: menuItem(FiList, "Liste") },
  { id: "TC.CANTINE.MENUACTION.PARAMETRE", name: "Cantine - parametre", component: menuItem(FiSettings, "Parametre") },
  { id: "TC.CANTINE.MENUACTION.ADD", name: "Cantine - ajouter", component: menuItem(FiPlus, "Ajouter") },
];
