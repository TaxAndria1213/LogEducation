import { FiBarChart2, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const profileEtablissementComponents: ComponentIdentifierType[] = [
  {
    id: "ET.PROFILE.MENUACTION",
    name: "Etablissement - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
    adminOnly: true,
  },
  {
    id: "ET.PROFILE.MENUACTION.DASHBOARD",
    name: "Etablissement - menu action - tableau de bord",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "ET.PROFILE.MENUACTION.LIST",
    name: "Etablissement - menu action - list",
    component: menuItem(FiMenu, "List"),
    adminOnly: true,
  },
  {
    id: "ET.PROFILE.MENUACTION.PARAMETRE",
    name: "Etablissement - menu action - paramètre",
    component: menuItem(FiSettings, "Paramètre"),
    adminOnly: true,
  },
  {
    id: "ET.PROFILE.MENUACTION.ADD",
    name: "Etablissement - menu action - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
    adminOnly: true,
  },
];
