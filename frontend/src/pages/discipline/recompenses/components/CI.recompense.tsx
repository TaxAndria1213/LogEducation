import { FiAward, FiBarChart2, FiList, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import type { ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const recompenseComponents: ComponentIdentifierType[] = [
  { id: "DI.RECOMPENSES.MENUACTION", name: "Recompenses - menu action", component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />) },
  { id: "DI.RECOMPENSES.MENUACTION.DASHBOARD", name: "Recompenses - dashboard", component: menuItem(FiBarChart2, "Dashboard") },
  { id: "DI.RECOMPENSES.MENUACTION.LIST", name: "Recompenses - liste", component: menuItem(FiList, "Liste") },
  { id: "DI.RECOMPENSES.MENUACTION.PARAMETRE", name: "Recompenses - parametre", component: menuItem(FiSettings, "Parametre") },
  { id: "DI.RECOMPENSES.MENUACTION.ADD", name: "Recompenses - ajouter", component: menuItem(FiPlus, "Ajouter") },
  { id: "DI.RECOMPENSES.MENUACTION.AWARD", name: "Recompenses - attribuer", component: menuItem(FiAward, "Attribuer") },
];
