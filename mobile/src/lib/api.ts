import axios from "axios";
import { API_BASE_URL, REQUEST_TIMEOUT, SYSTEM_API_BASE_URL } from "@/config/env";
import { getRuntimeSession, notifyUnauthorized, updateRuntimeTokens } from "@/lib/session";
import { updateSessionTokens } from "@/lib/storage";

const commonConfig = {
  timeout: REQUEST_TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  ...commonConfig,
});

export const systemApi = axios.create({
  baseURL: SYSTEM_API_BASE_URL,
  ...commonConfig,
});

api.interceptors.request.use(async (config) => {
  config.headers = config.headers ?? {};
  const session = getRuntimeSession();
  if (session?.tokens.accessToken) {
    config.headers.Authorization = `Bearer ${session.tokens.accessToken}`;
  }
  if (session?.user.etablissement_id) {
    config.headers["x-etablissement-id"] = session.user.etablissement_id;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const session = getRuntimeSession();

    if (
      error.response?.status === 401 &&
      !originalRequest?._retry &&
      session?.tokens.refreshToken
    ) {
      originalRequest._retry = true;

      try {
        const { data } = await systemApi.post("/api/auth/refresh", {
          refreshToken: session.tokens.refreshToken,
        });

        const accessToken = data?.data?.accessToken as string | undefined;
        const refreshToken = data?.data?.refreshToken as string | undefined;

        if (!accessToken) {
          throw new Error("Missing access token after refresh.");
        }

        updateRuntimeTokens(accessToken, refreshToken);
        await updateSessionTokens(accessToken, refreshToken);
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        return api(originalRequest);
      } catch (refreshError) {
        await notifyUnauthorized();
        return Promise.reject(refreshError);
      }
    }

    if (error.response?.status === 403) {
      await notifyUnauthorized();
    }

    return Promise.reject(error);
  },
);
