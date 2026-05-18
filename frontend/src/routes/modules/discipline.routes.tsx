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
      permission: "DI.INCIDENTS.MENUACTION",
      elements: <IncidentsIndex />,
    },
    {
      key: "sanctions",
      name: "Sanctions",
      path: "/discipline/sanctions",
      permission: "DI.SANCTIONS.MENUACTION",
      elements: <SanctionsIndex />,
    },
    {
      key: "recompenses",
      name: "Recompenses",
      path: "/discipline/recompenses",
      permission: "DI.RECOMPENSES.MENUACTION",
      elements: <RecompensesIndex />,
    },
  ],
};
