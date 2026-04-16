import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import AnneeScolaireIndex from "../../pages/etablissement/anneeScolaire/AnneeScolaireIndex";
import InitialisationEtablissementIndex from "../../pages/etablissement/initialisation/InitialisationEtablissementIndex";
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
      elements: <ProfileEtablissementIndex />,
    },
    {
      key: "initialisation",
      name: "Initialisation",
      path: "/etablissement/initialisation",
      elements: <InitialisationEtablissementIndex />,
    },
    {
      key: "sites",
      name: "Sites",
      path: "/etablissement/sites",
      elements: <SitesIndex />,
    },
    {
      key: "salles",
      name: "Salles",
      path: "/etablissement/salles",
      elements: <SalleIndex />,
    },
    {
      key: "annee_scolaire",
      name: "Année scolaire",
      path: "/etablissement/annee_scolaire",
      elements: <AnneeScolaireIndex />,
    },
    {
      key: "periodes",
      name: "Périodes",
      path: "/etablissement/periodes",
      elements: <PeriodeIndex />,
    },
    {
      key: "referentiels",
      name: "Référentiels",
      path: "/etablissement/referentiels",
      elements: <ReferentielsIndex />,
    },
  ],
};
