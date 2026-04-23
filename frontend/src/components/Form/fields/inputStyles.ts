export function getInputClassName(hasError?: boolean) {
  return [
    "min-h-11 w-full min-w-0 max-w-full rounded-2xl border px-3 py-2.5 text-base leading-5 text-slate-900 align-middle shadow-sm transition outline-none sm:min-h-12 sm:px-4 sm:py-3 sm:text-sm",
    "bg-white/95 placeholder:text-slate-400",
    "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500",
    "focus:border-sky-400 focus:ring-4 focus:ring-sky-100",
    hasError
      ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
      : "border-slate-200 hover:border-slate-300",
  ].join(" ");
}

export function getSurfaceClassName(hasError?: boolean) {
  return [
    "min-w-0 max-w-full rounded-2xl border bg-white/95 shadow-sm transition",
    hasError ? "border-rose-300" : "border-slate-200",
  ].join(" ");
}

export function getMultiSelectClassName(hasError?: boolean) {
  return [getInputClassName(hasError), "min-h-32 overflow-auto py-2"].join(" ");
}

export function getFileInputClassName(hasError?: boolean) {
  return [
    getInputClassName(hasError),
    "cursor-pointer file:mr-3 file:rounded-xl file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white file:transition hover:file:bg-slate-800",
  ].join(" ");
}
