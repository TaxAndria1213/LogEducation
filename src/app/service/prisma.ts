import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __log_education_prisma__: PrismaClient | undefined;
}

export const prisma = globalThis.__log_education_prisma__ ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__log_education_prisma__ = prisma;
}

export default prisma;
