import { FiCalendar } from "react-icons/fi";
import type { menu } from "../../types/types";
import EmploiDuTempsIndex from "../../pages/emploi_du_temps/EmploiDuTempsIndex";
import EvenementsIndex from "../../pages/emploi_du_temps/EvenementsIndex";

export const emploi_du_temps: menu = {
  key: "emploi_du_temps",
  name: "Emploi du temps & calendrier",
  icon: <FiCalendar />,
  submodules: [
    {
      key: "emploi_du_temps",
      name: "Emploi du temps",
      path: "/emploi_du_temps/emploi_du_temps",
      elements: <EmploiDuTempsIndex />,
    },
    {
      key: "evenements",
      name: "Evenements",
      path: "/emploi_du_temps/evenements",
      elements: <EvenementsIndex />,
    },
  ],
};
