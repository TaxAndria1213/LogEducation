import type React from "react";

type Props = {
  icon: React.ReactNode;
  onClick?: () => void;
  w?: number;
  h?: number;
  size?: number;
};

function IconButton({ icon, w = 42, h = 42, onClick, size }: Props) {
  const dimension = size ?? undefined;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: dimension ? `${dimension}px` : `${w}px`,
        height: dimension ? `${dimension}px` : `${h}px`,
      }}
      className="inline-flex cursor-pointer items-center justify-center rounded-[18px] border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
    >
      {icon}
    </button>
  );
}

export default IconButton;
