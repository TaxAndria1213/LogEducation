import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faRotateRight } from "@fortawesome/free-solid-svg-icons";

type DataTableToolbarProps = {
  title?: string;
  total: number;
  search: string;
  showSearch: boolean;
  loading?: boolean;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onReset: () => void;
};

export default function DataTableToolbar({
  title,
  total,
  search,
  showSearch,
  loading = false,
  onSearchChange,
  onSearchSubmit,
  onReset,
}: DataTableToolbarProps) {
  if (!title && !showSearch) return null;

  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 bg-white px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        {title ? (
          <h3 className="truncate text-base font-black tracking-tight text-slate-950">
            {title}
          </h3>
        ) : null}
        <p className="mt-1 text-sm text-slate-500">{total} élément(s)</p>
      </div>

      {showSearch ? (
        <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-xl">
          <div className="relative min-w-0 flex-1">
            <FontAwesomeIcon
              icon={faMagnifyingGlass}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onSearchSubmit();
              }}
              placeholder="Rechercher..."
              className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-10 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:ring-2 focus:ring-sky-100"
            />
          </div>

          <button
            type="button"
            onClick={onSearchSubmit}
            disabled={loading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FontAwesomeIcon icon={faMagnifyingGlass} />
            Chercher
          </button>

          <button
            type="button"
            title="Actualiser"
            aria-label="Actualiser"
            onClick={onReset}
            disabled={loading}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-11 sm:px-0"
          >
            <FontAwesomeIcon icon={faRotateRight} />
            <span className="sm:hidden">Actualiser</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
