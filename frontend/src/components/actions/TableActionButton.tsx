import type React from "react";
import { FiEye } from "react-icons/fi";

type TableActionVariant = "primary" | "secondary" | "danger";

type Props = {
  children: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
  disabled?: boolean;
  variant?: TableActionVariant;
  className?: string;
  title?: string;
};

function getVariantClassName(variant: TableActionVariant) {
  switch (variant) {
    case "danger":
      return "border-rose-300 bg-white text-rose-700 hover:bg-rose-50";
    case "secondary":
      return "border-slate-300 bg-white text-slate-700 hover:bg-slate-50";
    case "primary":
    default:
      return "border-slate-900 bg-slate-900 text-white hover:bg-slate-800";
  }
}

export function TableViewActionLabel({ label = "Voir" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <FiEye className="text-[13px]" />
      <span>{label}</span>
    </span>
  );
}

export default function TableActionButton({
  children,
  onClick,
  disabled = false,
  variant = "primary",
  className = "",
  title,
}: Props) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs font-semibold transition",
        "disabled:cursor-not-allowed disabled:opacity-60",
        getVariantClassName(variant),
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </button>
  );
}
