export type PermissionScopeKey =
  | "permissions"
  | "allowed_permissions"
  | "denied_permissions";

export function normalizePermissionCode(code: unknown): string | null {
  if (typeof code !== "string") return null;
  const normalized = code.trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizePermissionCodes(codes: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const normalizedCodes: string[] = [];

  for (const value of codes) {
    const normalized = normalizePermissionCode(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    normalizedCodes.push(normalized);
  }

  return normalizedCodes;
}

export function parseScopeObject(rawScope: unknown): Record<string, unknown> | null {
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

export function extractPermissionCodes(
  rawScope: unknown,
  key: PermissionScopeKey,
): string[] {
  const scope = parseScopeObject(rawScope);
  const values = scope?.[key];
  return Array.isArray(values) ? normalizePermissionCodes(values) : [];
}

export function getScopePermissionCodes(rawScope: unknown): string[] {
  return extractPermissionCodes(rawScope, "permissions");
}

export function mergeScopePermissions(
  rawScope: unknown,
  permissions: readonly unknown[],
): Record<string, unknown> {
  return {
    ...(parseScopeObject(rawScope) ?? {}),
    permissions: normalizePermissionCodes(permissions),
  };
}

export function permissionMatches(
  grantedCode?: string | null,
  requestedCode?: string,
): boolean {
  const normalizedGranted = normalizePermissionCode(grantedCode);
  const normalizedRequested = normalizePermissionCode(requestedCode);

  if (!normalizedGranted || !normalizedRequested) return false;
  if (normalizedGranted === normalizedRequested) return true;

  if (normalizedGranted.endsWith(".*")) {
    return normalizedRequested.startsWith(normalizedGranted.slice(0, -1));
  }

  return false;
}
