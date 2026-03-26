import { FiBarChart2, FiList, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import type { ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const ressourceBibliothequeComponents: ComponentIdentifierType[] = [
  { id: "BI.RESSOURCES.MENUACTION", name: "Bibliotheque - ressources - menu action", component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />) },
  { id: "BI.RESSOURCES.MENUACTION.DASHBOARD", name: "Bibliotheque - ressources - dashboard", component: menuItem(FiBarChart2, "Dashboard") },
  { id: "BI.RESSOURCES.MENUACTION.LIST", name: "Bibliotheque - ressources - liste", component: menuItem(FiList, "Liste") },
  { id: "BI.RESSOURCES.MENUACTION.PARAMETRE", name: "Bibliotheque - ressources - parametre", component: menuItem(FiSettings, "Parametre") },
  { id: "BI.RESSOURCES.MENUACTION.ADD", name: "Bibliotheque - ressources - ajouter", component: menuItem(FiPlus, "Ajouter") },
];
