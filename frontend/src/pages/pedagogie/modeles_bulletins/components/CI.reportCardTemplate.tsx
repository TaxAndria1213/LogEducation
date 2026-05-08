import { FiBarChart2, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const reportCardTemplateComponents: ComponentIdentifierType[] = [
  {
    id: "PD.MODELESBULLETINS.MENUACTION",
    name: "Modeles de bulletin - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "PD.MODELESBULLETINS.MENUACTION.DASHBOARD",
    name: "Modeles de bulletin - menu action - tableau de bord",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "PD.MODELESBULLETINS.MENUACTION.LIST",
    name: "Modeles de bulletin - menu action - liste",
    component: menuItem(FiMenu, "Liste"),
  },
  {
    id: "PD.MODELESBULLETINS.MENUACTION.PARAMETRE",
    name: "Modeles de bulletin - menu action - parametre",
    component: menuItem(FiSettings, "Parametre"),
  },
  {
    id: "PD.MODELESBULLETINS.MENUACTION.ADD",
    name: "Modeles de bulletin - menu action - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
