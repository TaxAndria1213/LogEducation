import { useEffect, useMemo, useState, type JSX } from "react";
import NotFound from "../../NotFound";
import { useAuth } from "../../../auth/AuthContext";
import PlanPaiementEleveService, {
  type PlanPaiementEleveWithRelations,
} from "../../../services/planPaiementEleve.service";
import FinanceModuleLayout from "../components/FinanceModuleLayout";
import { usePlanPaiementStore } from "./store/PlanPaiementIndexStore";
import {
  clearFinanceNavigationTarget,
  readFinanceNavigationTarget,
} from "../utils/crossNavigation";

export default function PlansPaiementIndex() {
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
  const { etablissement_id } = useAuth();
  const service = useMemo(() => new PlanPaiementEleveService(), []);
  const renderState = usePlanPaiementStore((state) => state.renderState);
  const renderedElement = usePlanPaiementStore((state) => state.renderedComponent);
  const setRenderState = usePlanPaiementStore((state) => state.setRenderState);
  const setRenderedComponent = usePlanPaiementStore((state) => state.setRenderedComponent);
  const setSelectedPlanPaiement = usePlanPaiementStore((state) => state.setSelectedPlanPaiement);

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
          setRenderedComponent("list");
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
          setRenderedComponent("list");
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

  const localViews = [
    {
      id: "dashboard",
      label: "Vue d'ensemble",
      onClick: () => {
        setRenderState(0);
        setRenderedComponent("dashboard");
      },
      active: renderState === 0,
    },
    {
      id: "list",
      label: "Liste",
      onClick: () => {
        setSelectedPlanPaiement(null);
        setRenderState(1);
        setRenderedComponent("list");
      },
      active: renderState === 1,
    },
    {
      id: "parametre",
      label: "Parametres",
      onClick: () => {
        setRenderState(2);
        setRenderedComponent("parametre");
      },
      active: renderState === 2,
    },
    {
      id: "add",
      label: "Nouveau plan",
      onClick: () => {
        setRenderState(3);
        setRenderedComponent("add");
      },
      active: renderState === 3,
      tone: "primary" as const,
    },
  ];

  return (
    <FinanceModuleLayout
      title="Plans de paiement"
      description="Echeanciers et tranches de reglement par eleve et annee scolaire."
      currentModule="plans_de_paiement"
      localViews={localViews}
    >
      <div className="min-w-0">{render}</div>
    </FinanceModuleLayout>
  );
}
