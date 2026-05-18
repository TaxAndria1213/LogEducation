export const tableStyles = {
  shell:
    "overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]",
  toolbar:
    "flex flex-col gap-4 border-b border-slate-200 bg-white px-5 py-4 lg:flex-row lg:items-center lg:justify-between",
  scroll: "overflow-x-auto",
  table: "min-w-full border-separate border-spacing-0 text-sm",
  header:
    "sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 backdrop-blur",
  cell:
    "max-w-[280px] border-b border-slate-100 px-4 py-3 align-middle text-sm text-slate-700",
  row:
    "group transition hover:bg-sky-50/45 focus-within:bg-sky-50/45",
  actionCell:
    "sticky right-0 z-[1] w-0 border-b border-slate-100 bg-white/95 px-4 py-3 align-middle shadow-[-12px_0_24px_rgba(255,255,255,0.88)] backdrop-blur group-hover:bg-sky-50/95",
};

function includesAny(value: string, tokens: string[]) {
  return tokens.some((token) => value.includes(token));
}

export function getColumnAlignmentClass(key: string) {
  const normalized = key.toLowerCase();

  if (
    includesAny(normalized, [
      "montant",
      "total",
      "prix",
      "solde",
      "quantite",
      "nombre",
      "score",
      "moyenne",
      "coefficient",
      "rang",
      "ordre",
      "capacite",
    ])
  ) {
    return "text-right";
  }

  if (
    includesAny(normalized, [
      "date",
      "created",
      "updated",
      "statut",
      "status",
      "etat",
      "type",
    ])
  ) {
    return "text-center";
  }

  return "text-left";
}

export function isStatusColumn(key: string) {
  const normalized = key.toLowerCase();
  return normalized.includes("statut") || normalized.includes("status") || normalized.includes("etat");
}
