import express, { Application, Request, Response } from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
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

    // Security middlewares
    this.app.use(helmet()); // Security headers

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // limit each IP to 100 requests per windowMs
      message: "Too many requests from this IP, please try again later.",
    });
    this.app.use(limiter);

    if (process.env.NODE_ENV === "development") {
      this.app.use(morgan("dev"));
    }

    // CORS configuration - restrict to specific origins
    const corsOptions = {
      origin: process.env.FRONTEND_URL || "http://localhost:5173", // Default to Vite dev server
      credentials: true,
    };
    this.app.use(cors(corsOptions));

    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    this.app.use(
      "/api",
      (req, res, next) => {
        // Skip authGuard for /api/user/create and /api/auth/login
        if ((req.path === "/user/create" && req.method === "POST") ||
            (req.path === "/auth/login" && req.method === "POST") ||
            (req.path === "/auth/refresh" && req.method === "POST")) {
          return next();
        }
        Promise.resolve(authGuard.handle(req, res, next)).catch(next);
      },
      new ApiRoutes(this.app).routes(),
      new SystemApiRoutes(this.app).routes()
    );

    // Global error handler
    this.app.use((err: Error & { statusCode?: number }, req: Request, res: Response) => {
      console.error("Error:", err);
      const statusCode = err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
      });
    });
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
