import { FiFile } from "react-icons/fi";
import type { menu } from "../../types/types";
import DocumentTypesInscriptionPage from "../../pages/documents/types_inscription/DocumentTypesInscriptionPage";

export const documents: menu = {
  key: "documents",
  name: "Documents",
  icon: <FiFile />,
  submodules: [
    {
      key: "types_documents_inscription",
      name: "Types d'inscription",
      path: "/documents/types-inscription",
      permission: "DOC.INSCRIPTIONTYPES.PAGE",
      elements: <DocumentTypesInscriptionPage />,
    },
    {
      key: "fichiers",
      name: "Fichiers",
      path: "/documents/fichiers",
    },
    {
      key: "liens_fichiers",
      name: "Liens fichiers",
      path: "/documents/liens_fichiers",
    },
  ],
};
