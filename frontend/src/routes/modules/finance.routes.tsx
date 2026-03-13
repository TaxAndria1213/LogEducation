import { FiDollarSign } from "react-icons/fi";
import type { menu } from "../../types/types";

export const finance: menu = {
  key: "finance",
  name: "Finance",
  icon: <FiDollarSign />,
  submodules: [
    {
      key: "catalogue_frais",
      name: "Catalogue de frais",
      path: "/finance/catalogue_frais",
    },
    {
      key: "remises",
      name: "Remises",
      path: "/finance/remises",
    },
    {
      key: "factures",
      name: "Factures",
      path: "/finance/factures",
    },
    {
      key: "paiements",
      name: "Paiements",
      path: "/finance/paiements",
    },
    {
      key: "plans_de_paiement",
      name: "Plans de paiement",
      path: "/finance/plans_de_paiement",
    },
  ],
};
