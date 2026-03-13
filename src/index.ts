import express, { Application, Request, Response } from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import cors from "cors";
import { ApiRoutes } from "./app/api/routes";
import mysql from "mysql2/promise";
import { JwtService } from "./app/service/jwtService";
import { AuthGuard } from "./middleware/AuthGuard";
import { SystemApiRoutes } from "./app/api/system.routes";

dotenv.config();
class Server {
  private static instance: Server | null = null;

  public app: Application;
  public port: number = (parseInt(process.env.PORT || "3000", 10));

  constructor(port: number) {
    this.app = express();
    this.port = port;
    // NOTE: Clearing npm cache on every start is slow and unnecessary in most environments.
    // If needed, run this manually or as part of a CI/CD pipeline.
    // this.clearAllNodeCache();
    this.middleware();
    this.routes();
  }

  private middleware(): void {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const jwt = new JwtService(secret);
    const authGuard = new AuthGuard(jwt);

    if (process.env.NODE_ENV === "development") {
      this.app.use(morgan("dev"));
    }
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(
      "/api",
      (req, res, next) => {
        // Skip authGuard for /api/user/create
        if ((req.path === "/user/create" && req.method === "POST") || (req.path === "/user/login" && req.method === "POST")) {
          return next();
        }
        Promise.resolve(authGuard.handle(req, res, next)).catch(next);
      },
      new ApiRoutes(this.app).routes(),
      new SystemApiRoutes(this.app).routes()
    );

    // this.app.use(
    //   "/api",
    //   (req, res, next) => {
    //     // Skip authGuard for /api/user/create
    //     if ((req.path === "/user/create" && req.method === "POST") || (req.path === "/user/login" && req.method === "POST")) {
    //       return next();
    //     }
    //     Promise.resolve(authGuard.handle(req, res, next)).catch(next);
    //   },
    //   new SystemApiRoutes(this.app).routes()
    // );
  }

  public static getInstance(port?: number): Server {
    if (!Server.instance) {
      Server.instance = new Server(port || 3000);
    }
    return Server.instance;
  }

  private routes(): void {
    this.app.get("/", (req: Request, res: Response) => {
      res.send("Bienvenue dans ERP Maker.");
    });
  }

  public start(): void {
    this.app.listen(this.port, () => {
      console.log(`Server is running on http://localhost:${this.port}`);
    });
  }

  public async verifyDatabase(): Promise<void> {
    try {

      const dbHost = process.env.DB_HOST;
      const dbPort = Number(process.env.DB_PORT || "3306");
      const dbUser = process.env.DB_USER;
      const dbPassword = process.env.DB_PASSWORD;
      const dbName = process.env.DB_NAME || "erp_maker";


      const connection = await mysql.createConnection({
        host: dbHost,
        user: dbUser,
        password: dbPassword,
        port: dbPort,
      });

      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
      console.log("Database verified or created successfully.");
      await connection.end();
    } catch (error) {
      console.error("Error verifying or creating the database:", error);
    }
  }

}

const server = Server.getInstance(process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);

(async () => {
  server.start();
})();
export default Server;
