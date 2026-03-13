import React from "react";
import Page from "./Page";
import Title1 from "../text/Title1";
import Paragraph from "../text/Paragraph";
// import { useAuth } from "../../auth/AuthContext";

type pageProps = {
  title: string;
  description: string;
  headerActions?: React.ReactElement[];
  children?: React.ReactElement;
};
function ERPPage({ title, description, headerActions, children }: pageProps) {
  return (
    <Page>
      <header className="flex items-center justify-between mb-4">
        <div>
          <Title1 title={title} />
          <Paragraph description={description} />
        </div>
        <div>
          {
            headerActions && (
              <div className="flex items-center gap-2">
                {headerActions}
              </div>
            )
          }
        </div>  
      </header>
      
      {children}
    </Page>
  );
}

export default ERPPage;
