import { Link } from "react-router-dom";
import { styles } from "../styles/styles";

export default function NotFound() {
  const s = styles;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center bg-gray-50 p-4 text-gray-800">
      <h2 className="mb-2 text-2xl font-semibold">Fonctionnalite non disponible</h2>
      <p className="mb-8 max-w-md text-center text-gray-500">
        Desole, la fonctionnalite que vous recherchez n'est pas encore disponible sur ce  
        ressource.
      </p>
      <Link
        to="/"
        style={{
          backgroundColor: s.color.primary,
        }}
        className="rounded-lg px-5 py-2.5 text-white transition-colors duration-200 hover:opacity-90"
      >
        Revenir a l'accueil
      </Link>
    </div>
  );
}
