import { Application, Router, Request, Response as R, NextFunction } from "express";
import UserModel from "../../user/models/user.model";
import bcrypt from "bcrypt";
import { AuthService } from "../../../service/authService";
import { JwtService } from "../../../service/jwtService";
import Response from "../../../common/app/response";
import { Utilisateur } from "@prisma/client";
import RolesModel from "../../roles/models/roles.model";

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

  private async login(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const body: Pick<Utilisateur, "email" | "mot_de_passe_hash"> = req.body;
      const resultUser: Utilisateur = await this.userModel.findByEmail(body.email as string);
      if (!resultUser) {
        res.status(404).send({ message: "User not found" });
        throw new Error("User not found");
      }
      const valid = await bcrypt.compare(body.mot_de_passe_hash as string, resultUser.mot_de_passe_hash as string);
      if (!valid) {
        res.status(401).send({ message: "Invalid password" });
        throw new Error("Invalid password");
      }

      const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
      const jwt = new JwtService(secret);

      const authService = new AuthService(jwt);
      const result = await authService.login(resultUser);
      const rolesAccessList = await this.rolesModel.findMany({
        where: {
          etablissement_id: resultUser.etablissement_id
        }
      });
      Response.success(res, "Login successful", { result, user: resultUser, rolesAccessList });
    } catch (error) {
      console.log("🚀 ~ AuthApp ~ login ~ error:", error);
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
      const authService = new AuthService(jwt);
      const result = await authService.refreshToken(token);
      Response.success(res, "Token rafraîchi", result);
    } catch (error) {
      Response.error(res, "Refresh token invalide ou expiré", 401, error as Error);
      next(error);
    }
  }
}

export default AuthApp;
