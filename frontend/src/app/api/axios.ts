import axios from "axios";

export const systemApi = apiApp(import.meta.env.VITE_REACT_SYSTEM_APP_BASE_URL)

// Instance de base
export const api = apiApp(import.meta.env.VITE_REACT_APP_BASE_URL);

function apiApp(url: string) {
  const api = axios.create({
    baseURL: url || "http://localhost:3045", // à changer selon ton backend
    timeout: 10000,
    headers: {
      "Content-Type": "application/json",
    },
  });

  // Ajouter automatiquement le token si présent
  api.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem("token"); // ou sessionStorage
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      const tenant = localStorage.getItem("contextParams");
      if (tenant) {
        try {
          const parsed = JSON.parse(tenant);
          if (parsed.etablissement_id) {
            config.headers["x-etablissement-id"] = parsed.etablissement_id;
          }
        } catch {
          /* noop */
        }
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Gestion des erreurs globales
  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      const status = error.response?.data?.status;
      const errorCode = status?.errorCode;
      const redirectTo = status?.redirectTo;

      if (
        ["inactive_account", "pending_owner_registration", "rejected_owner_registration"].includes(
          errorCode,
        ) &&
        redirectTo
      ) {
        window.location.href = redirectTo;
        return Promise.reject(error);
      }

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        try {
          const refreshToken = localStorage.getItem("refreshToken");
          if (!refreshToken) throw new Error("missing refresh token");
          const { data } = await api.post("/auth/refresh", { refreshToken });
          const newAccess = data?.data?.accessToken;
          const newRefresh = data?.data?.refreshToken;
          if (newAccess) {
            localStorage.setItem("token", newAccess);
            if (newRefresh) localStorage.setItem("refreshToken", newRefresh);
            originalRequest.headers.Authorization = `Bearer ${newAccess}`;
            return api(originalRequest);
          }
        } catch (e) {
          console.log("🚀 ~ apiApp ~ e:", e)
          localStorage.clear();
          window.location.href = "/login";
        }
      }
      if (error.response?.status === 403) {
        window.location.href = redirectTo || "/login";
      }
      return Promise.reject(error);
    }
  );

  return api;
}
