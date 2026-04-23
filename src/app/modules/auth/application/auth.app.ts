import { Application, Router, Request, Response as R, NextFunction } from "express";
import bcrypt from "bcrypt";
import { Utilisateur } from "@prisma/client";
import Response from "../../../common/app/response";
import { AuthService } from "../../../service/authService";
import { JwtService } from "../../../service/jwtService";
import { evaluateSessionEligibility } from "../../../service/sessionPolicy";
import RolesModel from "../../roles/models/roles.model";
import { sanitizeUserResponse } from "../../user/application/user.sanitizer";
import UserModel from "../../user/models/user.model";

class AuthApp {
  public app: Application;
  public router: Router;
  private userModel: UserModel;
  private rolesModel: RolesModel;

  constructor(app: Application) {
    this.app = app;
    this.userModel = new UserModel();
    this.rolesModel = new RolesModel();
    this.router = Router();
    this.routes();
  }

  public routes(): Router {
    this.router.post("/login", this.login.bind(this));
    this.router.post("/refresh", this.refresh.bind(this));
    return this.router;
  }

  private sendEligibilityError(
    res: R,
    user: Pick<Utilisateur, "id" | "email" | "statut" | "etablissement_id">,
    eligibility: Extract<ReturnType<typeof evaluateSessionEligibility>, { allowed: false }>,
  ) {
    const emailQuery =
      typeof user.email === "string" && user.email.trim()
        ? `?email=${encodeURIComponent(user.email.trim())}&status=${encodeURIComponent(eligibility.code)}`
        : `?status=${encodeURIComponent(eligibility.code)}`;
    const redirectTo =
      eligibility.code === "missing_tenant"
        ? "/login"
        : `/compte-inactif${emailQuery}`;

    res.status(eligibility.statusCode).send({
      status: {
        code: eligibility.statusCode,
        success: false,
        message: eligibility.message,
        errorCode: eligibility.code,
        redirectTo,
      },
      data: {
        user,
      },
    });
  }

  private async login(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const body: Pick<Utilisateur, "email" | "mot_de_passe_hash"> = req.body;
      const email = body.email?.trim();
      const password = body.mot_de_passe_hash?.trim();

      if (!email || !password) {
        Response.error(res, "L'email et le mot de passe sont obligatoires.", 400, new Error("missing credentials"));
        return;
      }

      const matchingUsers = await this.userModel.findManyByEmail(email);

      if (!matchingUsers.length) {
        Response.error(res, "Utilisateur introuvable.", 404, new Error("user not found"));
        return;
      }

      const usersWithValidPassword: Utilisateur[] = [];
      for (const user of matchingUsers) {
        if (!user.mot_de_passe_hash) continue;

        const validPassword = await bcrypt.compare(password, user.mot_de_passe_hash);
        if (validPassword) {
          usersWithValidPassword.push(user);
        }
      }

      if (!usersWithValidPassword.length) {
        Response.error(res, "Mot de passe invalide.", 401, new Error("invalid password"));
        return;
      }

      if (usersWithValidPassword.length > 1) {
        Response.error(
          res,
          "Plusieurs comptes correspondent a cet email. Contactez l'administrateur pour resoudre ce doublon.",
          409,
          new Error("ambiguous login"),
        );
        return;
      }

      const resultUser = usersWithValidPassword[0];

      const eligibility = evaluateSessionEligibility(resultUser);
      if (!eligibility.allowed) {
        this.sendEligibilityError(res, {
          id: resultUser.id,
          email: resultUser.email,
          statut: resultUser.statut,
          etablissement_id: resultUser.etablissement_id,
        }, eligibility);
        return;
      }

      const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
      const jwt = new JwtService(secret);
      const authService = new AuthService(jwt);
      const result = await authService.login(resultUser);
      const rolesAccessList = await this.rolesModel.findMany({
        where: {
          etablissement_id: resultUser.etablissement_id,
        },
      });

      Response.success(res, "Login successful", {
        result,
        user: sanitizeUserResponse(resultUser),
        rolesAccessList,
      });
    } catch (error) {
      next(error);
    }
  }

  private async refresh(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const token = (req.body?.refreshToken ?? req.headers["x-refresh-token"]) as string;
      if (!token) {
        Response.error(res, "Refresh token manquant", 401, new Error("missing refresh token"));
        return;
      }

      const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
      const jwt = new JwtService(secret);
      const payload = await jwt.verifyRefreshToken(token);
      const resultUser = await this.userModel.findById(payload.sub);

      if (!resultUser) {
        Response.error(res, "Utilisateur introuvable.", 401, new Error("user not found"));
        return;
      }

      const eligibility = evaluateSessionEligibility(resultUser);
      if (!eligibility.allowed) {
        this.sendEligibilityError(res, {
          id: resultUser.id,
          email: resultUser.email,
          statut: resultUser.statut,
          etablissement_id: resultUser.etablissement_id,
        }, eligibility);
        return;
      }

      const authService = new AuthService(jwt);
      const result = await authService.refreshToken(token, resultUser);
      Response.success(res, "Token rafraichi", result);
    } catch (error) {
      Response.error(res, "Refresh token invalide ou expire", 401, error as Error);
    }
  }
}

export default AuthApp;
