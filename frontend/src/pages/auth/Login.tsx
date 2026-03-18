/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { authService } from "../../app/api/authService";
import { useAuth } from "../../auth/AuthContext";
import Spin from "../../components/anim/Spin";

export default function Login() {
  const { login } = useAuth();
  const user = localStorage.getItem("user");
  const token = localStorage.getItem("token");
  const rolesAccessList = localStorage.getItem("rolesAccessList");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation() as any;
  const from = location.state?.from?.pathname || "/";

  useEffect(() => {
    if (user && token && rolesAccessList) {
      login(JSON.parse(user), JSON.parse(rolesAccessList), { accessToken: token, refreshToken: localStorage.getItem("refreshToken") as string });
      navigate(from, { replace: true });
    }
  }, [user, token, rolesAccessList, from, navigate, login]);
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await authService.login(username, password);
      console.log("🚀 ~ handleSubmit ~ data:", data);
      login(data.user, data.rolesAccessList, { accessToken: data.result.accessToken, refreshToken: data.result.refreshToken });
      navigate(from, { replace: true });
    } catch (err) {
      console.error(err);
      alert("Échec de la connexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-white shadow-xl rounded-xl w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-gray-800 text-center mb-6">
          Connexion
        </h1>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Nom d'utilisateur
            </label>
            <input
              id="username"
              type="text"
              placeholder="Entrez votre nom d'utilisateur"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-70 transition duration-200"
          >
            {loading ? <Spin /> : "Se connecter"}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Vous n'avez pas de compte ?{" "}
          <a
            href="/register"
            className="text-indigo-600 hover:underline font-medium"
          >
            Créez-en un
          </a>
        </p>
      </div>
    </div>
  );
}
