import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { menu } from "../../types/types";
import { faChalkboardTeacher } from "@fortawesome/free-solid-svg-icons";
import MatieresIndex from "../../pages/pedagogie/matieres/MatieresIndex";
import ProgrammesIndex from "../../pages/pedagogie/programmes/ProgrammesIndex";
import CoursIndex from "../../pages/pedagogie/cours/CoursIndex";
import EvaluationsIndex from "../../pages/pedagogie/evaluations/EvaluationsIndex";
import NotesIndex from "../../pages/pedagogie/notes/NotesIndex";
import BulletinsIndex from "../../pages/pedagogie/bulletins/BulletinsIndex";
import ReglesNotesIndex from "../../pages/pedagogie/regles_notes/ReglesNotesIndex";

export const pedagogie: menu = {
    key: "pedagogie",
    name: "Pédagogie",
    icon: <FontAwesomeIcon icon={faChalkboardTeacher} />,
    submodules: [
      {
        key: "matieres",
        name: "Matières",
        path: "/pedagogie/matieres",
        elements: <MatieresIndex />,
      },
      {
        key: "programmes",
        name: "Programmes",
        path: "/pedagogie/programmes",
        elements: <ProgrammesIndex />,
      },
      {
        key: "cours",
        name: "Cours",
        path: "/pedagogie/cours",
        elements: <CoursIndex />,
      },
      {
        key: "evaluations",
        name: "Evaluations",
        path: "/pedagogie/evaluations",
        elements: <EvaluationsIndex />,
      },
      {
        key: "notes",
        name: "Notes",
        path: "/pedagogie/notes",
        elements: <NotesIndex />,
      },
      {
        key: "bulletins",
        name: "Bulletins",
        path: "/pedagogie/bulletins",
        elements: <BulletinsIndex />,
      },
      {
        key: "regles_notes",
        name: "Règles de notes",
        path: "/pedagogie/regles_notes",
        elements: <ReglesNotesIndex />,
      },
    ],
  }
