import { FiFlag } from "react-icons/fi";
import type { menu } from "../../types/types";
import IncidentsIndex from "../../pages/discipline/incidents/IncidentsIndex";
import SanctionsIndex from "../../pages/discipline/sanctions/SanctionsIndex";
import RecompensesIndex from "../../pages/discipline/recompenses/RecompensesIndex";

export const discipline: menu = {
  key: "discipline",
  name: "Discipline",
  icon: <FiFlag />,
  submodules: [
    {
      key: "incidents",
      name: "Incidents",
      path: "/discipline/incidents",
      elements: <IncidentsIndex />,
    },
    {
      key: "sanctions",
      name: "Sanctions",
      path: "/discipline/sanctions",
      elements: <SanctionsIndex />,
    },
    {
      key: "recompenses",
      name: "Recompenses",
      path: "/discipline/recompenses",
      elements: <RecompensesIndex />,
    },
  ],
};
