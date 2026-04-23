import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import UtilisateurService from "../services/utilisateur.service";
import { styles } from "../styles/styles";

type OwnerRegistrationStatusResponse = {
  status?: string;
  statusLabel?: string;
  message?: string;
  canLogin?: boolean;
};

function getInitialStatusMessage(status: string | null): string {
  if (status === "rejected_owner_registration") {
    return "Votre demande de compte proprietaire a ete rejetee.";
  }

  if (status === "pending_owner_registration") {
    return "Votre demande de compte proprietaire est encore en attente de validation.";
  }

  return "Votre compte n'est pas encore actif.";
}

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof error.response === "object" &&
    error.response !== null &&
    "data" in error.response &&
    typeof error.response.data === "object" &&
    error.response.data !== null &&
    "status" in error.response.data &&
    typeof error.response.data.status === "object" &&
    error.response.data.status !== null &&
    "message" in error.response.data.status &&
    typeof error.response.data.status.message === "string"
  ) {
    return error.response.data.status.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Impossible de verifier le statut de votre demande.";
}

export default function CompteInactif() {
  const { logout } = useAuth();
  const [searchParams] = useSearchParams();
  const utilisateurService = useMemo(() => new UtilisateurService(), []);
  const initialEmail = searchParams.get("email")?.trim() ?? "";
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);
  const [canLogin, setCanLogin] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    getInitialStatusMessage(searchParams.get("status")),
  );
  const s = styles;

  useEffect(() => {
    logout();
  }, [logout]);

  async function loadOwnerRegistrationStatus(targetEmail: string) {
    const normalizedEmail = targetEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setStatusLabel(null);
      setCanLogin(false);
      setStatusMessage("Renseignez votre email pour verifier votre demande.");
      return;
    }

    setLoading(true);
    try {
      const response = await utilisateurService.getOwnerRegistrationStatus(normalizedEmail);
      const data = response?.data as OwnerRegistrationStatusResponse | undefined;
      setStatusLabel(data?.statusLabel ?? null);
      setCanLogin(Boolean(data?.canLogin));
      setStatusMessage(
        data?.message?.trim() || "Le statut de votre demande n'a pas pu etre determine.",
      );
    } catch (error) {
      setStatusLabel(null);
      setCanLogin(false);
      setStatusMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialEmail) {
      void loadOwnerRegistrationStatus(initialEmail);
    }
  }, [initialEmail]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 text-gray-800">
      <h1
        style={{
          color: s.color.primary,
        }}
        className="mb-4 text-5xl font-extrabold"
      >
        Compte inactif
      </h1>
      <h2 className="mb-2 text-2xl font-semibold">
        Suivi de votre demande proprietaire
      </h2>
      <p className="mb-6 max-w-2xl text-center text-gray-500">{statusMessage}</p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void loadOwnerRegistrationStatus(email);
        }}
        className="mb-6 w-full max-w-xl rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
      >
        <label
          htmlFor="owner-registration-email"
          className="mb-2 block text-sm font-medium text-gray-700"
        >
          Email de la demande
        </label>
        <div className="flex flex-col gap-3 md:flex-row">
          <input
            id="owner-registration-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="exemple@etablissement.com"
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              backgroundColor: s.color.primary,
            }}
            className="rounded-lg px-4 py-2 font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Verification..." : "Verifier ma demande"}
          </button>
        </div>
        {statusLabel ? (
          <p className="mt-3 text-sm font-medium text-gray-700">
            Statut: {statusLabel}
          </p>
        ) : null}
        {canLogin ? (
          <Link to="/login" className="mt-3 inline-block text-blue-600 hover:underline">
            Votre compte est pret. Aller a la connexion
          </Link>
        ) : null}
      </form>

      <Link
        to="https://wa.me/261346422107"
        target="_blank"
        style={{
          backgroundColor: s.color.primary,
        }}
        className="rounded-lg px-5 py-2.5 text-white transition-colors duration-200 hover:opacity-90"
      >
        <span className="mr-2 inline-block">
          <WhatsAppIcon />
        </span>
        Contacter l'administrateur
      </Link>
      <Link to="/login" className="mt-4 text-blue-600 hover:underline">
        Retourner a la page de connexion
      </Link>
    </div>
  );
}

export function WhatsAppIcon() {
  return <FontAwesomeIcon icon={faWhatsapp} />;
}
