import express, { Application } from "express";
import dotenv from "dotenv";
import morgan from "morgan";
import cors from "cors";
import mysql from "mysql2/promise";
import { JwtService } from "./app/service/jwtService";
import { AuthGuard } from "./middleware/AuthGuard";
import { promisify } from 'node:util';
import { exec as cbExec } from 'node:child_process';
import { SystemApiRoutes } from "./app/api/system.routes";

dotenv.config();
const exec = promisify(cbExec);
class Server {
    private static instance: Server | null = null;

    public systemApp: Application;
    public systemPort: number = (parseInt(process.env.SYSTEM_PORT || "3001", 10));

    constructor() {
        this.systemApp = express();
        this.clearAllNodeCache();
        this.middleware();
    }

    private middleware(): void {
        const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
        const jwt = new JwtService(secret);
        const authGuard = new AuthGuard(jwt);

        if (process.env.NODE_ENV === "development") {
            this.systemApp.use(morgan("dev"));
        }
        this.systemApp.use(cors());
        this.systemApp.use(express.json());
        this.systemApp.use(express.urlencoded({ extended: true }));
        this.systemApp.use("/system-api", (req, res, next) => {
            if ((req.path === "/user/create" && req.method === "POST") || (req.path === "/user/login" && req.method === "POST")) {
                return next();
            }
            Promise.resolve(authGuard.handle(req, res, next)).catch(next);
        }, new SystemApiRoutes(this.systemApp).routes());
    }

    public static getInstance(): Server {
        if (!Server.instance) {
            Server.instance = new Server();
        }
        return Server.instance;
    }

    public start(): void {
        this.systemApp.listen(this.systemPort, () => {
            console.log(`System API server is running on http://localhost:${this.systemPort}`);
        });
    }

    public async verifyDatabase(): Promise<void> {
        try {
            const connection = await mysql.createConnection({
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
            });

            await connection.query(`CREATE DATABASE IF NOT EXISTS erp_maker`);
            console.log("Database verified or created successfully.");
            await connection.end();
        } catch (error) {
            console.error("Error verifying or creating the database:", error);
        }
    }

    private async clearAllNodeCache(): Promise<void> {
        exec("npm cache clean --force");
    }
}

const server = Server.getInstance();

server.verifyDatabase().then(() => {
    server.start();
});
export default Server;
