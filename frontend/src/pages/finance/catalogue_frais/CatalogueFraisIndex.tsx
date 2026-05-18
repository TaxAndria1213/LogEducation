import { useEffect, useState, type JSX } from "react";
import PreloadPage from "../../PreloadPage";
import FinanceModuleLayout from "../components/FinanceModuleLayout";
import { useCatalogueFraisStore } from "./store/CatalogueFraisIndexStore";

export default function CatalogueFraisIndex() {
  const [render, setRender] = useState<JSX.Element>(<PreloadPage />);
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
        setRenderState(0);
        setRenderedComponent("dashboard");
      },
      active: renderState === 0,
    },
    {
      id: "list",
      label: "Liste",
      onClick: () => {
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
      label: "Nouveau frais",
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
      title="Catalogue de frais"
      description="Tarifs et frais reutilisables pour l'inscription, la facturation et les services."
      currentModule="catalogue_frais"
      localViews={localViews}
    >
      <div className="min-w-0">{render}</div>
    </FinanceModuleLayout>
  );
}
