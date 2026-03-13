import React from "react";

type Props = {
  children: React.ReactNode;
};

function Page({ children }: Props) {

  return <div className="bg-white p-6 h-[100%] overflow-auto rounded font-sans">
    {children}
  </div>;
}

export default Page;
