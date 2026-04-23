/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from "express";
import { JwtService } from "src/app/service/jwtService";
import {
  extractRoleNamesFromPayload,
  hasSystemAdminRoleNames,
} from "../app/service/sessionPolicy";

export class AuthGuard {
  constructor(private readonly jwt: JwtService) {}

  /** middleware Express type */
  handle = async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Token manquant" });
    }

    try {
      const token = header.slice(7);
      const payload = await this.jwt.verify(token);
      const requestedTenant = req.headers["x-etablissement-id"] as string | undefined;
      const roleNames = extractRoleNamesFromPayload(payload.role);
      const isSystemAdmin = hasSystemAdminRoleNames(roleNames);
      const tokenTenant =
        typeof payload.etablissement_id === "string" && payload.etablissement_id.trim()
          ? payload.etablissement_id
          : null;

      if (requestedTenant && tokenTenant && requestedTenant !== tokenTenant) {
        return res.status(403).json({ message: "Conflit d'etablissement" });
      }

      if (!tokenTenant && requestedTenant && !isSystemAdmin) {
        return res.status(403).json({
          message: "Ce compte n'est rattache a aucun etablissement actif.",
        });
      }

      if (!tokenTenant && !requestedTenant && !isSystemAdmin) {
        return res.status(403).json({
          message: "Ce compte n'est rattache a aucun etablissement actif.",
        });
      }

      (req as any).user = payload;
      (req as any).tenantId = tokenTenant ?? requestedTenant;
      next();
    } catch {
      res.status(401).json({ message: "Token invalide ou expire" });
    }
  };
}
