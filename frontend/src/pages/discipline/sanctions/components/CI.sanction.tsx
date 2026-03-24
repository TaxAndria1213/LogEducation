import { FiBarChart2, FiList, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import type { ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const sanctionDisciplinaireComponents: ComponentIdentifierType[] = [
  { id: "DI.SANCTIONS.MENUACTION", name: "Sanctions - menu action", component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />) },
  { id: "DI.SANCTIONS.MENUACTION.DASHBOARD", name: "Sanctions - dashboard", component: menuItem(FiBarChart2, "Dashboard") },
  { id: "DI.SANCTIONS.MENUACTION.LIST", name: "Sanctions - liste", component: menuItem(FiList, "Liste") },
  { id: "DI.SANCTIONS.MENUACTION.PARAMETRE", name: "Sanctions - parametre", component: menuItem(FiSettings, "Parametre") },
  { id: "DI.SANCTIONS.MENUACTION.ADD", name: "Sanctions - ajouter", component: menuItem(FiPlus, "Ajouter") },
];
