import { FiBarChart2, FiList, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const presencePersonnelComponents: ComponentIdentifierType[] = [
  { id: "PR.PRESENCESPERSONNEL.MENUACTION", name: "Presences personnel - menu action", component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />) },
  { id: "PR.PRESENCESPERSONNEL.MENUACTION.DASHBOARD", name: "Presences personnel - dashboard", component: menuItem(FiBarChart2, "Dashboard") },
  { id: "PR.PRESENCESPERSONNEL.MENUACTION.LIST", name: "Presences personnel - liste", component: menuItem(FiList, "Liste") },
  { id: "PR.PRESENCESPERSONNEL.MENUACTION.PARAMETRE", name: "Presences personnel - parametre", component: menuItem(FiSettings, "Parametre") },
  { id: "PR.PRESENCESPERSONNEL.MENUACTION.ADD", name: "Presences personnel - ajouter", component: menuItem(FiPlus, "Ajouter") },
];
