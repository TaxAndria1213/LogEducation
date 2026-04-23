import { StatutCompte } from "@prisma/client";

const SYSTEM_ADMIN_ROLE_NAMES = new Set([
  "ADMIN",
  "ADMINISTRATEUR",
  "ADMINISTRATOR",
  "SUPER ADMIN",
  "SUPERADMIN",
]);

type SessionRoleLike = {
  nom?: string | null;
  scope_json?: unknown;
  role?: {
    nom?: string | null;
    scope_json?: unknown;
  } | null;
};

type SessionUserLike = {
  statut?: StatutCompte | string | null;
  etablissement_id?: string | null;
  scope_json?: unknown;
  roles?: SessionRoleLike[] | null;
};

type SessionEligibilityDenied = {
  allowed: false;
  code: string;
  message: string;
  statusCode: 403;
  isSystemAdmin: boolean;
  roleNames: string[];
};

type SessionEligibilityAllowed = {
  allowed: true;
  isSystemAdmin: boolean;
  roleNames: string[];
};

export type SessionEligibility =
  | SessionEligibilityAllowed
  | SessionEligibilityDenied;

type OwnerRegistrationStatus = "PENDING" | "APPROVED" | "REJECTED";

function normalizeRoleName(value: string): string {
  return value.trim().toUpperCase();
}

function parseScopeObject(rawScope: unknown): Record<string, unknown> | null {
  if (!rawScope) return null;

  if (typeof rawScope === "string") {
    try {
      const parsed = JSON.parse(rawScope);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  return typeof rawScope === "object" && !Array.isArray(rawScope)
    ? (rawScope as Record<string, unknown>)
    : null;
}

function resolveOwnerRegistrationStatus(rawScope: unknown): OwnerRegistrationStatus | null {
  const scope = parseScopeObject(rawScope);
  if (!scope) return null;

  const ownerRegistration =
    scope.owner_registration &&
    typeof scope.owner_registration === "object" &&
    !Array.isArray(scope.owner_registration)
      ? (scope.owner_registration as Record<string, unknown>)
      : null;

  const explicitStatus =
    typeof ownerRegistration?.status === "string"
      ? ownerRegistration.status.trim().toUpperCase()
      : "";

  if (
    explicitStatus === "PENDING" ||
    explicitStatus === "APPROVED" ||
    explicitStatus === "REJECTED"
  ) {
    return explicitStatus;
  }

  const option = typeof scope.option === "string" ? scope.option.trim().toLowerCase() : "";
  if (option.includes("rejet")) return "REJECTED";
  if (option.includes("approuv")) return "APPROVED";
  if (option.includes("validation")) return "PENDING";

  return null;
}

function collectRoleNames(roleLike: unknown): string[] {
  if (!roleLike) return [];

  if (typeof roleLike === "string") {
    const normalized = normalizeRoleName(roleLike);
    return normalized ? [normalized] : [];
  }

  if (typeof roleLike !== "object" || Array.isArray(roleLike)) {
    return [];
  }

  const record = roleLike as SessionRoleLike;
  const nestedRole = record.role;
  const scope = parseScopeObject(record.scope_json ?? nestedRole?.scope_json);
  const roleNames = new Set<string>();

  const rawNames = [
    record.nom,
    nestedRole?.nom,
    typeof scope?.role_template === "string" ? scope.role_template : null,
    typeof scope?.role_template_label === "string"
      ? scope.role_template_label
      : null,
  ];

  for (const rawName of rawNames) {
    if (!rawName) continue;
    const normalized = normalizeRoleName(rawName);
    if (normalized) {
      roleNames.add(normalized);
    }
  }

  return [...roleNames];
}

export function extractRoleNamesFromUser(user: SessionUserLike): string[] {
  const roleNames = new Set<string>();

  for (const assignment of user.roles ?? []) {
    for (const name of collectRoleNames(assignment)) {
      roleNames.add(name);
    }
  }

  return [...roleNames];
}

export function extractRoleNamesFromPayload(rawRoles: unknown): string[] {
  if (!Array.isArray(rawRoles)) return [];

  const roleNames = new Set<string>();

  for (const roleLike of rawRoles) {
    for (const name of collectRoleNames(roleLike)) {
      roleNames.add(name);
    }
  }

  return [...roleNames];
}

export function hasSystemAdminRoleNames(roleNames: string[]): boolean {
  return roleNames.some((roleName) => SYSTEM_ADMIN_ROLE_NAMES.has(roleName));
}

export function evaluateSessionEligibility(
  user: SessionUserLike,
): SessionEligibility {
  const roleNames = extractRoleNamesFromUser(user);
  const isSystemAdmin = hasSystemAdminRoleNames(roleNames);
  const ownerRegistrationStatus = resolveOwnerRegistrationStatus(user.scope_json);

  if (user.statut !== StatutCompte.ACTIF && user.statut !== "ACTIF") {
    if (ownerRegistrationStatus === "REJECTED") {
      return {
        allowed: false,
        code: "rejected_owner_registration",
        message: "Votre demande de compte proprietaire a ete rejetee.",
        statusCode: 403,
        isSystemAdmin,
        roleNames,
      };
    }

    if (ownerRegistrationStatus === "PENDING") {
      return {
        allowed: false,
        code: "pending_owner_registration",
        message: "Votre demande de compte proprietaire est encore en attente de validation.",
        statusCode: 403,
        isSystemAdmin,
        roleNames,
      };
    }

    return {
      allowed: false,
      code: "inactive_account",
      message: "Ce compte n'est pas actif.",
      statusCode: 403,
      isSystemAdmin,
      roleNames,
    };
  }

  if (typeof user.etablissement_id === "string" && user.etablissement_id.trim()) {
    return {
      allowed: true,
      isSystemAdmin,
      roleNames,
    };
  }

  if (isSystemAdmin) {
    return {
      allowed: true,
      isSystemAdmin,
      roleNames,
    };
  }

  return {
    allowed: false,
    code: "missing_tenant",
    message: "Ce compte n'est rattache a aucun etablissement actif.",
    statusCode: 403,
    isSystemAdmin,
    roleNames,
  };
}
