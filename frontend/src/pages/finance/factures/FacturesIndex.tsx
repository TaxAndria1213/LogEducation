import { useEffect, useMemo, useState, type JSX } from "react";
import NotFound from "../../NotFound";
import { useAuth } from "../../../auth/AuthContext";
import FactureService, { type FactureWithRelations } from "../../../services/facture.service";
import FinanceModuleLayout from "../components/FinanceModuleLayout";
import { useFactureStore } from "./store/FactureIndexStore";
import {
  clearFinanceNavigationTarget,
  readFinanceNavigationTarget,
} from "../utils/crossNavigation";

export default function FacturesIndex() {
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
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
        setRenderState("dashboard");
        setRenderedComponent("dashboard");
      },
      active: renderState === "dashboard",
    },
    {
      id: "list",
      label: "Liste des factures",
      onClick: () => {
        setSelectedFacture(null);
        setRenderState("list");
        setRenderedComponent("list");
      },
      active: renderState === "list",
    },
    {
      id: "parametre",
      label: "Parametres",
      onClick: () => {
        setRenderState("parametre");
        setRenderedComponent("parametre");
      },
      active: renderState === "parametre",
    },
    {
      id: "add",
      label: "Nouvelle facture",
      onClick: () => {
        setRenderState("add");
        setRenderedComponent("add");
      },
      active: renderState === "add",
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
