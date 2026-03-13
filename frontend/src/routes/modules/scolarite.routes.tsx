import ClasseIndex from "../../pages/scolarite/classes/ClasseIndex";
import EleveIndex from "../../pages/scolarite/eleve/EleveIndex";
import IdentifiantEleveIndex from "../../pages/scolarite/identifiant_eleve/IdEleveIndex";
import InscriptionsIndex from "../../pages/scolarite/inscriptions/InscriptionIndex";
import NiveauIndex from "../../pages/scolarite/niveaux/NiveauIndex";
import ParentTuteurIndex from "../../pages/scolarite/parents_tuteurs/ParentTuteurIndex";
import type { menu } from "../../types/types";

export const scolarite: menu = {
    key: "scolarite",
    name: "Scolarité",
    submodules: [
      {
        key: "eleves",
        name: "Élèves",
        path: "/scolarite/eleves",
        elements: <EleveIndex />
      },
      //Identifiants élève
      {
        key: "identifiants_eleves",
        name: "Identifiants des élèves",
        path: "/scolarite/identifiants_eleves",
        elements: <IdentifiantEleveIndex />
      },
      //Parents/tuteurs
      {
        key: "parents_tuteurs",
        name: "Parents/Tuteurs",
        path: "/scolarite/parents_tuteurs",
        elements: <ParentTuteurIndex />
      },
      //Niveaux
      {
        key: "niveaux",
        name: "Niveaux",
        path: "/scolarite/niveaux",
        elements: <NiveauIndex />
      },
      //Classes
      {
        key: "classes",
        name: "Classes",
        path: "/scolarite/classes",
        elements: <ClasseIndex />
      },
      //Inscriptions
      {
        key: "inscriptions",
        name: "Inscriptions",
        path: "/scolarite/inscriptions",
        elements: <InscriptionsIndex />
      },
    ],
  }