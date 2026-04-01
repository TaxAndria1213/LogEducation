import { FiBarChart2, FiMenu } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import type { ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const recouvrementComponents: ComponentIdentifierType[] = [
  {
    id: "FIN.RECOUVREMENT.MENUACTION",
    name: "Recouvrement - menu action",
    component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />),
  },
  {
    id: "FIN.RECOUVREMENT.MENUACTION.DASHBOARD",
    name: "Recouvrement - dashboard",
    component: menuItem(FiBarChart2, "Vue"),
  },
];
