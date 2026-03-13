import { Link } from "react-router-dom";
import { styles } from "../styles/styles";

export default function CompteInactif() {
  const { logout } = useAuth();
  useEffect(() => {
    logout();
  }, [logout]);
  const s = styles;
  return (
    <div className="flex flex-col items-center justify-center bg-gray-50 text-gray-800 p-4 h-[100vh]">
      <h1
        style={{
          color: s.color.primary,
        }}
        className="text-6xl font-extrabold  mb-4"
      >
        Compte inactif
      </h1>
      <h2 className="text-2xl font-semibold mb-2">
        Votre compte n'est pas encore actif.
      </h2>
      <p className="mb-8 text-gray-500 text-center max-w-md">
        Veuillez contacter l'administrateur.
      </p>
      <Link
        to="https://wa.me/261346422107"
        target="_blank"
        style={{
          backgroundColor: s.color.primary,
        }}
        className="px-5 py-2.5 text-white rounded-lg hover:opacity-90 transition-colors duration-200"
      >
        {/**icone font awesome whatsapp */}
        <span className="inline-block mr-2">
          <WhatsAppIcon />{" "}
        </span>
        Contacter l'administrateur
      </Link>
      <Link to="/login" className="mt-4 text-blue-600 hover:underline">
        Retourner à la page de connexion
      </Link>
    </div>
  );
}

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { useAuth } from "../auth/AuthContext";
import { useEffect } from "react";

export function WhatsAppIcon() {
  return <FontAwesomeIcon icon={faWhatsapp} />;
}
