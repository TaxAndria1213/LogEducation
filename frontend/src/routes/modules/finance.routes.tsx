import { FiDollarSign } from "react-icons/fi";
import type { menu } from "../../types/types";
import FinanceDashboardIndex from "../../pages/finance/dashboard/FinanceDashboardIndex";
import CatalogueFraisIndex from "../../pages/finance/catalogue_frais/CatalogueFraisIndex";
import RemisesIndex from "../../pages/finance/remises/RemisesIndex";
import FacturesIndex from "../../pages/finance/factures/FacturesIndex";
import PaiementsIndex from "../../pages/finance/paiements/PaiementsIndex";
import PlansPaiementIndex from "../../pages/finance/plans_paiement/PlansPaiementIndex";
import JournalFinancierIndex from "../../pages/finance/journal_financier/JournalFinancierIndex";
import RecouvrementIndex from "../../pages/finance/recouvrement/RecouvrementIndex";

export const finance: menu = {
  key: "finance",
  name: "Finance",
  icon: <FiDollarSign />,
  submodules: [
    {
      key: "dashboard",
      name: "Tableau de bord",
      path: "/finance/dashboard",
      elements: <FinanceDashboardIndex />,
    },
    {
      key: "catalogue_frais",
      name: "Catalogue de frais",
      path: "/finance/catalogue_frais",
      elements: <CatalogueFraisIndex />,
    },
    {
      key: "remises",
      name: "Remises",
      path: "/finance/remises",
      elements: <RemisesIndex />,
    },
    {
      key: "factures",
      name: "Factures",
      path: "/finance/factures",
      elements: <FacturesIndex />,
    },
    {
      key: "paiements",
      name: "Paiements",
      path: "/finance/paiements",
      elements: <PaiementsIndex />,
    },
    {
      key: "plans_de_paiement",
      name: "Plans de paiement",
      path: "/finance/plans_de_paiement",
      elements: <PlansPaiementIndex />,
    },
    {
      key: "journal_financier",
      name: "Journal financier",
      path: "/finance/journal_financier",
      elements: <JournalFinancierIndex />,
    },
    {
      key: "recouvrement",
      name: "Recouvrement",
      path: "/finance/recouvrement",
      elements: <RecouvrementIndex />,
    },
  ],
};
