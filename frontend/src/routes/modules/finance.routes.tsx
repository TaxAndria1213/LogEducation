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
      permissions: [
        "FIN.CATALOGUEFRAIS.MENUACTION",
        "FIN.REMISES.MENUACTION",
        "FIN.FACTURES.MENUACTION",
        "FIN.PAIEMENTS.MENUACTION",
        "FIN.PLANSPAIEMENT.MENUACTION",
        "FIN.JOURNALFINANCIER.MENUACTION",
        "FIN.RECOUVREMENT.MENUACTION",
      ],
      elements: <FinanceDashboardIndex />,
    },
    {
      key: "catalogue_frais",
      name: "Catalogue de frais",
      path: "/finance/catalogue_frais",
      permission: "FIN.CATALOGUEFRAIS.MENUACTION",
      elements: <CatalogueFraisIndex />,
    },
    {
      key: "remises",
      name: "Remises",
      path: "/finance/remises",
      permission: "FIN.REMISES.MENUACTION",
      elements: <RemisesIndex />,
    },
    {
      key: "factures",
      name: "Factures",
      path: "/finance/factures",
      permission: "FIN.FACTURES.MENUACTION",
      elements: <FacturesIndex />,
    },
    {
      key: "paiements",
      name: "Paiements",
      path: "/finance/paiements",
      permission: "FIN.PAIEMENTS.MENUACTION",
      elements: <PaiementsIndex />,
    },
    {
      key: "plans_de_paiement",
      name: "Plans de paiement",
      path: "/finance/plans_de_paiement",
      permission: "FIN.PLANSPAIEMENT.MENUACTION",
      elements: <PlansPaiementIndex />,
    },
    {
      key: "journal_financier",
      name: "Journal financier",
      path: "/finance/journal_financier",
      permission: "FIN.JOURNALFINANCIER.MENUACTION",
      elements: <JournalFinancierIndex />,
    },
    {
      key: "recouvrement",
      name: "Recouvrement",
      path: "/finance/recouvrement",
      permission: "FIN.RECOUVREMENT.MENUACTION",
      elements: <RecouvrementIndex />,
    },
  ],
};
