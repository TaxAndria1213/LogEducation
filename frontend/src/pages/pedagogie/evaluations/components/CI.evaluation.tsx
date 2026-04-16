import { FiBarChart2, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const evaluationComponents: ComponentIdentifierType[] = [
  {
    id: "PD.EVALUATIONS.MENUACTION",
    name: "Evaluations - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "PD.EVALUATIONS.MENUACTION.DASHBOARD",
    name: "Evaluations - menu action - tableau de bord",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "PD.EVALUATIONS.MENUACTION.LIST",
    name: "Evaluations - menu action - liste",
    component: menuItem(FiMenu, "Liste"),
  },
  {
    id: "PD.EVALUATIONS.MENUACTION.PARAMETRE",
    name: "Evaluations - menu action - parametre",
    component: menuItem(FiSettings, "Parametre"),
  },
  {
    id: "PD.EVALUATIONS.MENUACTION.ADD",
    name: "Evaluations - menu action - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
