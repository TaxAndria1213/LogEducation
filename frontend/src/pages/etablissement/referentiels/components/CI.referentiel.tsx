import { FiBarChart2, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import type { ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const referentielComponents: ComponentIdentifierType[] = [
  {
    id: "ET.REFERENTIELS.MENUACTION",
    name: "Referentiels - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "ET.REFERENTIELS.MENUACTION.DASHBOARD",
    name: "Referentiels - menu action - tableau de bord",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "ET.REFERENTIELS.MENUACTION.LIST",
    name: "Referentiels - menu action - liste",
    component: menuItem(FiMenu, "Liste"),
  },
  {
    id: "ET.REFERENTIELS.MENUACTION.PARAMETRE",
    name: "Referentiels - menu action - parametre",
    component: menuItem(FiSettings, "Parametre"),
  },
  {
    id: "ET.REFERENTIELS.MENUACTION.ADD",
    name: "Referentiels - menu action - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
