import { FiBarChart2, FiCalendar, FiList, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import type { ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const planPaiementComponents: ComponentIdentifierType[] = [
  {
    id: "FIN.PLANSPAIEMENT.MENUACTION",
    name: "Plans de paiement - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "FIN.PLANSPAIEMENT.MENUACTION.DASHBOARD",
    name: "Plans de paiement - dashboard",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "FIN.PLANSPAIEMENT.MENUACTION.LIST",
    name: "Plans de paiement - liste",
    component: menuItem(FiList, "Liste"),
  },
  {
    id: "FIN.PLANSPAIEMENT.MENUACTION.PARAMETRE",
    name: "Plans de paiement - parametre",
    component: menuItem(FiSettings, "Parametre"),
  },
  {
    id: "FIN.PLANSPAIEMENT.MENUACTION.ADD",
    name: "Plans de paiement - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
