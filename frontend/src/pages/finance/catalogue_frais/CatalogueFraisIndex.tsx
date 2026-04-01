import { useEffect, useState, type JSX } from "react";
import NotFound from "../../NotFound";
import FinanceModuleLayout from "../components/FinanceModuleLayout";
import { useCatalogueFraisStore } from "./store/CatalogueFraisIndexStore";

export default function CatalogueFraisIndex() {
  const [render, setRender] = useState<JSX.Element>(<NotFound />);
  const renderState = useCatalogueFraisStore((state) => state.renderState);
  const renderedElement = useCatalogueFraisStore((state) => state.renderedComponent);
  const setRenderState = useCatalogueFraisStore((state) => state.setRenderState);
  const setRenderedComponent = useCatalogueFraisStore((state) => state.setRenderedComponent);

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
      label: "Nouveau frais",
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
      title="Catalogue de frais"
      description="Tarifs et frais reutilisables pour l'inscription, la facturation et les services."
      currentModule="catalogue_frais"
      localViews={localViews}
    >
      <div className="min-w-0">{render}</div>
    </FinanceModuleLayout>
  );
}
