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
      permissions: [
        "PD.MATIERES.MENUACTION",
        "PD.PROGRAMMES.MENUACTION",
        "PD.COURS.MENUACTION",
        "PD.REGLESNOTES.MENUACTION",
        "PD.MODELESBULLETINS.MENUACTION",
        "PD.TYPESEVALUATIONS.MENUACTION",
      ],
      elements: <PedagogieInitialisationIndex />,
    },
    {
      key: "structure_pedagogique",
      name: "Structure pedagogique",
      path: "/pedagogie/structure_pedagogique",
      permissions: [
        "PD.MATIERES.MENUACTION",
        "PD.PROGRAMMES.MENUACTION",
        "PD.MODELESBULLETINS.MENUACTION",
      ],
      elements: <PedagogicalStructureIndex />,
    },
    {
      key: "matieres",
      name: "Matieres",
      path: "/pedagogie/matieres",
      permission: "PD.MATIERES.MENUACTION",
      elements: <MatieresIndex />,
    },
    {
      key: "types_evaluations",
      name: "Types d'evaluation",
      path: "/pedagogie/types_evaluations",
      permission: "PD.TYPESEVALUATIONS.MENUACTION",
      elements: <TypesEvaluationsIndex />,
    },
    {
      key: "programmes",
      name: "Programmes",
      path: "/pedagogie/programmes",
      permission: "PD.PROGRAMMES.MENUACTION",
      elements: <ProgrammesIndex />,
    },
    {
      key: "cours",
      name: "Cours",
      path: "/pedagogie/cours",
      permission: "PD.COURS.MENUACTION",
      elements: <CoursIndex />,
    },
    {
      key: "evaluations",
      name: "Evaluations",
      path: "/pedagogie/evaluations",
      permission: "PD.EVALUATIONS.MENUACTION",
      elements: <EvaluationsIndex />,
    },
    {
      key: "notes",
      name: "Notes",
      path: "/pedagogie/notes",
      permission: "PD.NOTES.MENUACTION",
      elements: <NotesIndex />,
    },
    {
      key: "bulletins",
      name: "Bulletins",
      path: "/pedagogie/bulletins",
      permission: "PD.BULLETINS.MENUACTION",
      elements: <BulletinsIndex />,
    },
    {
      key: "modeles_bulletins",
      name: "Modeles de bulletin",
      path: "/pedagogie/modeles_bulletins",
      permission: "PD.MODELESBULLETINS.MENUACTION",
      elements: <ModelesBulletinsIndex />,
    },
    {
      key: "regles_notes",
      name: "Regles de notes",
      path: "/pedagogie/regles_notes",
      permission: "PD.REGLESNOTES.MENUACTION",
      elements: <ReglesNotesIndex />,
    },
  ],
};
