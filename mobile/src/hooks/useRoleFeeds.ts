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
) {
  const { session, status, activeRole } = useAuth();

  return useQuery({
    queryKey: [key, session?.user.id, activeRole],
    queryFn: () => loader(session!),
    enabled: status === "authenticated" && !!session,
  });
}

export function useHomeBundle() {
  return useSessionQuery("mobile-home", loadHomeBundle);
}

export function useAgendaBundle() {
  return useSessionQuery("mobile-agenda", loadAgendaBundle);
}

export function usePresenceBundle() {
  return useSessionQuery("mobile-presence", loadPresenceBundle);
}

export function useAcademicBundle() {
  return useSessionQuery("mobile-academic", loadAcademicBundle);
}

export function useOperationsBundle() {
  return useSessionQuery("mobile-operations", loadOperationsBundle);
}
