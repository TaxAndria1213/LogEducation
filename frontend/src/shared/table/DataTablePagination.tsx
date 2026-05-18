import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { ReactNode } from "react";
import {
  faAnglesLeft,
  faAnglesRight,
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";

type DataTablePaginationProps = {
  page: number;
  pageCount: number;
  take: number;
  total: number;
  pageSizes: number[];
  loading?: boolean;
  onPageChange: (page: number) => void;
  onTakeChange: (take: number) => void;
};

function PaginationButton({
  label,
  disabled,
  onClick,
  icon,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  icon: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-45"
    >
      {icon}
    </button>
  );
}

export default function DataTablePagination({
  page,
  pageCount,
  take,
  total,
  pageSizes,
  loading = false,
  onPageChange,
  onTakeChange,
}: DataTablePaginationProps) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/70 px-5 py-4 text-sm text-slate-600 lg:flex-row lg:items-center lg:justify-between">
      <div className="font-medium">
        Page <span className="font-bold text-slate-900">{page}</span> sur{" "}
        <span className="font-bold text-slate-900">{pageCount}</span>
        <span className="ml-3 text-slate-400">|</span>
        <span className="ml-3">{total} élément(s)</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
          Lignes
        </span>
        <select
          value={take}
          onChange={(event) => onTakeChange(Number(event.target.value))}
          disabled={loading}
          className="h-9 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-sky-300 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pageSizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>

        <div className="ml-1 flex items-center gap-1">
          <PaginationButton
            label="Première page"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(1)}
            icon={<FontAwesomeIcon icon={faAnglesLeft} />}
          />
          <PaginationButton
            label="Page précédente"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
            icon={<FontAwesomeIcon icon={faChevronLeft} />}
          />
          <PaginationButton
            label="Page suivante"
            disabled={page >= pageCount || loading}
            onClick={() => onPageChange(page + 1)}
            icon={<FontAwesomeIcon icon={faChevronRight} />}
          />
          <PaginationButton
            label="Dernière page"
            disabled={page >= pageCount || loading}
            onClick={() => onPageChange(pageCount)}
            icon={<FontAwesomeIcon icon={faAnglesRight} />}
          />
        </div>
      </div>
    </div>
  );
}
