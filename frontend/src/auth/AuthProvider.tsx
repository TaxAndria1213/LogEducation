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

  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [refreshToken, setRefreshToken] = useState<string | null>(() => localStorage.getItem("refreshToken"));

  const login = useCallback(
    (user: Utilisateur, roles: Role[], tokens: { accessToken: string; refreshToken: string }) => {
      setUser(user);
      setToken(tokens.accessToken);
      setRefreshToken(tokens.refreshToken);
      setRolesAccessList(roles);
      setEtablissementId(user.etablissement_id);
      localStorage.setItem(
        "contextParams",
        JSON.stringify({ etablissement_id: user.etablissement_id }),
      );
      localStorage.setItem("rolesAccessList", JSON.stringify(roles));
      localStorage.setItem("token", tokens.accessToken);
      localStorage.setItem("refreshToken", tokens.refreshToken);
    },
    [],
  );

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setRefreshToken(null);
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
      refreshToken,
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
      refreshToken,
      login,
      logout,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
