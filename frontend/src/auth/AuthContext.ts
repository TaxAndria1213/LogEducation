import { createContext, useContext } from "react";
import type { Role, Utilisateur, UtilisateurRole } from "../types/models";
import type { Profil } from "../generated/zod";

export type AuthContextType = {
  user: null | Utilisateur;
  roles: UtilisateurRole[] | null;
  etablissement_id: string | null;
  profil: Profil | null;
  rolesAccessList: Role[] | null;
  token: null | string;
  refreshToken: null | string;
  login: (user: Utilisateur, roles: Role[], tokens: { accessToken: string; refreshToken: string }) => void;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
