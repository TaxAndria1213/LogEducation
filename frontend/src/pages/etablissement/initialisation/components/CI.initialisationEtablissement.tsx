import { FiBarChart2, FiList, FiMenu, FiPlayCircle, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const initialisationEtablissementComponents: ComponentIdentifierType[] = [
  {
    id: "ET.INIT.MENUACTION",
    name: "Initialisation etablissement - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "ET.INIT.MENUACTION.DASHBOARD",
    name: "Initialisation etablissement - menu action - dashboard",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "ET.INIT.MENUACTION.LIST",
    name: "Initialisation etablissement - menu action - historique",
    component: menuItem(FiList, "Historique"),
  },
  {
    id: "ET.INIT.MENUACTION.PARAMETRE",
    name: "Initialisation etablissement - menu action - modeles",
    component: menuItem(FiSettings, "Modeles"),
  },
  {
    id: "ET.INIT.MENUACTION.ADD",
    name: "Initialisation etablissement - menu action - commencer",
    component: menuItem(FiPlayCircle, "Commencer"),
  },
];
