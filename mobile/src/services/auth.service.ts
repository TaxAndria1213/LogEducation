import { systemApi } from "@/lib/api";
import type { AuthTokens, Utilisateur } from "@/types/models";

type LoginPayload = {
  email: string;
  mot_de_passe_hash: string;
};

type LoginResponse = {
  result: AuthTokens;
  user: Utilisateur;
};

export const authService = {
  async login(email: string, password: string) {
    const payload: LoginPayload = {
      email,
      mot_de_passe_hash: password,
    };

    const { data } = await systemApi.post<{ data: LoginResponse }>(
      "/api/auth/login",
      payload,
    );

    return data.data;
  },
};
