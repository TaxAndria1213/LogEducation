import React from "react";

type Props = {
  children: React.ReactNode;
};

function Page({ children }: Props) {
  return (
    <div className="relative min-h-full overflow-visible rounded-[30px] border border-white/70 bg-white p-6 shadow-[0_22px_50px_rgba(15,23,42,0.08)] font-sans backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28" />
      <div className="relative">{children}</div>
    </div>
  );
}

export default Page;
