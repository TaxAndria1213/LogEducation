import { Link } from "react-router-dom";
import { styles } from "../styles/styles";

export default function NotFound() {
  const s = styles;
  return (
    <div className="flex flex-col items-center justify-center bg-gray-50 text-gray-800 p-4">
      <h2 className="text-2xl font-semibold mb-2">Page en maintenance</h2>
      <p className="mb-8 text-gray-500 text-center max-w-md">
        Désolé, la page que vous essayez d'accéder est en cours de maintenance.
      </p>
      <Link
        to="/"
        style={{
          backgroundColor: s.color.primary,
        }}
        className="px-5 py-2.5 text-white rounded-lg hover:opacity-90 transition-colors duration-200"
      >
        Revenir à l’accueil
      </Link>
    </div>
  );
}
