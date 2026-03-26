export type FinanceTargetModule = "factures" | "paiements" | "plans_paiement";

type FinanceNavigationPayload = {
  module: FinanceTargetModule;
  id?: string | null;
  record?: unknown;
  view?: "detail";
  timestamp: number;
};

const STORAGE_KEY = "logeducation.finance.cross-navigation";

function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function queueFinanceNavigationTarget(payload: Omit<FinanceNavigationPayload, "timestamp">) {
  if (!canUseSessionStorage()) return;
  window.sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...payload,
      view: payload.view ?? "detail",
      timestamp: Date.now(),
    } satisfies FinanceNavigationPayload),
  );
}

export function readFinanceNavigationTarget(module: FinanceTargetModule): FinanceNavigationPayload | null {
  if (!canUseSessionStorage()) return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<FinanceNavigationPayload>;
    if (parsed.module !== module) return null;
    return {
      module,
      id: typeof parsed.id === "string" ? parsed.id : null,
      record: parsed.record,
      view: parsed.view === "detail" ? "detail" : "detail",
      timestamp: typeof parsed.timestamp === "number" ? parsed.timestamp : Date.now(),
    };
  } catch {
    return null;
  }
}

export function clearFinanceNavigationTarget() {
  if (!canUseSessionStorage()) return;
  window.sessionStorage.removeItem(STORAGE_KEY);
}

export function getFinanceModulePath(module: FinanceTargetModule) {
  switch (module) {
    case "factures":
      return "/finance/factures";
    case "paiements":
      return "/finance/paiements";
    case "plans_paiement":
      return "/finance/plans_de_paiement";
    default:
      return "/finance";
  }
}
