import type { menu } from "../../types/types";

export const documents: menu = {
  key: "documents",
  name: "Documents",
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
