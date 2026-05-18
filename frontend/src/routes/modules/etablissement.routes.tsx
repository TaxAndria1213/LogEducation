import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import AnneeScolaireIndex from "../../pages/etablissement/anneeScolaire/AnneeScolaireIndex";
import InitialisationEtablissementIndex from "../../pages/etablissement/initialisation/InitialisationEtablissementIndex";
import NavigationConfigPage from "../../pages/etablissement/navigation/NavigationConfigPage";
import PeriodeIndex from "../../pages/etablissement/periodes/PeriodeIndex";
import ProfileEtablissementIndex from "../../pages/etablissement/profileEtablissement/ProfileEtablissementIndex";
import ReferentielsIndex from "../../pages/etablissement/referentiels/ReferentielsIndex";
import SalleIndex from "../../pages/etablissement/salles/SalleIndex";
import SitesIndex from "../../pages/etablissement/sites/SitesIndex";
import type { menu } from "../../types/types";
import { faBuilding } from "@fortawesome/free-solid-svg-icons";

export const etablissement: menu = {
  key: "etablissement",
  name: "Etablissement",
  icon: <FontAwesomeIcon icon={faBuilding} />,
  submodules: [
    {
      key: "profile_etablissement",
      name: "Profil de l'établissement",
      path: "/etablissement/profile",
      permission: "ET.PROFILE.MENUACTION",
      elements: <ProfileEtablissementIndex />,
    },
    {
      key: "initialisation",
      name: "Initialisation",
      path: "/etablissement/initialisation",
      permission: "ET.INIT.MENUACTION",
      elements: <InitialisationEtablissementIndex />,
    },
    {
      key: "sites",
      name: "Sites",
      path: "/etablissement/sites",
      permission: "ET.SITES.MENUACTION",
      elements: <SitesIndex />,
    },
    {
      key: "salles",
      name: "Salles",
      path: "/etablissement/salles",
      permission: "ET.SALLES.MENUACTION",
      elements: <SalleIndex />,
    },
    {
      key: "annee_scolaire",
      name: "Année scolaire",
      path: "/etablissement/annee_scolaire",
      permission: "ET.ANNEESCOLAIRES.MENUACTION",
      elements: <AnneeScolaireIndex />,
    },
    {
      key: "periodes",
      name: "Périodes",
      path: "/etablissement/periodes",
      permission: "ET.PERIODES.MENUACTION",
      elements: <PeriodeIndex />,
    },
    {
      key: "referentiels",
      name: "Référentiels",
      path: "/etablissement/referentiels",
      permission: "ET.REFERENTIELS.MENUACTION",
      elements: <ReferentielsIndex />,
    },
    {
      key: "navigation_config",
      name: "Configuration navigation",
      path: "/etablissement/navigation",
      elements: <NavigationConfigPage />,
    },
  ],
};
