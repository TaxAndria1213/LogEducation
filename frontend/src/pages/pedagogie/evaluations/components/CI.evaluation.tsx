import { FiBarChart2, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const evaluationComponents: ComponentIdentifierType[] = [
  {
    id: "PD.EVALUATIONS.MENUACTION",
    name: "�valuations - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "PD.EVALUATIONS.MENUACTION.DASHBOARD",
    name: "�valuations - menu action - tableau de bord",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "PD.EVALUATIONS.MENUACTION.LIST",
    name: "�valuations - menu action - liste",
    component: menuItem(FiMenu, "Liste"),
  },
  {
    id: "PD.EVALUATIONS.MENUACTION.PARAMETRE",
    name: "�valuations - menu action - paramètre",
    component: menuItem(FiSettings, "Paramètre"),
  },
  {
    id: "PD.EVALUATIONS.MENUACTION.ADD",
    name: "�valuations - menu action - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
