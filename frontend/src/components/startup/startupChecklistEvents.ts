export const STARTUP_CHECKLIST_REFRESH_EVENT =
  "logesco:startup-checklist-refresh";

export function notifyStartupChecklistChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(STARTUP_CHECKLIST_REFRESH_EVENT));
}
