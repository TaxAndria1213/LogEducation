import { useEffect, useState, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { AuthContext } from "./AuthContext";
import type { Role, Utilisateur, UtilisateurRole } from "../types/models";
import type { Profil } from "../generated/zod";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Utilisateur | null>(() => {
    const userData = localStorage.getItem("user");
    return userData ? JSON.parse(userData) : null;
  });

  const [roles, setRoles] = useState<UtilisateurRole[] | null>(null);
  const [etablissement_id, setEtablissementId] = useState<string | null>(null);
  const [profil, setProfil] = useState<Profil | null>(null);

  const [rolesAccessList, setRolesAccessList] = useState<Role[]>(() => {
    const rolesAccessListData = localStorage.getItem("rolesAccessList");
    return rolesAccessListData ? JSON.parse(rolesAccessListData) : [];
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem("token");
  });

  const login = useCallback(
    (user: Utilisateur, roles: Role[], token: string) => {
      setUser(user);
      setToken(token);
      setRolesAccessList(roles);
      setEtablissementId(user.etablissement_id);
      localStorage.setItem(
        "contextParams",
        JSON.stringify({ etablissement_id: user.etablissement_id }),
      );
      localStorage.setItem("rolesAccessList", JSON.stringify(roles));
      localStorage.setItem("token", token);
    },
    [],
  );

  const logout = useCallback(() => {
    setUser(null);
    localStorage.clear();
  }, []);

  useEffect(() => {
    if (user) {
      if (user.roles) setRoles(user.roles);
      if (user.profil) setProfil(user.profil);
      else setProfil(null);
      if (user.etablissement_id) setEtablissementId(user.etablissement_id);
      localStorage.setItem(
        "contextParams",
        JSON.stringify({ etablissement_id: user.etablissement_id }),
      );
      localStorage.setItem("user", JSON.stringify(user));
    }
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      profil,
      etablissement_id,
      roles,
      rolesAccessList,
      token,
      login,
      logout,
    }),
    [
      user,
      profil,
      etablissement_id,
      roles,
      rolesAccessList,
      token,
      login,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
