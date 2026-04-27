const CONTEXT_PARAMS_STORAGE_KEY = "contextParams";
export const CONTEXT_PARAMS_UPDATED_EVENT = "logeducation:context-params-updated";

type ContextParams = {
  etablissement_id: string | null;
};

function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getStoredContextParams(): ContextParams {
  if (!canUseBrowserStorage()) {
    return { etablissement_id: null };
  }

  const raw = localStorage.getItem(CONTEXT_PARAMS_STORAGE_KEY);
  if (!raw) {
    return { etablissement_id: null };
  }

  try {
    const parsed = JSON.parse(raw) as { etablissement_id?: unknown };
    return {
      etablissement_id:
        typeof parsed?.etablissement_id === "string" && parsed.etablissement_id.trim()
          ? parsed.etablissement_id
          : null,
    };
  } catch {
    return { etablissement_id: null };
  }
}

export function setStoredContextEtablissementId(etablissementId: string | null) {
  if (!canUseBrowserStorage()) return;

  localStorage.setItem(
    CONTEXT_PARAMS_STORAGE_KEY,
    JSON.stringify({ etablissement_id: etablissementId ?? null }),
  );
  window.dispatchEvent(new CustomEvent(CONTEXT_PARAMS_UPDATED_EVENT));
}

export function clearStoredContextParams() {
  if (!canUseBrowserStorage()) return;
  localStorage.removeItem(CONTEXT_PARAMS_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(CONTEXT_PARAMS_UPDATED_EVENT));
}
