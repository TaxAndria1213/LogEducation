import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { Suspense } from "react";
import Loading from "./Loading";

export default function ProtectedRoute() {
  const { user } = useAuth();
  
  const location = useLocation();
  if (!user) {
    // redirige vers /login et mémorise la page demandée
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user.statut === "INACTIF") {
    return <Navigate to="/compte-inactif" replace />;
  }
  return (
    <Suspense fallback={<Loading message="Chargement..." />}>
      <Outlet />
    </Suspense>
  );
}
