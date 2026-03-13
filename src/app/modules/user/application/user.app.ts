/* eslint-disable @typescript-eslint/no-explicit-any */
import { Application, Router, Request, Response as R, NextFunction } from "express";
import UserModel from "../models/user.model";
import bcrypt from "bcrypt";
import { AuthService } from "../../../service/authService";
import { JwtService } from "../../../service/jwtService";
import Utils from "../../../utils";
import Response from "../../../common/app/response";
import { Utilisateur } from "@prisma/client";
import RolesApp from "../../roles/application/roles.app";
import { getAllPaginated } from "../../../common/utils/functions";
import RolesModel from "../../roles/models/roles.model";

class UserApp {
  public app: Application;
  public router: Router;
  private user: UserModel;
  private rolesApp: RolesApp;
  private rolesModel: RolesModel;

  constructor(app: Application) {
    this.app = app;
    this.user = new UserModel();
    this.rolesApp = new RolesApp(app);
    this.rolesModel = new RolesModel();
    this.router = Router();
    this.routes();
  }

  public routes(): Router {
    this.router.post("/create", this.createUser.bind(this));
    this.router.post("/login", this.login.bind(this));
    this.router.put("/:id", this.updateUser.bind(this));
    this.router.get("/", this.getAll.bind(this));
    this.router.get("/:email", this.getUserByEmail.bind(this));
    return this.router;
  }

  private async getUserByEmail(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const result = await this.user.findByEmail(req.params.email as string);
      Response.success(res, "Data user.", result)
    } catch (error) {
      next(error);
    }
  }

  private async getAll(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      console.log(req.query)
      const result = await getAllPaginated(req.query, this.user);
      Response.success(res, "Data user.", result)
    } catch (error) {
      next(error);
    }
  }

  private async createUser(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const body: Utilisateur = req.body;
      console.log("🚀 ~ UserApp ~ createUser ~ body:", body)
      const userData: Utilisateur = {
        ...body,
        mot_de_passe_hash: await bcrypt.hash(body.mot_de_passe_hash as string, 10),
      }
      const result: object = await this.user.create(userData);
      Response.success(res, "user created successfully", result)
    } catch (error) {
      console.log("🚀 ~ UserApp ~ createUser ~ error:", error)
      next(error);
    }
  }

  private async login(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const body: Pick<Utilisateur, "email" | "mot_de_passe_hash"> = req.body;
      const resultUser: Utilisateur = await this.user.findByEmail(body.email as string);
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

      const authService = new AuthService(jwt)
      const result = await authService.login(resultUser);
      const rolesAccessList = await this.rolesModel.findMany({
        where: {
          etablissement_id: resultUser.etablissement_id
        }
      });
      Response.success(res, "Login successful", { result, user: resultUser, rolesAccessList })
    } catch (error) {
      console.log("🚀 ~ UserApp ~ login ~ error:", error);
      next(error);
    }
  }

  private async updateUser(req: Request, res: R, next: NextFunction): Promise<void> {
    try {
      const body: Utilisateur = req.body;
      const id: string = req.params.id;
      const result: any = await this.user.update(id, Utils.omit(body, "id"));
      Response.success(res, "Database updated successfully", result)
    } catch (error) {
      next(error);
    }
  }
}

export default UserApp;
