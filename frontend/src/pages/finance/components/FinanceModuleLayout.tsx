import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import ERPPage from "../../../components/page/ERPPage";

type FinanceModuleKey =
  | "dashboard"
  | "catalogue_frais"
  | "remises"
  | "factures"
  | "paiements"
  | "plans_de_paiement"
  | "journal_financier";

type LocalView = {
  id: string;
  label: string;
  onClick: () => void;
  active?: boolean;
  tone?: "default" | "primary";
};

type Props = {
  title: string;
  description: string;
  currentModule: FinanceModuleKey;
  localViews?: LocalView[];
  children: ReactNode;
};

const financeTabs: Array<{ key: FinanceModuleKey; label: string; path: string }> = [
  { key: "dashboard", label: "Vue globale", path: "/finance/dashboard" },
  { key: "catalogue_frais", label: "Catalogue", path: "/finance/catalogue_frais" },
  { key: "remises", label: "Remises", path: "/finance/remises" },
  { key: "factures", label: "Factures", path: "/finance/factures" },
  { key: "paiements", label: "Paiements", path: "/finance/paiements" },
  { key: "plans_de_paiement", label: "Plans", path: "/finance/plans_de_paiement" },
  { key: "journal_financier", label: "Journal", path: "/finance/journal_financier" },
];

export default function FinanceModuleLayout({
  title,
  description,
  currentModule,
  localViews = [],
  children,
}: Props) {
  return (
    <ERPPage title={title} description={description}>
      <div className="space-y-4">
        <section className="rounded-[26px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="overflow-x-auto md:overflow-visible">
            <div className="flex min-w-max items-center gap-2 md:min-w-0 md:flex-wrap">
              {financeTabs.map((tab) => {
                const isActive = tab.key === currentModule;
                return (
                  <NavLink
                    key={tab.key}
                    to={tab.path}
                    className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                      isActive
                        ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </NavLink>
                );
              })}
            </div>
          </div>

          {localViews.length > 0 ? (
            <div className="mt-3 overflow-x-auto border-t border-slate-100 pt-3 md:overflow-visible">
              <div className="flex min-w-max items-center gap-2 md:min-w-0 md:flex-wrap">
                {localViews.map((view) => (
                  <button
                    key={view.id}
                    type="button"
                    onClick={view.onClick}
                    className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                      view.active
                        ? view.tone === "primary"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-slate-900 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                    }`}
                  >
                    {view.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        {children}
      </div>
    </ERPPage>
  );
}
