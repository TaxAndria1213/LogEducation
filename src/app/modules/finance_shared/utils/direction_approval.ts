import { Prisma, PrismaClient } from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

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

function resolveSystemRoleName(roleName?: string | null, scope?: unknown): string | null {
  const scopeObject = parseScopeObject(scope);
  const template =
    typeof scopeObject?.role_template === "string"
      ? scopeObject.role_template.trim().toUpperCase()
      : "";
  const normalizedRoleName = roleName?.trim().toUpperCase() ?? "";

  return template || normalizedRoleName || null;
}

export async function userHasDirectionRole(
  prisma: DbClient,
  userId: string | null | undefined,
  tenantId: string,
) {
  if (!userId) return false;

  const user = await prisma.utilisateur.findFirst({
    where: {
      id: userId,
      etablissement_id: tenantId,
    },
    select: {
      roles: {
        include: {
          role: {
            select: {
              nom: true,
              scope_json: true,
            },
          },
        },
      },
    },
  });

  if (!user) return false;

  return user.roles.some((assignment) => {
    const resolved = resolveSystemRoleName(
      assignment.role?.nom ?? null,
      assignment.role?.scope_json ?? null,
    );
    return resolved === "DIRECTION";
  });
}

export async function assertDirectionUser(
  prisma: DbClient,
  userId: string | null | undefined,
  tenantId: string,
  message = "Cette action requiert une validation de la direction.",
) {
  const allowed = await userHasDirectionRole(prisma, userId, tenantId);
  if (!allowed) {
    throw new Error(message);
  }
}
