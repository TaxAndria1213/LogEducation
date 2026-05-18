import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FiArrowLeft } from "react-icons/fi";
import { useLocation, useNavigate } from "react-router-dom";
import Page from "./Page";
import Title1 from "../text/Title1";
import Paragraph from "../text/Paragraph";
import {
  ERPPageBackButtonContext,
  type ERPPageBackButtonConfig,
} from "./ERPPageBackButtonContext";
import { useERPPageNavigationMode } from "./navigationPreference";

type PageProps = {
  title: string;
  description: string;
  headerActions?: React.ReactNode[];
  backButton?: {
    to?: string;
    onClick?: () => void;
    label?: string;
  } | null;
  children?: React.ReactNode;
};

type BackButtonConfig = ERPPageBackButtonConfig;

function ERPPage({ title, description, headerActions = [], backButton = null, children }: PageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const navigationMode = useERPPageNavigationMode();
  const [isCondensed, setIsCondensed] = useState(false);
  const [backButtonOverride, setBackButtonOverrideState] = useState<{
    ownerId: string;
    value: BackButtonConfig | null;
  } | null>(null);

  const setBackButtonOverride = useCallback((ownerId: string, value: BackButtonConfig | null) => {
    setBackButtonOverrideState((current) => {
      if (value) {
        return { ownerId, value };
      }

      if (!current || current.ownerId !== ownerId) {
        return current;
      }

      return null;
    });
  }, []);

  const backButtonContextValue = useMemo(
    () => ({
      setBackButtonOverride,
    }),
    [setBackButtonOverride],
  );

  const autoBackButton = useMemo<BackButtonConfig | null>(() => {
    const segments = location.pathname.split("/").filter(Boolean);
    const lowerSegments = segments.map((segment) => segment.toLowerCase());
    const hasNavigationKeyword = lowerSegments.some((segment) =>
      [
        "edit",
        "resume",
        "dossier",
        "detail",
        "details",
        "view",
        "show",
        "create",
        "new",
      ].includes(segment),
    );
    const isDeepPath = segments.length >= 4;
    const historyIndex =
      typeof window !== "undefined" &&
      typeof window.history.state === "object" &&
      window.history.state !== null &&
      typeof (window.history.state as { idx?: unknown }).idx === "number"
        ? Number((window.history.state as { idx?: unknown }).idx)
        : null;
    const canNavigateBack = historyIndex === null ? window.history.length > 1 : historyIndex > 0;

    if (!canNavigateBack) return null;
    if (!hasNavigationKeyword && !isDeepPath) return null;

    return {
      label: "Retour",
      onClick: () => navigate(-1),
    };
  }, [location.pathname, navigate]);

  const resolvedBackButton = backButtonOverride?.value ?? backButton ?? autoBackButton;

  useEffect(() => {
    let frame = 0;
    const CONDENSE_AFTER = 20;
    const EXPAND_BEFORE = 8;

    const updateCondensedState = () => {
      frame = 0;
      const scrollTop =
        window.scrollY ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0;

      setIsCondensed((current) =>
        current ? scrollTop > EXPAND_BEFORE : scrollTop > CONDENSE_AFTER,
      );
    };

    const scheduleUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateCondensedState);
    };

    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, []);

  return (
    <ERPPageBackButtonContext.Provider value={backButtonContextValue}>
      <Page>
        <div className="flex min-h-full flex-col">
          <header
            className={`sticky top-[68px] z-40 -mx-6 -mt-6 border-b border-slate-200 bg-white/95 px-6 backdrop-blur-sm transition-all duration-200 ${
              isCondensed ? "min-h-[64px] py-2" : "min-h-[86px] py-3.5"
            }`}
          >
            <div
              className={`flex items-center justify-between gap-4 transition-all duration-200 ${
                isCondensed ? "min-h-[40px]" : "min-h-[60px]"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-3">
                  {resolvedBackButton ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof resolvedBackButton.onClick === "function") {
                          resolvedBackButton.onClick();
                          return;
                        }

                        if (
                          typeof resolvedBackButton.to === "string" &&
                          resolvedBackButton.to.trim()
                        ) {
                          navigate(resolvedBackButton.to);
                          return;
                        }

                        navigate(-1);
                      }}
                      aria-label={resolvedBackButton.label ?? "Retour"}
                      title={resolvedBackButton.label ?? "Retour"}
                      className={`mt-0.5 inline-flex shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 ${
                        isCondensed ? "h-9 w-9" : "h-10 w-10"
                      }`}
                    >
                      <FiArrowLeft className="h-4 w-4" />
                    </button>
                  ) : null}

                  <div className="min-w-0 flex-1 space-y-1">
                    <div
                      className={`transition-all duration-200 ${
                        isCondensed
                          ? "[&>div>h1]:text-[16px] md:[&>div>h1]:text-[18px]"
                          : ""
                      }`}
                    >
                      <Title1 title={title} />
                    </div>
                    <div
                      aria-hidden={isCondensed}
                      className={`overflow-hidden transition-all duration-200 ${
                        isCondensed
                          ? "max-h-0 translate-y-[-4px] opacity-0"
                          : "max-h-12 translate-y-0 opacity-100"
                      }`}
                    >
                      <Paragraph description={description} />
                    </div>
                  </div>
                </div>
              </div>

              {headerActions.length > 0 ? (
                <div className="max-w-full shrink-0">
                  {navigationMode === "inline" ? (
                    <div
                      className={`erp-page-header-actions flex max-w-[min(52rem,48vw)] flex-wrap items-center justify-end transition-all duration-200 ${
                        isCondensed ? "gap-1.5" : "gap-2"
                      }`}
                      data-erp-header-actions="true"
                      data-erp-header-inline-menu="true"
                    >
                      {headerActions.slice(1).map((action, index) => (
                        <div key={index} className="relative shrink-0">
                          {action}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      className={`erp-page-header-actions flex flex-wrap items-center justify-end transition-all duration-200 ${
                        isCondensed ? "gap-1.5" : "gap-2"
                      }`}
                      data-erp-header-actions="true"
                    >
                      {headerActions.map((action, index) => (
                        <div
                          key={index}
                          className="relative shrink-0"
                          data-erp-header-action-trigger={index === 0 ? "true" : undefined}
                        >
                          {action}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </header>

          <div className="pt-5">{children}</div>
        </div>
      </Page>
    </ERPPageBackButtonContext.Provider>
  );
}

export default ERPPage;
