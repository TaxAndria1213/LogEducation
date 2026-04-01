import { useMemo, useState, type ReactNode, type ReactElement } from "react";
import { FiBarChart2, FiGrid, FiList, FiMenu, FiPlus, FiSettings } from "react-icons/fi";
import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import IconButton from "../../../components/actions/IconButton";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import type { FinanceHeroAction, FinanceHeroHighlight } from "./financeUi";
import type { componentId } from "../../../types/types";

type FinanceModuleKey =
  | "dashboard"
  | "catalogue_frais"
  | "remises"
  | "factures"
  | "paiements"
  | "plans_de_paiement"
  | "journal_financier"
  | "recouvrement";

type LocalView = {
  id: string;
  label: string;
  onClick: () => void;
  active?: boolean;
  tone?: "default" | "primary";
  helper?: string;
};

type Props = {
  title: string;
  description: string;
  currentModule: FinanceModuleKey;
  eyebrow?: string;
  localViews?: LocalView[];
  heroHighlights?: FinanceHeroHighlight[];
  heroActions?: FinanceHeroAction[];
  heroAside?: ReactNode;
  children: ReactNode;
};

export default function FinanceModuleLayout({
  title,
  description,
  currentModule,
  localViews = [],
  children,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const hasViewMenu = localViews.length > 0;
  const viewMenuPrefix = useMemo(() => {
    switch (currentModule) {
      case "catalogue_frais":
        return "FIN.CATALOGUEFRAIS.MENUACTION";
      case "remises":
        return "FIN.REMISES.MENUACTION";
      case "factures":
        return "FIN.FACTURES.MENUACTION";
      case "paiements":
        return "FIN.PAIEMENTS.MENUACTION";
      case "plans_de_paiement":
        return "FIN.PLANSPAIEMENT.MENUACTION";
      case "journal_financier":
        return "FIN.JOURNALFINANCIER.MENUACTION";
      case "recouvrement":
        return "FIN.RECOUVREMENT.MENUACTION";
      default:
        return null;
    }
  }, [currentModule]);
  const menuActionId = useMemo(() => {
    switch (currentModule) {
      case "catalogue_frais":
        return "FIN.CATALOGUEFRAIS.MENUACTION";
      case "remises":
        return "FIN.REMISES.MENUACTION";
      case "factures":
        return "FIN.FACTURES.MENUACTION";
      case "paiements":
        return "FIN.PAIEMENTS.MENUACTION";
      case "plans_de_paiement":
        return "FIN.PLANSPAIEMENT.MENUACTION";
      case "journal_financier":
        return "FIN.JOURNALFINANCIER.MENUACTION";
      case "recouvrement":
        return "FIN.RECOUVREMENT.MENUACTION";
      default:
        return null;
    }
  }, [currentModule]);

  const OptionButton = menuActionId ? getComponentById(menuActionId) : null;
  const viewSelectedIndex = localViews.findIndex((view) => view.active);

  const viewMenuItems = localViews.map((view): ReactElement => {
    const suffix =
      view.id === "dashboard"
        ? "DASHBOARD"
        : view.id === "list"
          ? "LIST"
          : view.id === "parametre"
            ? "PARAMETRE"
            : view.id === "add"
              ? "ADD"
              : null;

    const componentId = viewMenuPrefix && suffix ? `${viewMenuPrefix}.${suffix}` : null;
    const ViewComponent = componentId ? getComponentById(componentId as componentId) : null;

    if (ViewComponent) {
      return <ViewComponent key={view.id} onClick={view.onClick} />;
    }

    const Icon =
      view.id === "dashboard"
        ? FiBarChart2
        : view.id === "list"
          ? FiList
          : view.id === "parametre"
            ? FiSettings
            : view.id === "add"
              ? FiPlus
              : FiGrid;

    return (
      <div key={view.id} onClick={view.onClick} className="flex items-center gap-2 text-sm">
        <Icon className="shrink-0 text-[15px]" />
        <span className="truncate font-medium">{view.label}</span>
      </div>
    );
  });

  return (
    <ERPPage
      title={title}
      description={description}
      headerActions={
        hasViewMenu
          ? [
              OptionButton ? (
                <OptionButton key="finance-menu" onClick={() => setMenuOpen((value: boolean) => !value)} />
              ) : (
                <IconButton
                  key="finance-menu"
                  icon={<FiMenu />}
                  onClick={() => setMenuOpen((value) => !value)}
                  size={40}
                />
              ),
            ]
          : []
      }
    >
      <div>{children}</div>

      <PageSidebarPopup open={hasViewMenu && menuOpen} onClose={() => setMenuOpen(false)}>
        {viewMenuItems.length > 0 ? (
          <div>
            <ListContainer
              onItemClick={() => setMenuOpen(false)}
              selected={viewSelectedIndex >= 0 ? viewSelectedIndex : undefined}
              components={viewMenuItems}
            />
          </div>
        ) : (
          <div className="px-2 py-3 text-sm text-slate-500">Aucune vue disponible.</div>
        )}
      </PageSidebarPopup>
    </ERPPage>
  );
}
