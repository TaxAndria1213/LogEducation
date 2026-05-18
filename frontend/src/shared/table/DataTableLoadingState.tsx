type DataTableLoadingStateProps = {
  colSpan: number;
  rows?: number;
};

export default function DataTableLoadingState({
  colSpan,
  rows = 5,
}: DataTableLoadingStateProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, index) => (
        <tr key={index} className="animate-pulse">
          <td colSpan={colSpan} className="px-4 py-3">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-2xl bg-slate-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-2/3 rounded-full bg-slate-100" />
                <div className="h-3 w-1/3 rounded-full bg-slate-100" />
              </div>
              <div className="hidden h-8 w-28 rounded-full bg-slate-100 sm:block" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}
