import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChalkboardTeacher } from "@fortawesome/free-solid-svg-icons";
import type { menu } from "../../types/types";
import PedagogieInitialisationIndex from "../../pages/pedagogie/initialisation/PedagogieInitialisationIndex";
import PedagogicalStructureIndex from "../../pages/pedagogie/structure_pedagogique/PedagogicalStructureIndex";
import MatieresIndex from "../../pages/pedagogie/matieres/MatieresIndex";
import TypesEvaluationsIndex from "../../pages/pedagogie/types_evaluations/TypesEvaluationsIndex";
import ProgrammesIndex from "../../pages/pedagogie/programmes/ProgrammesIndex";
import CoursIndex from "../../pages/pedagogie/cours/CoursIndex";
import EvaluationsIndex from "../../pages/pedagogie/evaluations/EvaluationsIndex";
import NotesIndex from "../../pages/pedagogie/notes/NotesIndex";
import BulletinsIndex from "../../pages/pedagogie/bulletins/BulletinsIndex";
import ModelesBulletinsIndex from "../../pages/pedagogie/modeles_bulletins/ModelesBulletinsIndex";
import ReglesNotesIndex from "../../pages/pedagogie/regles_notes/ReglesNotesIndex";

export const pedagogie: menu = {
  key: "pedagogie",
  name: "Pedagogie",
  icon: <FontAwesomeIcon icon={faChalkboardTeacher} />,
  submodules: [
    {
      key: "initialisation",
      name: "Initialisation",
      path: "/pedagogie/initialisation",
      elements: <PedagogieInitialisationIndex />,
    },
    {
      key: "structure_pedagogique",
      name: "Structure pedagogique",
      path: "/pedagogie/structure_pedagogique",
      elements: <PedagogicalStructureIndex />,
    },
    {
      key: "matieres",
      name: "Matieres",
      path: "/pedagogie/matieres",
      elements: <MatieresIndex />,
    },
    {
      key: "types_evaluations",
      name: "Types d'evaluation",
      path: "/pedagogie/types_evaluations",
      elements: <TypesEvaluationsIndex />,
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
      key: "modeles_bulletins",
      name: "Modeles de bulletin",
      path: "/pedagogie/modeles_bulletins",
      elements: <ModelesBulletinsIndex />,
    },
    {
      key: "regles_notes",
      name: "Regles de notes",
      path: "/pedagogie/regles_notes",
      elements: <ReglesNotesIndex />,
    },
  ],
};
