export function getInputClassName(hasError?: boolean) {
  return [
    "w-full rounded-2xl border px-4 py-3 text-sm text-slate-900 shadow-sm transition outline-none",
    "bg-white/95 placeholder:text-slate-400",
    "focus:border-sky-400 focus:ring-4 focus:ring-sky-100",
    hasError
      ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100"
      : "border-slate-200 hover:border-slate-300",
  ].join(" ");
}

export function getSurfaceClassName(hasError?: boolean) {
  return [
    "rounded-2xl border bg-white/95 shadow-sm transition",
    hasError ? "border-rose-300" : "border-slate-200",
  ].join(" ");
}
