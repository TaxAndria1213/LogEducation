import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import ClasseIndex from "../../pages/scolarite/classes/ClasseIndex";
import EleveIndex from "../../pages/scolarite/eleve/EleveIndex";
import IdentifiantEleveIndex from "../../pages/scolarite/identifiant_eleve/IdEleveIndex";
import EnrollmentDraftListPage from "../../pages/scolarite/inscriptions/EnrollmentDraftListPage";
import InscriptionsIndex from "../../pages/scolarite/inscriptions/InscriptionIndex";
import NiveauIndex from "../../pages/scolarite/niveaux/NiveauIndex";
import ParentTuteurIndex from "../../pages/scolarite/parents_tuteurs/ParentTuteurIndex";
import type { menu } from "../../types/types";
import { faGraduationCap } from "@fortawesome/free-solid-svg-icons";

export const scolarite: menu = {
    key: "scolarite",
    name: "Scolarité",
    icon: <FontAwesomeIcon icon={faGraduationCap} />,
    submodules: [
      {
        key: "eleves",
        name: "Élèves",
        path: "/scolarite/eleves",
        permission: "SC.ELEVES.MENUACTION",
        elements: <EleveIndex />
      },
      //Identifiants élève
      {
        key: "identifiants_eleves",
        name: "Identifiants des élèves",
        path: "/scolarite/identifiants_eleves",
        permission: "SC.IDENTIFIANTS.MENUACTION",
        elements: <IdentifiantEleveIndex />
      },
      //Parents/tuteurs
      {
        key: "parents_tuteurs",
        name: "Parents/Tuteurs",
        path: "/scolarite/parents_tuteurs",
        permission: "SC.PARENTSTUTEURS.MENUACTION",
        elements: <ParentTuteurIndex />
      },
      //Niveaux
      {
        key: "niveaux",
        name: "Niveaux",
        path: "/scolarite/niveaux",
        permission: "SC.NIVEAUX.MENUACTION",
        elements: <NiveauIndex />
      },
      //Classes
      {
        key: "classes",
        name: "Classes",
        path: "/scolarite/classes",
        permission: "SC.CLASSES.MENUACTION",
        elements: <ClasseIndex />
      },
      //Inscriptions
      {
        key: "inscriptions",
        name: "Inscriptions",
        path: "/scolarite/inscriptions",
        permission: "SC.INSCRIPTIONS.MENUACTION",
        elements: <InscriptionsIndex />
      },
      {
        key: "inscriptions_brouillons",
        name: "Brouillons d'inscription",
        path: "/scolarite/inscriptions/brouillons",
        permission: "SC.INSCRIPTIONS.MENUACTION.DRAFTS",
        elements: <EnrollmentDraftListPage />
      },
    ],
  }
