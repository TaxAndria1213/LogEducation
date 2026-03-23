import type { PersistedSession } from "@/types/models";

let currentSession: PersistedSession | null = null;
let unauthorizedHandler: null | (() => Promise<void> | void) = null;

export function setRuntimeSession(session: PersistedSession | null) {
  currentSession = session;
}

export function getRuntimeSession() {
  return currentSession;
}

export function updateRuntimeTokens(accessToken: string, refreshToken?: string) {
  if (!currentSession) return;
  currentSession = {
    ...currentSession,
    tokens: {
      accessToken,
      refreshToken: refreshToken ?? currentSession.tokens.refreshToken,
    },
  };
}

export function registerUnauthorizedHandler(
  handler: () => Promise<void> | void,
) {
  unauthorizedHandler = handler;
}

export async function notifyUnauthorized() {
  await unauthorizedHandler?.();
}
