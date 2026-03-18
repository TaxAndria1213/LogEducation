/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Utilisateur } from "../../types/models";
import { systemApi } from "./axios";


export type LoginResponse = {
  data: any;
};

export const authService = {
  login: async (email: string, password: string) => {
    const user: Pick< Utilisateur, "email" | "mot_de_passe_hash"> = {
      email,
      mot_de_passe_hash: password
    }
    const { data } = await systemApi.post<LoginResponse>("/api/auth/login", user);
    localStorage.setItem("token", data.data.result.accessToken);
    localStorage.setItem("refreshToken", data.data.result.refreshToken);
    localStorage.setItem("user", JSON.stringify(data.data.user));
    return data.data;
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
  },

  me: async () => {
    const { data } = await systemApi.get("/auth/me");
    return data;
  },
};
