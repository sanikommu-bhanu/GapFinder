import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool, neonConfig } from "@neondatabase/serverless";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Neon is reached over its WebSocket endpoint (443) rather than a direct
 * Postgres socket (5432).
 *
 * Plenty of the networks a student actually studies on — campus wifi, office
 * guest networks, some mobile carriers — block outbound 5432 outright, which
 * made every DB-backed page fail with an unhelpful "can't reach database
 * server". 443 is never blocked, so the app works from anywhere, and this is
 * the same transport the serverless runtime would use in production.
 */
// Node 18+ ships a global WebSocket. The `ws` package is avoided deliberately:
// its optional native buffer-util addon does not survive Next.js bundling and
// fails at runtime with "bufferUtil.mask is not a function".
neonConfig.webSocketConstructor = WebSocket;

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }
  const adapter = new PrismaNeon(new Pool({ connectionString }));
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
