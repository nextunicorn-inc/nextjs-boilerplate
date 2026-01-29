import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const prismaClientSingleton = () => {
  const tursoDatabaseUrl = process.env.TURSO_DATABASE_URL;
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoDatabaseUrl || !tursoAuthToken) {
    throw new Error("Missing Turso connection details: TURSO_DATABASE_URL or TURSO_AUTH_TOKEN");
  }

  // Prisma 7: PrismaLibSql now accepts config object directly
  const adapter = new PrismaLibSql({
    url: tursoDatabaseUrl,
    authToken: tursoAuthToken,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
};

export const prisma = globalForPrisma.prisma || prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
