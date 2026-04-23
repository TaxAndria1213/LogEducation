import React, { useEffect, useState } from "react";
import Page from "./Page";
import Title1 from "../text/Title1";
import Paragraph from "../text/Paragraph";

type PageProps = {
  title: string;
  description: string;
  headerActions?: React.ReactNode[];
  children?: React.ReactNode;
};

function ERPPage({ title, description, headerActions = [], children }: PageProps) {
  const [isCondensed, setIsCondensed] = useState(false);

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
    <Page>
      <div className="flex min-h-full flex-col">
        <header
          className={`sticky top-[68px] z-20 -mx-6 -mt-6 border-b border-slate-200 bg-white/95 px-6 backdrop-blur-sm transition-all duration-200 ${
            isCondensed ? "min-h-[64px] py-2" : "min-h-[86px] py-3.5"
          }`}
        >
          <div
            className={`flex items-center justify-between gap-4 transition-all duration-200 ${
              isCondensed ? "min-h-[40px]" : "min-h-[60px]"
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="space-y-1">
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

            {headerActions.length > 0 ? (
              <div className="max-w-full shrink-0">
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
              </div>
            ) : null}
          </div>
        </header>

        <div className="pt-5">{children}</div>
      </div>
    </Page>
  );
}

export default ERPPage;
