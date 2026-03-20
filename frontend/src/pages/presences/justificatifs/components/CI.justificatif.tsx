import { FiBarChart2, FiList, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const justificatifAbsenceComponents: ComponentIdentifierType[] = [
  { id: "PR.JUSTIFICATIFS.MENUACTION", name: "Justificatifs - menu action", component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />) },
  { id: "PR.JUSTIFICATIFS.MENUACTION.DASHBOARD", name: "Justificatifs - dashboard", component: menuItem(FiBarChart2, "Dashboard") },
  { id: "PR.JUSTIFICATIFS.MENUACTION.LIST", name: "Justificatifs - liste", component: menuItem(FiList, "Liste") },
  { id: "PR.JUSTIFICATIFS.MENUACTION.PARAMETRE", name: "Justificatifs - parametre", component: menuItem(FiSettings, "Motifs") },
  { id: "PR.JUSTIFICATIFS.MENUACTION.ADD", name: "Justificatifs - ajouter", component: menuItem(FiPlus, "Ajouter") },
];
