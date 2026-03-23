import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ROLE_PRIORITY } from "@/constants/roles";
import { queryClient } from "@/lib/query";
import { registerUnauthorizedHandler, setRuntimeSession } from "@/lib/session";
import { clearSession, loadSession, saveSession, updateActiveRole } from "@/lib/storage";
import { authService } from "@/services/auth.service";
import type { PersistedSession, RoleName } from "@/types/models";

type AuthStatus = "booting" | "guest" | "authenticated";

type AuthContextValue = {
  status: AuthStatus;
  session: PersistedSession | null;
  availableRoles: RoleName[];
  activeRole: RoleName | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  switchRole: (role: RoleName) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function parseScopeObject(rawScope: unknown): Record<string, unknown> | null {
  if (!rawScope) return null;

  if (typeof rawScope === "string") {
    try {
      const parsed = JSON.parse(rawScope);
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  return typeof rawScope === "object"
    ? (rawScope as Record<string, unknown>)
    : null;
}

function normalizeRoleName(value?: string | null): RoleName | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();

  switch (normalized) {
    case "ADMIN":
    case "DIRECTION":
    case "SECRETARIAT":
    case "ENSEIGNANT":
    case "COMPTABLE":
    case "SURVEILLANT":
    case "PARENT":
    case "ELEVE":
      return normalized;
    default:
      return null;
  }
}

function resolveAssignmentRoleName(assignment: {
  role?: { nom?: string | null; scope_json?: unknown } | null;
}) {
  const scope = parseScopeObject(assignment.role?.scope_json);
  const template = normalizeRoleName(
    typeof scope?.role_template === "string" ? scope.role_template : null,
  );

  return template ?? normalizeRoleName(assignment.role?.nom);
}

function extractRoles(session: PersistedSession | null): RoleName[] {
  const names = Array.from(
    new Set(
      session?.user.roles
        ?.map((assignment) => resolveAssignmentRoleName(assignment))
        .filter(Boolean) ?? [],
    ),
  ) as RoleName[];

  return ROLE_PRIORITY.filter((role) => names.includes(role));
}

function selectDefaultRole(names: RoleName[]) {
  return names[0] ?? "SECRETARIAT";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("booting");
  const [session, setSession] = useState<PersistedSession | null>(null);

  const availableRoles = useMemo(() => extractRoles(session), [session]);
  const activeRole = session?.activeRole ?? null;

  const hydrateSession = useCallback(async () => {
    const stored = await loadSession();
    if (stored) {
      setSession(stored);
      setRuntimeSession(stored);
      setStatus("authenticated");
      return;
    }

    setRuntimeSession(null);
    setStatus("guest");
  }, []);

  useEffect(() => {
    hydrateSession();
  }, [hydrateSession]);

  const signOut = useCallback(async () => {
    await clearSession();
    queryClient.clear();
    setRuntimeSession(null);
    setSession(null);
    setStatus("guest");
  }, []);

  useEffect(() => {
    registerUnauthorizedHandler(signOut);
  }, [signOut]);

  const signIn = useCallback(async (email: string, password: string) => {
    const data = await authService.login(email, password);
    const roles = Array.from(
      new Set(
        data.user.roles
          ?.map((assignment) => resolveAssignmentRoleName(assignment))
          .filter(Boolean) ?? [],
      ),
    ) as RoleName[];

    const activeRoleName = selectDefaultRole(
      ROLE_PRIORITY.filter((role) => roles.includes(role)),
    );

    const nextSession: PersistedSession = {
      user: data.user,
      tokens: data.result,
      activeRole: activeRoleName,
    };

    await saveSession(nextSession);
    setRuntimeSession(nextSession);
    setSession(nextSession);
    setStatus("authenticated");
    queryClient.clear();
  }, []);

  const switchRole = useCallback(
    async (role: RoleName) => {
      if (!session) return;
      const nextSession = {
        ...session,
        activeRole: role,
      };
      await updateActiveRole(role);
      setRuntimeSession(nextSession);
      setSession(nextSession);
      queryClient.invalidateQueries();
    },
    [session],
  );

  const value = useMemo(
    () => ({
      status,
      session,
      availableRoles,
      activeRole,
      signIn,
      signOut,
      switchRole,
    }),
    [status, session, availableRoles, activeRole, signIn, signOut, switchRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
