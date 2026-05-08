import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";
import {
  loadAcademicBundle,
  loadAgendaBundle,
  loadHomeBundle,
  loadOperationsBundle,
  loadPresenceBundle,
} from "@/services/mobileData.service";
import type { PersistedSession } from "@/types/models";

function useSessionQuery<T>(
  key: string,
  loader: (session: PersistedSession) => Promise<T>,
  enabled = true,
) {
  const { session, status, activeRole } = useAuth();

  return useQuery({
    queryKey: [key, session?.user.id, activeRole],
    queryFn: () => loader(session!),
    enabled: status === "authenticated" && !!session && enabled,
  });
}

export function useHomeBundle(enabled = true) {
  return useSessionQuery("mobile-home", loadHomeBundle, enabled);
}

export function useAgendaBundle(enabled = true) {
  return useSessionQuery("mobile-agenda", loadAgendaBundle, enabled);
}

export function usePresenceBundle(enabled = true) {
  return useSessionQuery("mobile-presence", loadPresenceBundle, enabled);
}

export function useAcademicBundle(enabled = true) {
  return useSessionQuery("mobile-academic", loadAcademicBundle, enabled);
}

export function useOperationsBundle(enabled = true) {
  return useSessionQuery("mobile-operations", loadOperationsBundle, enabled);
}
