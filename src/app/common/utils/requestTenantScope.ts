import { Request } from "express";
import { parseJSON } from "./query";

export type TenantScopedRequest = Request & {
  tenantId?: string;
  user?: {
    sub?: string;
  };
};

type TenantResolutionOptions = {
  allowBodyTenant?: boolean;
  missingMessage?: string;
  conflictMessage?: string;
};

type TenantResolutionResult =
  | { ok: true; tenantId: string; queryWhere: Record<string, unknown> }
  | { ok: false; statusCode: number; message: string };

export function mergeScopedWhere(
  existingWhere: Record<string, unknown> | null | undefined,
  scope: Record<string, unknown>,
) {
  if (!existingWhere || Object.keys(existingWhere).length === 0) {
    return scope;
  }

  return {
    AND: [existingWhere, scope],
  };
}

export function resolveTenantContext(
  req: TenantScopedRequest,
  options: TenantResolutionOptions = {},
): TenantResolutionResult {
  const requestTenant = req.tenantId?.trim();
  const queryWhere = parseJSON<Record<string, unknown>>(req.query.where, {});
  const queryTenant =
    typeof queryWhere?.etablissement_id === "string"
      ? queryWhere.etablissement_id.trim()
      : undefined;
  const bodyTenant =
    options.allowBodyTenant && typeof req.body?.etablissement_id === "string"
      ? req.body.etablissement_id.trim()
      : undefined;

  const tenantCandidates = [requestTenant, queryTenant, bodyTenant].filter(
    (value): value is string => Boolean(value),
  );

  if (tenantCandidates.length === 0) {
    return {
      ok: false,
      statusCode: 403,
      message:
        options.missingMessage ?? "Aucun etablissement actif n'a ete fourni.",
    };
  }

  if (new Set(tenantCandidates).size > 1) {
    return {
      ok: false,
      statusCode: 403,
      message:
        options.conflictMessage ?? "Conflit d'etablissement detecte.",
    };
  }

  return {
    ok: true,
    tenantId: tenantCandidates[0],
    queryWhere,
  };
}
