import { useEffect, useState, type JSX } from "react";
import NotFound from "../../NotFound";
import FinanceModuleLayout from "../components/FinanceModuleLayout";
import { useRemiseStore } from "./store/RemiseIndexStore";

export default function RemisesIndex() {
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
  const renderState = useRemiseStore((state) => state.renderState);
  const renderedElement = useRemiseStore((state) => state.renderedComponent);
  const setRenderState = useRemiseStore((state) => state.setRenderState);
  const setRenderedComponent = useRemiseStore((state) => state.setRenderedComponent);

  useEffect(() => {
    if (renderedElement) setRender(renderedElement);
  }, [renderedElement]);

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
      label: "Liste",
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
      label: "Nouvelle remise",
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
      title="Remises"
      description="Regles et reductions applicables aux frais et facturations."
      currentModule="remises"
      localViews={localViews}
    >
      <div className="min-w-0">{render}</div>
    </FinanceModuleLayout>
  );
}
