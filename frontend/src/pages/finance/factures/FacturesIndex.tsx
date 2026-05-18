import { useEffect, useMemo, useState, type JSX } from "react";
import PreloadPage from "../../PreloadPage";
import { useAuth } from "../../../auth/AuthContext";
import FactureService, { type FactureWithRelations } from "../../../services/facture.service";
import FinanceModuleLayout from "../components/FinanceModuleLayout";
import { useFactureStore } from "./store/FactureIndexStore";
import {
  clearFinanceNavigationTarget,
  readFinanceNavigationTarget,
} from "../utils/crossNavigation";

export default function FacturesIndex() {
  const [render, setRender] = useState<JSX.Element>(<PreloadPage />);
  const { etablissement_id } = useAuth();
  const service = useMemo(() => new FactureService(), []);
  const renderState = useFactureStore((state) => state.renderState);
  const renderedElement = useFactureStore((state) => state.renderedComponent);
  const setRenderState = useFactureStore((state) => state.setRenderState);
  const setRenderedComponent = useFactureStore((state) => state.setRenderedComponent);
  const setSelectedFacture = useFactureStore((state) => state.setSelectedFacture);

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
  }, [etablissement_id, service, setRenderedComponent, setSelectedFacture]);

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
      label: "Liste des factures",
      onClick: () => {
        setSelectedFacture(null);
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
      label: "Nouvelle facture",
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
      title="Factures"
      description="Emission et suivi des creances eleves."
      currentModule="factures"
      localViews={localViews}
    >
      <div className="min-w-0">{render}</div>
    </FinanceModuleLayout>
  );
}
