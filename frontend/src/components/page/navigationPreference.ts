import { useEffect, useState } from "react";

export type ERPPageNavigationMode = "dropdown" | "inline";

const STORAGE_KEY = "logesco.erp-page.navigation-mode";
const CHANGE_EVENT = "logesco:erp-page-navigation-mode-change";

function isNavigationMode(value: unknown): value is ERPPageNavigationMode {
  return value === "dropdown" || value === "inline";
}

export function getERPPageNavigationMode(): ERPPageNavigationMode {
  if (typeof window === "undefined") return "dropdown";

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isNavigationMode(stored) ? stored : "dropdown";
  } catch {
    return "dropdown";
  }
}

export function setERPPageNavigationMode(mode: ERPPageNavigationMode) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: mode }));
  } catch {
    return;
  }
}

export function useERPPageNavigationMode() {
  const [mode, setMode] = useState<ERPPageNavigationMode>(getERPPageNavigationMode);

  useEffect(() => {
    const handlePreferenceChange = (event: Event) => {
      const nextMode =
        event instanceof CustomEvent && isNavigationMode(event.detail)
          ? event.detail
          : getERPPageNavigationMode();
      setMode(nextMode);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        setMode(isNavigationMode(event.newValue) ? event.newValue : "dropdown");
      }
    };

    window.addEventListener(CHANGE_EVENT, handlePreferenceChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(CHANGE_EVENT, handlePreferenceChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return mode;
}
