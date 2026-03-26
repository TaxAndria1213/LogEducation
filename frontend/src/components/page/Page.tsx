import React from "react";

type Props = {
  children: React.ReactNode;
};

function Page({ children }: Props) {
  return (
    <div className="relative min-h-full rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm font-sans">
      {children}
    </div>
  );
}

export default Page;
