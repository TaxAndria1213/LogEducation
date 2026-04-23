import { Utilisateur } from "../types/models.type";
import { JwtService } from "./jwtService";
import { randomUUID } from "node:crypto";
import { extractRoleNamesFromUser } from "./sessionPolicy";

export class AuthService {
    constructor(private readonly jwt: JwtService) { }

    private buildPayload(user: Utilisateur) {
        return {
            sub: user.id,
            role: extractRoleNamesFromUser(user),
            etablissement_id: user.etablissement_id ?? null,
            jti: randomUUID(),
        };
    }

    private async issueTokens(payload: ReturnType<AuthService["buildPayload"]>) {
        const accessToken = await this.jwt.sign(payload);
        const refreshToken = await this.jwt.signRefreshToken({ ...payload, jti: randomUUID() });
        return { accessToken, refreshToken };
    }

    async login(user: Utilisateur) {
        return this.issueTokens(this.buildPayload(user));
    }

    async refreshToken(refreshToken: string, user?: Utilisateur) {
        if (user) {
            return this.issueTokens(this.buildPayload(user));
        }

        const payload = await this.jwt.verifyRefreshToken(refreshToken);
        const newPayload = { ...payload, jti: randomUUID() };
        const accessToken = await this.jwt.sign(newPayload);
        const newRefreshToken = await this.jwt.signRefreshToken({ ...newPayload, jti: randomUUID() });
        return { accessToken, refreshToken: newRefreshToken };
    }

    static async getUserFromToken(token: string) {
        try {
            const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
            const jwt = new JwtService(secret);
            const payload = await jwt.verify(token);
            return payload.sub;
        } catch (error) {
            console.log("🚀 ~ AuthService ~ getUserFromToken ~ error:", error)
            return null;
        }
    }

}
