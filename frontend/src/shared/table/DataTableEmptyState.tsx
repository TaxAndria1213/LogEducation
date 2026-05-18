import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faInbox } from "@fortawesome/free-solid-svg-icons";

type DataTableEmptyStateProps = {
  colSpan: number;
};

export default function DataTableEmptyState({ colSpan }: DataTableEmptyStateProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-16 text-center">
        <div className="mx-auto flex max-w-sm flex-col items-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-xl text-slate-400">
            <FontAwesomeIcon icon={faInbox} />
          </div>
          <p className="mt-4 text-sm font-bold text-slate-900">Aucune donnée trouvée</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Essayez de modifier vos filtres ou ajoutez un nouvel élément.
          </p>
        </div>
      </td>
    </tr>
  );
}
