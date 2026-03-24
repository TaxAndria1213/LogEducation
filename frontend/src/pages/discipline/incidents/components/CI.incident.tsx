import { FiAlertTriangle, FiBarChart2, FiList, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import type { ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const incidentDisciplinaireComponents: ComponentIdentifierType[] = [
  { id: "DI.INCIDENTS.MENUACTION", name: "Incidents - menu action", component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />) },
  { id: "DI.INCIDENTS.MENUACTION.DASHBOARD", name: "Incidents - dashboard", component: menuItem(FiBarChart2, "Dashboard") },
  { id: "DI.INCIDENTS.MENUACTION.LIST", name: "Incidents - liste", component: menuItem(FiList, "Liste") },
  { id: "DI.INCIDENTS.MENUACTION.PARAMETRE", name: "Incidents - parametre", component: menuItem(FiSettings, "Parametre") },
  { id: "DI.INCIDENTS.MENUACTION.ADD", name: "Incidents - ajouter", component: menuItem(FiPlus, "Ajouter") },
  { id: "DI.INCIDENTS.MENUACTION.FLAG", name: "Incidents - signalement", component: menuItem(FiAlertTriangle, "Signaler") },
];
