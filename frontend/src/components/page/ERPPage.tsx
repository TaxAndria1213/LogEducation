import React from "react";
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
  return (
    <Page>
      <div className="flex min-h-full flex-col">
        <header className="sticky -top-4 z-20 -mx-6 -mt-6 border-b border-slate-200 bg-white/95 px-6 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/82">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="space-y-0.5">
                <Title1 title={title} />
                <Paragraph description={description} />
              </div>
            </div>

            {headerActions.length > 0 ? (
              <div className="max-w-full overflow-x-auto">
                <div className="">
                  {headerActions}
                </div>
              </div>
            ) : null}
          </div>
        </header>

        <div className="pt-4">
          <div className="rounded-[24px] bg-[linear-gradient(180deg,_rgba(248,250,252,0.65),_rgba(255,255,255,0.92))] p-1">
            {children}
          </div>
        </div>
      </div>
    </Page>
  );
}

export default ERPPage;
