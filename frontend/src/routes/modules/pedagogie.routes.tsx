import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { menu } from "../../types/types";
import { faChalkboardTeacher } from "@fortawesome/free-solid-svg-icons";

export const pedagogie: menu = {
    key: "pedagogie",
    name: "Pédagogie",
    icon: <FontAwesomeIcon icon={faChalkboardTeacher} />,
    submodules: [
      {
        key: "matieres",
        name: "Matières",
        path: "/pedagogie/matieres",
      },
      {
        key: "programmes",
        name: "Programmes",
        path: "/pedagogie/programmes",
      },
      {
        key: "cours",
        name: "Cours",
        path: "/pedagogie/cours",
      },
      {
        key: "evaluations",
        name: "Évaluations",
        path: "/pedagogie/evaluations",
      },
      {
        key: "notes",
        name: "Notes",
        path: "/pedagogie/notes",
      },
      {
        key: "bulletins",
        name: "Bulletins",
        path: "/pedagogie/bulletins",
      },
      {
        key: "regles_notes",
        name: "Règles de notes",
        path: "/pedagogie/regles_notes",
      },
    ],
  }