import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __log_education_prisma__: PrismaClient | undefined;
}

const REMOTE_PRISMA_PROTOCOLS = ["prisma://", "prisma+postgres://"];
const LOCAL_DATABASE_PROTOCOLS = [
  "mysql://",
  "postgresql://",
  "postgres://",
  "sqlserver://",
  "mongodb://",
  "cockroachdb://",
  "file:",
];

function normalizeDatabaseUrl(rawValue: string | undefined) {
  if (!rawValue) return null;
  return rawValue.trim().replace(/^['"]+|['"]+$/g, "");
}

function isRemotePrismaUrl(databaseUrl: string | null) {
  return Boolean(databaseUrl && REMOTE_PRISMA_PROTOCOLS.some((prefix) => databaseUrl.startsWith(prefix)));
}

function requiresLocalPrismaEngine(databaseUrl: string | null) {
  return Boolean(databaseUrl && LOCAL_DATABASE_PROTOCOLS.some((prefix) => databaseUrl.startsWith(prefix)));
}

function hasGeneratedPrismaEngine() {
  const candidateDirectories = [
    path.resolve(process.cwd(), "node_modules", ".prisma", "client"),
    path.resolve(__dirname, "../../../node_modules/.prisma/client"),
  ];

  for (const directory of candidateDirectories) {
    if (!fs.existsSync(directory)) continue;

    const files = fs.readdirSync(directory);
    const hasEngine = files.some((fileName) =>
      fileName.startsWith("query_engine-") || fileName.startsWith("libquery_engine"),
    );

    if (hasEngine) {
      return true;
    }
  }

  return false;
}

function assertPrismaRuntimeConfiguration() {
  const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);

  if (!databaseUrl || isRemotePrismaUrl(databaseUrl) || !requiresLocalPrismaEngine(databaseUrl)) {
    return;
  }

  if (hasGeneratedPrismaEngine()) {
    return;
  }

  throw new Error(
    [
      "Prisma Client semble avoir ete genere sans engine local alors que DATABASE_URL pointe vers une base locale/driver classique.",
      `DATABASE_URL detectee: ${databaseUrl}`,
      "Relance `yarn prisma:generate` ou `npx prisma generate` sans `--no-engine`, puis redemarre le serveur.",
      "Le mode `--no-engine` doit etre reserve aux URLs `prisma://` / Accelerate.",
    ].join(" "),
  );
}

assertPrismaRuntimeConfiguration();

export const prisma = globalThis.__log_education_prisma__ ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__log_education_prisma__ = prisma;
}

export default prisma;
