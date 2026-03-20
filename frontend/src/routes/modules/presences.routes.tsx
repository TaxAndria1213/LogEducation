import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { menu } from "../../types/types";
import { faCalendarCheck } from "@fortawesome/free-solid-svg-icons";
import SessionsAppelIndex from "../../pages/presences/sessions_appel/SessionsAppelIndex";
import PresencesElevesIndex from "../../pages/presences/presences_eleves/PresencesElevesIndex";
import JustificatifsIndex from "../../pages/presences/justificatifs/JustificatifsIndex";
import PresencesPersonnelIndex from "../../pages/presences/presences_personnel/PresencesPersonnelIndex";

export const presences: menu = {
  key: "presences",
  name: "Presences",
  icon: <FontAwesomeIcon icon={faCalendarCheck} />,
  submodules: [
    {
      key: "sessions_appel",
      name: "Sessions d'appel",
      path: "/presences/sessions_appel",
      elements: <SessionsAppelIndex />,
    },
    {
      key: "presences_eleves",
      name: "Presences eleves",
      path: "/presences/presences_eleves",
      elements: <PresencesElevesIndex />,
    },
    {
      key: "justificatifs",
      name: "Justificatifs",
      path: "/presences/justificatifs",
      elements: <JustificatifsIndex />,
    },
    {
      key: "presences_personnel",
      name: "Presences personnel",
      path: "/presences/presences_personnel",
      elements: <PresencesPersonnelIndex />,
    },
  ],
};
