import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PersistedSession, RoleName } from "@/types/models";

const SESSION_KEY = "logeducation.mobile.session";

export async function loadSession() {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PersistedSession;
  } catch {
    return null;
  }
}

export async function saveSession(session: PersistedSession) {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function updateSessionTokens(
  accessToken: string,
  refreshToken?: string,
) {
  const current = await loadSession();
  if (!current) return;

  await saveSession({
    ...current,
    tokens: {
      accessToken,
      refreshToken: refreshToken ?? current.tokens.refreshToken,
    },
  });
}

export async function updateActiveRole(role: RoleName) {
  const current = await loadSession();
  if (!current) return;
  await saveSession({ ...current, activeRole: role });
}

export async function clearSession() {
  await AsyncStorage.removeItem(SESSION_KEY);
}
