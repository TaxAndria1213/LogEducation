import { FiBarChart2 } from "react-icons/fi";
import CalendarDashboard from "../../pages/dashboard/CalendarDashboard";
import Dashboard from "../../pages/dashboard/PreviewDashboard";
import type { menu } from "../../types/types";

export const dashboard: menu = {
    key: "dashboard",
    name: "Tableau de bord",
    icon: <FiBarChart2 />,
    submodules: [
      {
        key: "overview",
        name: "Vue d'ensemble",
        path: "/dashboard/overview",
        elements: <Dashboard />,
      },
      {
        key: "calendar_preview",
        name: "Aperçu du calendrier",
        path: "/dashboard/calendar_preview",
        elements: <CalendarDashboard />
      },
    ],
  }