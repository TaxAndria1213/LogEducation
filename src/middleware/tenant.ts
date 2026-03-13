/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from "express";

export function tenantMiddleware(req: Request, _res: Response, next: NextFunction) {
  // À adapter selon ton auth (JWT, session, etc.)
  const tenantId =
    (req.headers["x-etablissement-id"] as string) ||
    (req as any).user?.etablissement_id;

  if (tenantId) (req as any).tenantId = tenantId;
  next();
}