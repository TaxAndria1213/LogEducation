import React from "react";

type Props = {
  children: React.ReactNode;
};

function Page({ children }: Props) {
  return (
    <div className="relative min-h-full rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-sm font-sans backdrop-blur">
      {children}
    </div>
  );
}

export default Page;
