import { FiBarChart2, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const typeEvaluationRefComponents: ComponentIdentifierType[] = [
  {
    id: "PD.TYPESEVALUATIONS.MENUACTION",
    name: "Types d'evaluation - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "PD.TYPESEVALUATIONS.MENUACTION.DASHBOARD",
    name: "Types d'evaluation - menu action - tableau de bord",
    component: menuItem(FiBarChart2, "Dashboard"),
  },
  {
    id: "PD.TYPESEVALUATIONS.MENUACTION.LIST",
    name: "Types d'evaluation - menu action - liste",
    component: menuItem(FiMenu, "Liste"),
  },
  {
    id: "PD.TYPESEVALUATIONS.MENUACTION.PARAMETRE",
    name: "Types d'evaluation - menu action - parametre",
    component: menuItem(FiSettings, "Parametre"),
  },
  {
    id: "PD.TYPESEVALUATIONS.MENUACTION.ADD",
    name: "Types d'evaluation - menu action - ajouter",
    component: menuItem(FiPlus, "Ajouter"),
  },
];
