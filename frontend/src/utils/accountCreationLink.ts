import type { Role } from "../types/models";
import { parseScopeObject } from "./permissionScope";

function normalizeRoleToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

export function getRoleTemplateKey(rawScope: unknown): string | null {
  const scope = parseScopeObject(rawScope);
  return normalizeRoleToken(scope?.role_template);
}

export function findRoleByTemplate<T extends Pick<Role, "nom" | "scope_json">>(
  roles: readonly T[],
  templateKey: string,
): T | null {
  const normalizedTemplateKey = normalizeRoleToken(templateKey);
  if (!normalizedTemplateKey) return null;

  return (
    roles.find((role) => getRoleTemplateKey(role.scope_json) === normalizedTemplateKey) ??
    roles.find((role) => normalizeRoleToken(role.nom) === normalizedTemplateKey) ??
    null
  );
}

type BuildAccountCreationUrlParams = {
  roleId: string | null | undefined;
  etablissementId: string | null | undefined;
  roleName?: string | null;
  origin?: string | null;
};

export function buildAccountCreationUrl({
  roleId,
  etablissementId,
  roleName,
  origin,
}: BuildAccountCreationUrlParams): string {
  const normalizedRoleId = typeof roleId === "string" ? roleId.trim() : "";
  const normalizedEtablissementId =
    typeof etablissementId === "string" ? etablissementId.trim() : "";

  if (!normalizedRoleId || !normalizedEtablissementId) {
    throw new Error("Impossible de generer l'URL : role_id ou etablissement_id manquant.");
  }

  const resolvedOrigin =
    typeof origin === "string" && origin.trim()
      ? origin.trim()
      : typeof window !== "undefined"
        ? window.location.origin
        : "";

  if (!resolvedOrigin) {
    throw new Error("Impossible de generer l'URL : origine de l'application indisponible.");
  }

  const url = new URL("/compte/creation/", resolvedOrigin);
  url.searchParams.set("role_id", normalizedRoleId);
  url.searchParams.set("etablissement_id", normalizedEtablissementId);

  if (typeof roleName === "string" && roleName.trim()) {
    url.searchParams.set("role_name", roleName.trim());
  }

  return url.toString();
}
