import { FiCalendar } from "react-icons/fi";
import type { menu } from "../../types/types";

export const emploi_du_temps: menu = {
  key: "emploi_du_temps",
  name: "Emploi du temps & calendrier",
  icon: <FiCalendar />,
  submodules: [
    {
      key: "emploi_du_temps",
      name: "Emploi du temps",
      path: "/emploi_du_temps/emploi_du_temps",
    },
    {
      key: "evenements",
      name: "Événements",
      path: "/emploi_du_temps/evenements",
    },
  ],
};
