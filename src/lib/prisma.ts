import { PrismaClient } from "@prisma/client";
import { PrismaClient as SqlitePrismaClient } from "../generated/sqlite/index.js";

// One Prisma schema cannot generate an engine for both providers. File URLs
// stay on the SQLite client so the before tests and verify-tradesim can run
// after the dev database moved to Postgres.
type DatabaseKind = "sqlite" | "postgresql";

function databaseKind(url: string): DatabaseKind {
  if (url.startsWith("file:")) return "sqlite";
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) {
    return "postgresql";
  }
  throw new Error("DATABASE_URL must be a sqlite file or a postgres URL");
}

function createPrismaClient(databaseUrl: string): PrismaClient {
  const kind = databaseKind(databaseUrl);
  switch (kind) {
    case "sqlite":
      return new SqlitePrismaClient({
        datasourceUrl: databaseUrl,
      }) as unknown as PrismaClient;
    case "postgresql":
      return new PrismaClient({ datasourceUrl: databaseUrl });
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaUrl?: string;
};

const databaseUrl = process.env.DATABASE_URL ?? "";

const prisma =
  globalForPrisma.prisma && globalForPrisma.prismaUrl === databaseUrl
    ? globalForPrisma.prisma
    : createPrismaClient(databaseUrl);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaUrl = databaseUrl;
}

export default prisma;
