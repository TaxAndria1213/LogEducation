import RolesIndex from "../../pages/compte_securite/roles/RoleIndex";
import UtilisateursIndex from "../../pages/compte_securite/utilisateurs/UtilisateursIndex";
import type { menu } from "../../types/types";

export const comptes_securite: menu = {
    key: "comptes_securite",
    name: "Comptes & sécurité",
    submodules: [
      {
        key: "utilisateurs",
        name: "Utilisateurs",
        path: "/comptes_securite/utilisateurs",
        elements: <UtilisateursIndex />
      },
      {
        key: "profils",
        name: "Profils",
        path: "/comptes_securite/profils",
      },
      {
        key: "roles",
        name: "Rôles",
        path: "/comptes_securite/roles",
        elements: <RolesIndex />
      },
      {
        key: "permissions",
        name: "Permissions",
        path: "/comptes_securite/permissions",
      },
      //Affectations & Scope
      {
        key: "affectations",
        name: "Affectations & Scope",
        path: "/comptes_securite/affectations",
      },
    ],
  }