import { FiBarChart2, FiList, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import type { ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const empruntBibliothequeComponents: ComponentIdentifierType[] = [
  { id: "BI.EMPRUNTS.MENUACTION", name: "Bibliotheque - emprunts - menu action", component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />) },
  { id: "BI.EMPRUNTS.MENUACTION.DASHBOARD", name: "Bibliotheque - emprunts - dashboard", component: menuItem(FiBarChart2, "Dashboard") },
  { id: "BI.EMPRUNTS.MENUACTION.LIST", name: "Bibliotheque - emprunts - liste", component: menuItem(FiList, "Liste") },
  { id: "BI.EMPRUNTS.MENUACTION.PARAMETRE", name: "Bibliotheque - emprunts - parametre", component: menuItem(FiSettings, "Parametre") },
  { id: "BI.EMPRUNTS.MENUACTION.ADD", name: "Bibliotheque - emprunts - ajouter", component: menuItem(FiPlus, "Ajouter") },
];
