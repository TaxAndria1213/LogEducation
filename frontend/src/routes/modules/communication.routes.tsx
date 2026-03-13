import type { menu } from "../../types/types";

export const communication: menu = {
    key: "communication",
    name: "Communication",
    submodules: [
      {
        key: "annonces",
        name: "Annonces",
        path: "/communication/annonces",
      },
      {
        key: "messagerie",
        name: "Messagerie",
        path: "/communication/messagerie",
      },
      {
        key: "notifications",
        name: "Notifications",
        path: "/communication/notifications",
      },
      {
        key: "canaux",
        name: "Canaux",
        path: "/communication/canaux",
      },
    ],
  }