import type { menu } from "../../types/types";

export const discipline: menu = {
  key: "discipline",
  name: "Discipline",
  submodules: [
    {
      key: "incidents",
      name: "Incidents",
      path: "/discipline/incidents",
    },
    {
      key: "sanctions",
      name: "Sanctions",
      path: "/discipline/sanctions",
    },
    {
      key: "recompenses",
      name: "Récompenses",
      path: "/discipline/recompenses",
    },
  ],
};
