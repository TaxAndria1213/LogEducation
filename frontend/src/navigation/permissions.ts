import type { Role, Utilisateur, UtilisateurRole } from "../types/models";
import type { NavigationModule, NavigationSubModule } from "./modules.config";
import {
  extractPermissionCodes,
  permissionMatches,
} from "../utils/permissionScope";

const SYSTEM_ADMIN_ROLE_NAMES = new Set([
  "ADMIN",
  "ADMINISTRATEUR",
  "ADMINISTRATOR",
  "SUPER ADMIN",
  "SUPERADMIN",
]);

type PermissionSubject = {
  permission?: string;
};

type PermissionContext = {
  user: Utilisateur | null;
  roles: UtilisateurRole[] | null;
  rolesAccessList: Role[] | null;
};

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

function normalizeRoleName(value?: string | null) {
  return value?.trim().toUpperCase() ?? "";
}

function resolveAssignmentRoleNames(assignment: UtilisateurRole): string[] {
  const scope = parseScopeObject(assignment.role?.scope_json ?? assignment.scope_json);
  const candidateNames = [
    assignment.role?.nom,
    typeof scope?.role_template === "string" ? scope.role_template : null,
    typeof scope?.role_template_label === "string" ? scope.role_template_label : null,
  ];

  return Array.from(
    new Set(candidateNames.map((value) => normalizeRoleName(value)).filter(Boolean)),
  );
}

function getGrantedPermissionCodes(roles: UtilisateurRole[]) {
  return Array.from(
    new Set(
      roles.flatMap((assignment) => [
        ...extractPermissionCodes(assignment.role?.scope_json, "permissions"),
        ...extractPermissionCodes(assignment.scope_json, "permissions"),
        ...extractPermissionCodes(assignment.scope_json, "allowed_permissions"),
      ]),
    ),
  );
}

function getDeniedPermissionCodes(roles: UtilisateurRole[]) {
  return Array.from(
    new Set(
      roles.flatMap((assignment) =>
        extractPermissionCodes(assignment.scope_json, "denied_permissions"),
      ),
    ),
  );
}

function isSystemAdmin(context: PermissionContext) {
  const assignments = context.roles ?? [];
  const isAdminAssignment = assignments.some((assignment) =>
    resolveAssignmentRoleNames(assignment).some((roleName) =>
      SYSTEM_ADMIN_ROLE_NAMES.has(roleName),
    ),
  );
  const isAdminRole = Boolean(
    context.rolesAccessList?.some((role) =>
      SYSTEM_ADMIN_ROLE_NAMES.has(normalizeRoleName(role.nom)),
    ),
  );
  return isAdminAssignment || isAdminRole;
}

export function hasPermission(
  permission: string | undefined,
  context: PermissionContext,
) {
  if (!permission) return true;
  if (!context.user) return false;
  if (isSystemAdmin(context)) return true;

  const assignments = context.roles ?? [];
  const deniedCodes = getDeniedPermissionCodes(assignments);
  if (deniedCodes.some((code) => permissionMatches(code, permission))) {
    return false;
  }

  const grantedCodes = getGrantedPermissionCodes(assignments);
  if (grantedCodes.some((code) => permissionMatches(code, permission))) {
    return true;
  }

  const directionWithoutExplicitPermissions =
    assignments.some((assignment) =>
      resolveAssignmentRoleNames(assignment).includes("DIRECTION"),
    ) && grantedCodes.length === 0;

  return directionWithoutExplicitPermissions;
}

function canAccessSubject(item: PermissionSubject, context: PermissionContext) {
  return hasPermission(item.permission, context);
}

export function filterSubModulesByPermissions(
  items: NavigationSubModule[],
  context: PermissionContext,
) {
  return items.filter((item) => canAccessSubject(item, context));
}

export function filterModulesByPermissions(
  modules: NavigationModule[],
  context: PermissionContext,
) {
  return modules
    .map((module) => {
      const children = filterSubModulesByPermissions(module.children, context);
      if (!canAccessSubject(module, context) && children.length === 0) return null;
      return { ...module, children };
    })
    .filter((module): module is NavigationModule => Boolean(module));
}
