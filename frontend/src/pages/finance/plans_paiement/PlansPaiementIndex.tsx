import { useEffect, useMemo, useState, type JSX } from "react";
import ERPPage from "../../../components/page/ERPPage";
import { getComponentById } from "../../../components/components.build";
import ListContainer from "../../../components/sidebar/ListContainer";
import PageSidebarPopup from "../../../components/sidebar/PageSidebarPopup";
import NotFound from "../../NotFound";
import { useAuth } from "../../../auth/AuthContext";
import PlanPaiementEleveService, {
  type PlanPaiementEleveWithRelations,
} from "../../../services/planPaiementEleve.service";
import { usePlanPaiementStore } from "./store/PlanPaiementIndexStore";
import {
  clearFinanceNavigationTarget,
  readFinanceNavigationTarget,
} from "../utils/crossNavigation";

export default function PlansPaiementIndex() {
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
  const { etablissement_id } = useAuth();
  const service = useMemo(() => new PlanPaiementEleveService(), []);
  const menuListIsVisible = usePlanPaiementStore((state) => state.menuListIsVisible);
  const setMenuListIsVisible = usePlanPaiementStore((state) => state.setMenuListIsVisible);
  const renderState = usePlanPaiementStore((state) => state.renderState);
  const renderedElement = usePlanPaiementStore((state) => state.renderedComponent);
  const setRenderState = usePlanPaiementStore((state) => state.setRenderState);
  const setRenderedComponent = usePlanPaiementStore((state) => state.setRenderedComponent);
  const setSelectedPlanPaiement = usePlanPaiementStore((state) => state.setSelectedPlanPaiement);
  const OptionButton = getComponentById("FIN.PLANSPAIEMENT.MENUACTION");
  const DashboardButton = getComponentById("FIN.PLANSPAIEMENT.MENUACTION.DASHBOARD");
  const ListButton = getComponentById("FIN.PLANSPAIEMENT.MENUACTION.LIST");
  const ParametreButton = getComponentById("FIN.PLANSPAIEMENT.MENUACTION.PARAMETRE");
  const AddButton = getComponentById("FIN.PLANSPAIEMENT.MENUACTION.ADD");

  useEffect(() => {
    if (renderedElement) setRender(renderedElement);
  }, [renderedElement]);

  useEffect(() => {
    if (!etablissement_id) return;

    let cancelled = false;

    const resolvePendingNavigation = async () => {
      const pending = readFinanceNavigationTarget("plans_paiement");
      if (!pending) return;

      try {
        if (pending.record) {
          if (cancelled) return;
          setSelectedPlanPaiement(pending.record as PlanPaiementEleveWithRelations);
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
            echeances: { include: { affectations: true }, orderBy: [{ ordre: "asc" }, { date_echeance: "asc" }] },
          },
        });

        if (cancelled) return;

        const record = response?.status.success
          ? ((response.data.data as PlanPaiementEleveWithRelations[] | undefined)?.[0] ?? null)
          : null;

        if (record) {
          setSelectedPlanPaiement(record);
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
  }, [etablissement_id, service, setRenderedComponent, setSelectedPlanPaiement]);

  return (
    <ERPPage
      title="Plans de paiement"
      description="Echeanciers et tranches de reglement par eleve et annee scolaire."
      headerActions={[
        <OptionButton
          key="FIN.PLANSPAIEMENT.MENUACTION"
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
