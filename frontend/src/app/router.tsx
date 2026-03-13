import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { routes } from "../routes/routes";
import AppLayout from "./layouts/AppLayout";
import NotFound from "../pages/NotFound";
// import Home from "../pages/Home";
import ProtectedRoute from "./layouts/ProtectedRoute";
import initializeApp from "./init";
import Login from "../pages/auth/Login";
import { AuthProvider } from "../auth/AuthProvider";
import { InfoProvider } from "../provider/InfoProvider";
import { RelationOptionsProvider } from "../components/Form/RelationOptionsProvider";
import CreateAccount from "../pages/account/CreateAccount";
import CompteInactif from "../pages/CompteInactif";
import CreateAccountFromLink from "../pages/account/CreateAccountFromLink";

initializeApp();

const router = createBrowserRouter([
  {
    index: true,
    path: "login",
    element: (
      <AuthProvider>
        <Login />
      </AuthProvider>
    ),
  },
  {
    path: "compte-inactif",
    element: (
      <AuthProvider>
        <CompteInactif />
      </AuthProvider>
    ),
  },
  {
    path: "register",
    element: <CreateAccount />,
  },
  {
    path: "/compte/creation/",
    element: (
      <AuthProvider>
        <CreateAccountFromLink />
      </AuthProvider>
    ),
  },
  {
    path: "/",
    element: (
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    ),
    children: [
      {
        element: <ProtectedRoute />,
        // tout ce qui suit est protégé
        children: [
          ...routes,
          {
            path: "*",
            element: <NotFound />,
          },
        ],
      },
    ],
  },
]);

export default function AppRouter() {
  return (
    <InfoProvider>
      <RelationOptionsProvider>
        <RouterProvider router={router} />
      </RelationOptionsProvider>
    </InfoProvider>
  );
}
