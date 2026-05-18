import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotateRight, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";

type DataTableErrorStateProps = {
  message: string;
  onRetry: () => void;
  disabled?: boolean;
};

export default function DataTableErrorState({
  message,
  onRetry,
  disabled = false,
}: DataTableErrorStateProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-[22px] border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-rose-600">
          <FontAwesomeIcon icon={faTriangleExclamation} />
        </span>
        <div>
          <p className="text-sm font-bold">Impossible de charger les données</p>
          <p className="text-sm text-rose-700">{message}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        disabled={disabled}
        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-white px-3 py-2 text-sm font-bold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <FontAwesomeIcon icon={faRotateRight} />
        Réessayer
      </button>
    </div>
  );
}
