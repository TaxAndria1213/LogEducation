import { FiBarChart2, FiList, FiMenu } from "react-icons/fi";
import IconButton from "../../../../components/actions/IconButton";
import type { ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem, withAccess } from "../../../../components/accessComponent";

export const journalFinancierComponents: ComponentIdentifierType[] = [
  { id: "FIN.JOURNALFINANCIER.MENUACTION", name: "Journal financier - menu action", component: withAccess(() => <IconButton icon={<FiMenu />} w={40} h={40} />) },
  { id: "FIN.JOURNALFINANCIER.MENUACTION.DASHBOARD", name: "Journal financier - dashboard", component: menuItem(FiBarChart2, "Dashboard") },
  { id: "FIN.JOURNALFINANCIER.MENUACTION.LIST", name: "Journal financier - liste", component: menuItem(FiList, "Liste") },
];
