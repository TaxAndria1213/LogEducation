import { FiBarChart2, FiList, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import type { ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const catalogueFraisComponents: ComponentIdentifierType[] = [
  { id: "FIN.CATALOGUEFRAIS.MENUACTION", name: "Catalogue de frais - menu action", component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />) },
  { id: "FIN.CATALOGUEFRAIS.MENUACTION.DASHBOARD", name: "Catalogue de frais - dashboard", component: menuItem(FiBarChart2, "Dashboard") },
  { id: "FIN.CATALOGUEFRAIS.MENUACTION.LIST", name: "Catalogue de frais - liste", component: menuItem(FiList, "Liste") },
  { id: "FIN.CATALOGUEFRAIS.MENUACTION.PARAMETRE", name: "Catalogue de frais - parametre", component: menuItem(FiSettings, "Parametre") },
  { id: "FIN.CATALOGUEFRAIS.MENUACTION.ADD", name: "Catalogue de frais - ajouter", component: menuItem(FiPlus, "Ajouter") },
];
