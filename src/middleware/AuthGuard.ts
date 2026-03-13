/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response, NextFunction } from 'express';
import { JwtService } from 'src/app/service/jwtService';

export class AuthGuard {
  constructor(private readonly jwt: JwtService) {}

  /** middleware Express typé */
  handle = async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Token manquant' });
    }

    try {
      const token   = header.slice(7);
      const payload = await this.jwt.verify(token);
      (req as any).user = payload;        // injection dans la requête
      next();
    } catch {
      res.status(401).json({ message: 'Token invalide ou expiré' });
    }
  };
}
