import { useEffect, useMemo, useState, type JSX } from "react";
import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import NotFound from "../../NotFound";
import { useAuth } from "../../../auth/AuthContext";
import PaiementService, { type PaiementWithRelations } from "../../../services/paiement.service";
import { usePaiementStore } from "./store/PaiementIndexStore";
import {
  clearFinanceNavigationTarget,
  readFinanceNavigationTarget,
} from "../utils/crossNavigation";

export default function PaiementsIndex() {
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
  const { etablissement_id } = useAuth();
  const service = useMemo(() => new PaiementService(), []);
  const menuListIsVisible = usePaiementStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = usePaiementStore((state) => state.setMenuListIsVisible);
  const renderState = usePaiementStore((state) => state.renderState);
  const renderedElement = usePaiementStore((state) => state.renderedComponent);
  const setRenderState = usePaiementStore((state) => state.setRenderState);
  const setRenderedComponent = usePaiementStore((state) => state.setRenderedComponent);
  const setSelectedPaiement = usePaiementStore((state) => state.setSelectedPaiement);
  const OptionButton = getComponentById("FIN.PAIEMENTS.MENUACTION");
  const DashboardButton = getComponentById("FIN.PAIEMENTS.MENUACTION.DASHBOARD");
  const ListButton = getComponentById("FIN.PAIEMENTS.MENUACTION.LIST");
  const ParametreButton = getComponentById("FIN.PAIEMENTS.MENUACTION.PARAMETRE");
  const AddButton = getComponentById("FIN.PAIEMENTS.MENUACTION.ADD");

  useEffect(() => {
    if (renderedElement) setRender(renderedElement);
  }, [renderedElement]);

  useEffect(() => {
    if (!etablissement_id) return;

    let cancelled = false;

    const resolvePendingNavigation = async () => {
      const pending = readFinanceNavigationTarget("paiements");
      if (!pending) return;

      try {
        if (pending.record) {
          if (cancelled) return;
          setSelectedPaiement(pending.record as PaiementWithRelations);
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
            facture: {
              include: {
                eleve: { include: { utilisateur: { include: { profil: true } } } },
                annee: true,
                echeances: true,
              },
            },
            affectations: {
              include: {
                echeance: true,
              },
            },
          },
        });

        if (cancelled) return;

        const record = response?.status.success
          ? ((response.data.data as PaiementWithRelations[] | undefined)?.[0] ?? null)
          : null;

        if (record) {
          setSelectedPaiement(record);
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
  }, [etablissement_id, service, setRenderedComponent, setSelectedPaiement]);

  return (
    <ERPPage
      title="Paiements"
      description="Encaissements, references et suivi des paiements associes aux factures."
      headerActions={[
        <OptionButton
          key="FIN.PAIEMENTS.MENUACTION"
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
