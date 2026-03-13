// src/services/JwtService.ts
import { SignJWT, jwtVerify, JWTPayload } from 'jose';

export interface AccessPayload extends JWTPayload {
  sub: string;          // identifiant utilisateur
  role: string;         // custom claim
}

export class JwtService {
  constructor(
    private readonly secret: Uint8Array,              // clé HMAC ou privée RSA/Ed25519
    private readonly issuer  = 'api.erp-maker.com',
    private readonly alg:     'HS256'|'RS256'|'EdDSA' = 'HS256'
  ) {}

  /** Crée un refresh-token (durée longue) */
  async signRefreshToken(payload: Omit<AccessPayload, 'iat'|'exp'>): Promise<string> {
    return await new SignJWT(payload)
      .setProtectedHeader({ alg: this.alg })
      .setIssuer(this.issuer)
      .setAudience('app.web')
      .setExpirationTime('7d')
      .setIssuedAt()
      .sign(this.secret);
  }

  /** Vérifie et renvoie le payload typé */
  async verifyRefreshToken(token: string): Promise<AccessPayload> {
    const { payload } = await jwtVerify<AccessPayload>(token, this.secret, {
      issuer: this.issuer,
      audience: 'app.web',
    });
    return payload;
  }

  /** création de compte utilisateur */
  
  

  /** Crée un access-token (durée courte) */
  async sign(payload: Omit<AccessPayload, 'iat'|'exp'>,
             expiresIn: string | number = process.env.JWT_EXPIRATION || '1h'): Promise<string> {
    return await new SignJWT(payload)
      .setProtectedHeader({ alg: this.alg })
      .setIssuer(this.issuer)
      .setAudience('app.web')
      .setExpirationTime(expiresIn)
      .setIssuedAt()
      .sign(this.secret);
  }

  /** Vérifie et renvoie le payload typé */
  async verify(token: string): Promise<AccessPayload> {
    const { payload } = await jwtVerify<AccessPayload>(token, this.secret, {
      issuer: this.issuer,
      audience: 'app.web',
    });
    return payload;
  }
}
