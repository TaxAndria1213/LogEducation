/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from "express";

export function tenantMiddleware(req: Request, _res: Response, next: NextFunction) {
  const tokenTenant = (req as any).user?.etablissement_id;
  const headerTenant = req.headers["x-etablissement-id"] as string | undefined;

  if (headerTenant && tokenTenant && headerTenant !== tokenTenant) {
    return next(new Error("Conflit d'établissement"));
  }

  const tenantId = tokenTenant || headerTenant;
  if (tenantId) (req as any).tenantId = tenantId;
  next();
}
