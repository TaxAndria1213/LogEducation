import { FiLock } from "react-icons/fi";
import RolesIndex from "../../pages/compte_securite/roles/RoleIndex";
import ProfilsIndex from "../../pages/compte_securite/profils/ProfilsIndex";
import PermissionsIndex from "../../pages/compte_securite/permissions/PermissionsIndex";
import AffectationsIndex from "../../pages/compte_securite/affectations/AffectationsIndex";
import UtilisateursIndex from "../../pages/compte_securite/utilisateurs/UtilisateursIndex";
import type { menu } from "../../types/types";

export const comptes_securite: menu = {
    key: "comptes_securite",
    name: "Comptes & sécurité",
    icon: <FiLock />,
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
        elements: <ProfilsIndex />
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
        elements: <PermissionsIndex />
      },
      //Affectations & Scope
      {
        key: "affectations",
        name: "Affectations & Scope",
        path: "/comptes_securite/affectations",
        elements: <AffectationsIndex />
      },
    ],
  }
