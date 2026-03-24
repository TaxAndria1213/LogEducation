import { FiBarChart2, FiFileText, FiList, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import type { ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const factureComponents: ComponentIdentifierType[] = [
  {
    id: "FIN.FACTURES.MENUACTION",
    name: "Factures - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "FIN.FACTURES.MENUACTION.DASHBOARD",
    name: "Factures - dashboard",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "FIN.FACTURES.MENUACTION.LIST",
    name: "Factures - liste",
    component: menuItem(FiList, "Liste"),
  },
  {
    id: "FIN.FACTURES.MENUACTION.PARAMETRE",
    name: "Factures - parametre",
    component: menuItem(FiSettings, "Parametre"),
  },
  {
    id: "FIN.FACTURES.MENUACTION.ADD",
    name: "Factures - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
