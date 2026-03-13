// import IconButton from "../../../components/actions/IconButton";
import { type ComponentIdentifierType } from "../../../components/components.build";

import EtablissementChoice from "./EtablissementChoice";
import IconButton from "../../../components/actions/IconButton";
import { menuItem } from "../../../components/accessComponent";



export const adminComponents: ComponentIdentifierType[] = [
  {
    id: "ADM.PROFILE.SELECT.ETABLISSEMENT",
    name: "Admin - choix d'établissement",
    component: menuItem(undefined, undefined, <EtablissementChoice />),
    adminOnly: true,
  },
  {
    id: "ADM.BARRE.SELECT.ETABLISSEMENT",
    name: "Admin - choix d'établissement dans la barre",
    component: menuItem(undefined, undefined, IconButton({ icon: "ETAB" })),
    adminOnly: true,
  },
];
