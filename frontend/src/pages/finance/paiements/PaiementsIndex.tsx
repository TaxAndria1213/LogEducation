import { useEffect, useMemo, useState, type JSX } from "react";
import NotFound from "../../NotFound";
import { useAuth } from "../../../auth/AuthContext";
import PaiementService, { type PaiementWithRelations } from "../../../services/paiement.service";
import FinanceModuleLayout from "../components/FinanceModuleLayout";
import { usePaiementStore } from "./store/PaiementIndexStore";
import {
  clearFinanceNavigationTarget,
  readFinanceNavigationTarget,
} from "../utils/crossNavigation";

export default function PaiementsIndex() {
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
  const { etablissement_id } = useAuth();
  const service = useMemo(() => new PaiementService(), []);
  const renderState = usePaiementStore((state) => state.renderState);
  const renderedElement = usePaiementStore((state) => state.renderedComponent);
  const setRenderState = usePaiementStore((state) => state.setRenderState);
  const setRenderedComponent = usePaiementStore((state) => state.setRenderedComponent);
  const setSelectedPaiement = usePaiementStore((state) => state.setSelectedPaiement);

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
      label: "Historique",
      onClick: () => {
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
      label: "Nouvel encaissement",
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
      title="Paiements"
      description="Encaissements et suivi des paiements rattaches aux factures."
      currentModule="paiements"
      localViews={localViews}
    >
      <div className="min-w-0">{render}</div>
    </FinanceModuleLayout>
  );
}
