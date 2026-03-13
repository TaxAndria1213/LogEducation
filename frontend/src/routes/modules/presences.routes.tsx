import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { menu } from "../../types/types";
import { faCalendarCheck } from "@fortawesome/free-solid-svg-icons";

export const presences: menu = {
  key: "presences",
  name: "Présences",
  icon: <FontAwesomeIcon icon={faCalendarCheck} />,
  submodules: [
    {
      key: "sessions_appel",
      name: "Sessions d’appel",
      path: "/presences/sessions_appel",
    },
    {
      key: "presences_eleves",
      name: "Présences élèves",
      path: "/presences/presences_eleves",
    },
    {
      key: "justificatifs",
      name: "Justificatifs",
      path: "/presences/justificatifs",
    },
    {
      key: "presences_personnel",
      name: "Présences personnel",
      path: "/presences/presences_personnel",
    },
  ],
};
