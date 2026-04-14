import { FiBarChart2 } from "react-icons/fi";
import { type ComponentIdentifierType } from "../../../../components/components.build";
import { menuItem } from "../../../../components/accessComponent";

export const profileEtablissementComponents: ComponentIdentifierType[] = [
  {
    id: "ET.PROFILE.MENUACTION.DASHBOARD",
    name: "Etablissement - profil proprietaire - vue globale",
    component: menuItem(FiBarChart2, "Profil"),
  },
];
