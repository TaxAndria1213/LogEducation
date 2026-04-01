import React, { useEffect, useRef, useState } from "react";
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
  const headerRef = useRef<HTMLElement | null>(null);
  const [isCondensed, setIsCondensed] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const rect = headerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setIsCondensed(rect.top <= 72);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  return (
    <Page>
      <div className="flex min-h-full flex-col">
        <header
          ref={headerRef}
          className={`sticky z-20 -mx-6 -mt-6 border-b border-slate-200 bg-white/95 backdrop-blur-sm transition-all duration-200 ${
            isCondensed ? "top-[68px] px-6 py-2.5" : "top-[68px] px-6 py-4"
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className={isCondensed ? "" : "space-y-1"}>
                <Title1 title={title} />
                {!isCondensed ? <Paragraph description={description} /> : null}
              </div>
            </div>

            {headerActions.length > 0 ? (
              <div className="max-w-full shrink-0">
                <div
                  className="erp-page-header-actions flex flex-wrap items-center justify-end gap-2"
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
