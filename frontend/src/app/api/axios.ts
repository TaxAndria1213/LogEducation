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
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Gestion des erreurs globales
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        // Si le token a expiré ou non valide → redirection vers login
        localStorage.removeItem("token");
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }
  );

  return api;
}

