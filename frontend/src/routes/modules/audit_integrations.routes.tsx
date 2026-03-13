import { FiPlusCircle } from "react-icons/fi";
import type { menu } from "../../types/types";

export const audit_integrations: menu = {
  key: "audit_integrations",
  name: "Audit & intégrations",
  icon: <FiPlusCircle />,
  submodules: [
    {
      key: "journal_audit",
      name: "Journal audit",
      path: "/audit_integrations/journal_audit",
    },
    {
      key: "webhooks",
      name: "Webhooks",
      path: "/audit_integrations/webhooks",
    },
    {
      key: "jetons_integrations",
      name: "Jetons intégrations",
      path: "/audit_integrations/jetons_integrations",
    },
  ],
};
