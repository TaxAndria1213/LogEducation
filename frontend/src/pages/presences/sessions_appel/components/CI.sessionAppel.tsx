import { FiBarChart2, FiList, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const sessionAppelComponents: ComponentIdentifierType[] = [
  {
    id: "PR.SESSIONSAPPEL.MENUACTION",
    name: "Sessions d'appel - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "PR.SESSIONSAPPEL.MENUACTION.DASHBOARD",
    name: "Sessions d'appel - dashboard",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "PR.SESSIONSAPPEL.MENUACTION.LIST",
    name: "Sessions d'appel - liste",
    component: menuItem(FiList, "Liste"),
  },
  {
    id: "PR.SESSIONSAPPEL.MENUACTION.PARAMETRE",
    name: "Sessions d'appel - parametre",
    component: menuItem(FiSettings, "Parametre"),
  },
  {
    id: "PR.SESSIONSAPPEL.MENUACTION.ADD",
    name: "Sessions d'appel - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
