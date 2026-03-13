import { FiFile } from "react-icons/fi";
import type { menu } from "../../types/types";

export const documents: menu = {
  key: "documents",
  name: "Documents",
  icon: <FiFile />,
  submodules: [
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
