import { FiBarChart2, FiCreditCard, FiList, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import type { ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const paiementComponents: ComponentIdentifierType[] = [
  {
    id: "FIN.PAIEMENTS.MENUACTION",
    name: "Paiements - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "FIN.PAIEMENTS.MENUACTION.DASHBOARD",
    name: "Paiements - dashboard",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "FIN.PAIEMENTS.MENUACTION.LIST",
    name: "Paiements - liste",
    component: menuItem(FiList, "Liste"),
  },
  {
    id: "FIN.PAIEMENTS.MENUACTION.PARAMETRE",
    name: "Paiements - parametre",
    component: menuItem(FiSettings, "Parametre"),
  },
  {
    id: "FIN.PAIEMENTS.MENUACTION.ADD",
    name: "Paiements - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
