import { useEffect, useState, useCallback, useMemo } from "react";
import type { ReactNode } from "react";
import { AuthContext } from "./AuthContext";
import type { Role, Utilisateur, UtilisateurRole } from "../types/models";
import type { Profil } from "../generated/zod";
import {
  clearStoredContextParams,
  CONTEXT_PARAMS_UPDATED_EVENT,
  getStoredContextParams,
  setStoredContextEtablissementId,
} from "./contextParams";

function resolveActiveEtablissementId(user: Utilisateur | null) {
  const stored = getStoredContextParams().etablissement_id;
  if (stored) {
    return stored;
  }

  return user?.etablissement_id ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Utilisateur | null>(() => {
    const userData = localStorage.getItem("user");
    return userData ? JSON.parse(userData) : null;
  });

  const [roles, setRoles] = useState<UtilisateurRole[] | null>(null);
  const [etablissement_id, setEtablissementId] = useState<string | null>(() =>
    resolveActiveEtablissementId(
      (() => {
        const userData = localStorage.getItem("user");
        return userData ? (JSON.parse(userData) as Utilisateur) : null;
      })(),
    ),
  );
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
      setStoredContextEtablissementId(user.etablissement_id ?? null);
      setEtablissementId(user.etablissement_id ?? null);
      localStorage.setItem("rolesAccessList", JSON.stringify(roles));
      localStorage.setItem("token", tokens.accessToken);
      localStorage.setItem("refreshToken", tokens.refreshToken);
    },
    [],
  );

  const setActiveEtablissementId = useCallback((nextEtablissementId: string | null) => {
    setStoredContextEtablissementId(nextEtablissementId);
    setEtablissementId(nextEtablissementId);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setRefreshToken(null);
    clearStoredContextParams();
    localStorage.clear();
  }, []);

  useEffect(() => {
    if (user) {
      if (user.roles) setRoles(user.roles);
      if (user.profil) setProfil(user.profil);
      else setProfil(null);
      setEtablissementId(resolveActiveEtablissementId(user));
      if (!getStoredContextParams().etablissement_id && user.etablissement_id) {
        setStoredContextEtablissementId(user.etablissement_id);
      }
      localStorage.setItem("user", JSON.stringify(user));
    } else {
      setRoles(null);
      setProfil(null);
      setEtablissementId(getStoredContextParams().etablissement_id);
    }
  }, [user]);

  useEffect(() => {
    const syncContext = () => {
      setEtablissementId(resolveActiveEtablissementId(user));
    };

    window.addEventListener(CONTEXT_PARAMS_UPDATED_EVENT, syncContext);
    window.addEventListener("storage", syncContext);

    return () => {
      window.removeEventListener(CONTEXT_PARAMS_UPDATED_EVENT, syncContext);
      window.removeEventListener("storage", syncContext);
    };
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
      setActiveEtablissementId,
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
      setActiveEtablissementId,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
