import { useEffect, useMemo, useState, type JSX } from "react";
import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import NotFound from "../../NotFound";
import { useAuth } from "../../../auth/AuthContext";
import FactureService, { type FactureWithRelations } from "../../../services/facture.service";
import { useFactureStore } from "./store/FactureIndexStore";
import {
  clearFinanceNavigationTarget,
  readFinanceNavigationTarget,
} from "../utils/crossNavigation";

export default function FacturesIndex() {
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
  const { etablissement_id } = useAuth();
  const service = useMemo(() => new FactureService(), []);
  const menuListIsVisible = useFactureStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = useFactureStore((state) => state.setMenuListIsVisible);
  const renderState = useFactureStore((state) => state.renderState);
  const renderedElement = useFactureStore((state) => state.renderedComponent);
  const setRenderState = useFactureStore((state) => state.setRenderState);
  const setRenderedComponent = useFactureStore((state) => state.setRenderedComponent);
  const setSelectedFacture = useFactureStore((state) => state.setSelectedFacture);
  const OptionButton = getComponentById("FIN.FACTURES.MENUACTION");
  const DashboardButton = getComponentById("FIN.FACTURES.MENUACTION.DASHBOARD");
  const ListButton = getComponentById("FIN.FACTURES.MENUACTION.LIST");
  const ParametreButton = getComponentById("FIN.FACTURES.MENUACTION.PARAMETRE");
  const AddButton = getComponentById("FIN.FACTURES.MENUACTION.ADD");

  useEffect(() => {
    if (renderedElement) setRender(renderedElement);
  }, [renderedElement]);

  useEffect(() => {
    if (!etablissement_id) return;

    let cancelled = false;

    const resolvePendingNavigation = async () => {
      const pending = readFinanceNavigationTarget("factures");
      if (!pending) return;

      try {
        if (pending.record) {
          if (cancelled) return;
          setSelectedFacture(pending.record as FactureWithRelations);
          setRenderedComponent("detail");
          clearFinanceNavigationTarget();
          return;
        }

        if (!pending.id) {
          clearFinanceNavigationTarget();
          return;
        }

        const response = await service.getForEtablissement(etablissement_id, {
          page: 1,
          take: 1,
          where: { id: pending.id },
          includeSpec: {
            eleve: { include: { utilisateur: { include: { profil: true } } } },
            annee: true,
            remise: true,
            lignes: { include: { frais: true } },
            paiements: true,
            echeances: { include: { affectations: true }, orderBy: [{ ordre: "asc" }, { date_echeance: "asc" }] },
          },
        });

        if (cancelled) return;

        const record = response?.status.success
          ? ((response.data.data as FactureWithRelations[] | undefined)?.[0] ?? null)
          : null;

        if (record) {
          setSelectedFacture(record);
          setRenderedComponent("detail");
        }
      } finally {
        clearFinanceNavigationTarget();
      }
    };

    void resolvePendingNavigation();

    return () => {
      cancelled = true;
    };
  }, [etablissement_id, service, setRenderedComponent, setSelectedFacture]);

  return (
    <ERPPage
      title="Factures"
      description="Emission, suivi et consultation des factures eleves de l'etablissement."
      headerActions={[
        <OptionButton
          key="FIN.FACTURES.MENUACTION"
          onClick={() => setMenuListIsVisible(!menuListIsVisible)}
        />,
      ]}
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">{render}</div>
        <PageSidebarPopup open={menuListIsVisible} onClose={() => setMenuListIsVisible(false)}>
          <ListContainer
            onItemClick={() => setMenuListIsVisible(false)}
            selected={renderState}
            setSelected={setRenderState}
            components={[
              <DashboardButton onClick={() => setRenderedComponent("dashboard")} />,
              <ListButton onClick={() => setRenderedComponent("list")} />,
              <ParametreButton onClick={() => setRenderedComponent("parametre")} />,
              <AddButton onClick={() => setRenderedComponent("add")} />,
            ]}
          />
        </PageSidebarPopup>
      </div>
    </ERPPage>
  );
}
